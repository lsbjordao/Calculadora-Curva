"use strict";

// Adjustable 3D conic sections. Legacy "secao: h,k" remains valid.
// Cone: x²+y²=a²(z-d)²; cutting plane: z=d+h+k(x cos(p)+y sin(p)).
// h is the plane's height above the cone vertex, a is the aperture,
// d is the vertex's vertical position, and p rotates the plane (radians).
// |a*k|<1: ellipse (circle when k=0); =1: parabola; >1: hyperbola.
import {clipPlaneToBox} from './scene3d.js';

const CONE_COLOR='#4199ba';
const PLANE_COLOR='#e4a53a';
const CURVE_COLOR='#ef4b86';
const TAU=2*Math.PI;
const CLASSIFICATIONS={
  circle:'circunferência',ellipse:'elipse',parabola:'parábola',hyperbola:'hipérbole'
};
const finite=x=>typeof x==='number'&&Number.isFinite(x);
function validSectionOptions({aperture=1,vertexZ=0,azimuth=0}={}){
  if(!finite(aperture)||aperture<=0||aperture>5)throw new Error('A abertura a deve estar entre 0 e 5 (exclusivo em 0).');
  if(!finite(vertexZ)||Math.abs(vertexZ)>30)throw new Error('A altura d do vértice deve ficar entre −30 e 30.');
  if(!finite(azimuth)||Math.abs(azimuth)>TAU*10)throw new Error('O azimute p deve ser finito.');
  return {aperture,vertexZ,azimuth};
}

export function classifyConicSection(k,aperture=1){
  if(!finite(k)||!finite(aperture)||aperture<=0)
    throw new Error('Inclinação k e abertura a devem ser números válidos.');
  const t=Math.abs(aperture*k);
  if(t<1e-9)return 'circle';
  if(Math.abs(t-1)<1e-9)return 'parabola';
  return t<1?'ellipse':'hyperbola';
}

export function coneSurface({halfHeight=5,radialSegments=40,heightSegments=9,aperture=1,vertexZ=0}={}){
  validSectionOptions({aperture,vertexZ});
  if(!finite(halfHeight)||halfHeight<=0||halfHeight>50)throw new Error('Altura do cone inválida.');
  const vertices=[],faces=[],n=Math.max(12,Math.min(96,Math.round(radialSegments)));
  const m=Math.max(2,Math.min(32,Math.round(heightSegments)));
  for(const sign of [-1,1]){
    const start=vertices.length;
    for(let layer=0;layer<=m;layer++){
      const t=sign*halfHeight*layer/m;
      const radius=aperture*Math.abs(t);
      const z=vertexZ+t;
      for(let j=0;j<n;j++){
        const theta=TAU*j/n;
        vertices.push([radius*Math.cos(theta),radius*Math.sin(theta),z]);
      }
    }
    for(let layer=0;layer<m;layer++)for(let j=0;j<n;j++){
      const x=start+layer*n+j,y=start+layer*n+(j+1)%n;
      const z=x+n,w=y+n;
      faces.push(sign===1?[x,y,w,z]:[x,z,w,y]);
    }
  }
  return {kind:'mesh',vertices,faces,color:CONE_COLOR,alpha:.13,conicSection:true};
}

// On either nappe, let t=z-d and sign*t>0:
// x=s*a*t*cos(theta), y=s*a*t*sin(theta);
// t=h/(1-s*a*k*cos(theta-p)).
function sectionPoint(h,k,sign,theta,halfHeight,{aperture,vertexZ,azimuth}){
  const denominator=1-sign*aperture*k*Math.cos(theta-azimuth);
  if(Math.abs(denominator)<1e-10)return null;
  const t=h/denominator;
  if(sign*t<=1e-9||Math.abs(t)>halfHeight+1e-9)return null;
  return [sign*aperture*t*Math.cos(theta),sign*aperture*t*Math.sin(theta),vertexZ+t];
}

export function conePlaneIntersection(h,k,{halfHeight=5,samples=360,aperture=1,vertexZ=0,azimuth=0}={}){
  const options=validSectionOptions({aperture,vertexZ,azimuth});
  if(!finite(h)||h<=0||h>50||!finite(k)||Math.abs(k)>20)
    throw new Error('Use h positivo e inclinação finita (|k| ≤ 20).');
  const segments=[];
  const n=Math.max(72,Math.min(720,Math.round(samples)));
  for(const sign of [-1,1]){
    for(let j=0;j<n;j++){
      const p=sectionPoint(h,k,sign,TAU*j/n,halfHeight,options);
      const q=sectionPoint(h,k,sign,TAU*(j+1)/n,halfHeight,options);
      if(!p||!q)continue;
      if(Math.hypot(...p.map((x,i)=>x-q[i]))>halfHeight*.35*Math.max(1,aperture))continue;
      segments.push({kind:'segment',a:p,b:q,color:CURVE_COLOR,weight:3.5,
        conicSection:true,sectionCurve:true});
    }
  }
  return segments;
}


/**
 * Angle-based plane model for an exactly vertical orientation at ±90°.
 * Plane: cos(q)(z-d-h) - sin(q)u = b |sin(q)|,
 * u = x cos(p) + y sin(p).  b > 0 keeps the plane off the cone apex
 * when vertical, so the section remains a non-degenerate hyperbola.
 * Legacy slope-based geometry is unchanged.
 */
function angledParameters(h,angle,{aperture=1,vertexZ=0,azimuth=0,offset=.75}={}){
  validSectionOptions({aperture,vertexZ,azimuth});
  if(!finite(h)||h<=0||h>50)throw new Error('Altura h deve ser positiva e no máximo 50.');
  if(!finite(angle)||angle< -90||angle>90)throw new Error('O ângulo deve estar entre −90° e +90°.');
  if(!finite(offset)||offset<=0||offset>10)throw new Error('O afastamento b deve ser maior que 0 e no máximo 10.');
  const rad=angle*Math.PI/180;
  const cosine=Math.abs(angle)===90?0:Math.cos(rad);
  const sine=Math.sin(rad);
  const numerator=h*cosine+offset*Math.abs(sine);
  return {aperture,vertexZ,azimuth,offset,cosine,sine,numerator,angle};
}
export function classifyAngledConicSection(angle,aperture=1){
  if(!finite(aperture)||aperture<=0)throw new Error('Abertura inválida.');
  if(!finite(angle)||angle< -90||angle>90)throw new Error('O ângulo deve estar entre −90° e +90°.');
  const rad=angle*Math.PI/180;
  const slopeAxis=aperture*Math.abs(Math.sin(rad));
  const upright=Math.abs(angle)===90?0:Math.abs(Math.cos(rad));
  if(Math.abs(angle)<1e-10)return 'circle';
  if(Math.abs(slopeAxis-upright)<1e-10)return 'parabola';
  return slopeAxis<upright?'ellipse':'hyperbola';
}
export function conePlaneIntersectionAngle(h,angle,{halfHeight=5,samples=360,aperture=1,vertexZ=0,azimuth=0,offset=.75}={}){
  const p=angledParameters(h,angle,{aperture,vertexZ,azimuth,offset});
  const segments=[],n=Math.max(72,Math.min(720,Math.round(samples)));
  const point=(sign,theta)=>{
    const denominator=p.cosine-sign*aperture*p.sine*Math.cos(theta-azimuth);
    if(Math.abs(denominator)<1e-12)return null;
    const t=p.numerator/denominator;
    if(sign*t<=1e-9||Math.abs(t)>halfHeight+1e-9)return null;
    return [sign*aperture*t*Math.cos(theta),sign*aperture*t*Math.sin(theta),vertexZ+t];
  };
  for(const sign of [-1,1])for(let j=0;j<n;j++){
    const a=point(sign,TAU*j/n),b=point(sign,TAU*(j+1)/n);
    if(!a||!b||Math.hypot(...a.map((x,i)=>x-b[i]))>halfHeight*.35*Math.max(1,aperture))continue;
    segments.push({kind:'segment',a,b,color:CURVE_COLOR,weight:3.5,conicSection:true,sectionCurve:true});
  }
  return segments;
}
export function makeAngledConicSectionScene(h=2,angle=0,{halfHeight,aperture=1,vertexZ=0,azimuth=0,offset=.75}={}){
  const pars=angledParameters(h,angle,{aperture,vertexZ,azimuth,offset});
  const size=halfHeight??Math.min(50,Math.max(5,h*2.6));
  const cone=coneSurface({halfHeight:size,aperture,vertexZ});
  const horizontal=size*Math.max(1,aperture);
  const box={min:[-horizontal,-horizontal,vertexZ-size],max:[horizontal,horizontal,vertexZ+size]};
  const normal=[-pars.sine*Math.cos(azimuth),-pars.sine*Math.sin(azimuth),pars.cosine];
  const planeD=pars.cosine*(vertexZ+h)+offset*Math.abs(pars.sine);
  const polygon=clipPlaneToBox(normal,planeD,box);
  const curve=conePlaneIntersectionAngle(h,angle,{halfHeight:size,aperture,vertexZ,azimuth,offset});
  const type=classifyAngledConicSection(angle,aperture);
  const scene=[cone];
  if(polygon.length>=3)scene.push({kind:'polygon',points:polygon,color:PLANE_COLOR,
    alpha:.22,conicSection:true,sectionPlane:true});
  scene.push(...curve,{kind:'point',p:[0,0,vertexZ],label:'vértice',color:'#9a5bd2',conicSection:true});
  if(curve.length){
    const mid=curve[Math.floor(curve.length*.43)];
    const at=mid.a.map((v,i)=>(v+mid.b[i])/2);
    scene.push({kind:'label',p:at,text:CLASSIFICATIONS[type],color:CURVE_COLOR,conicSection:true});
  }
  return {scene,type,count:curve.length,info:[
    'Cone: x² + y² = '+Number((aperture*aperture).toFixed(4))+'(z − '+vertexZ+')²',
    'Ângulo do plano: '+angle+'°'+(Math.abs(angle)===90?' (vertical)':''),
    'Equação do plano: cos(q)(z − d − h) − sin(q)(x cos(p) + y sin(p)) = b|sin(q)|',
    'Parâmetros: q é o ângulo em graus; b afasta horizontalmente o plano do vértice',
    'Interseção: '+CLASSIFICATIONS[type],
    'Curva e cone truncados apenas pela janela de visualização.'
  ]};
}

export function makeConicSectionScene(h=2,k=0,{halfHeight,aperture=1,vertexZ=0,azimuth=0}={}){
  validSectionOptions({aperture,vertexZ,azimuth});
  if(!finite(h)||h<=0||h>50||!finite(k)||Math.abs(k)>20)
    throw new Error('Use h positivo e inclinação finita (|k| ≤ 20).');
  // A larger h expands the displayed cone instead of silently hiding its section.
  const size=halfHeight??Math.min(50,Math.max(5,h*2.6));
  const type=classifyConicSection(k,aperture);
  const cone=coneSurface({halfHeight:size,aperture,vertexZ});
  const horizontal=size*Math.max(1,aperture);
  const box={min:[-horizontal,-horizontal,vertexZ-size],max:[horizontal,horizontal,vertexZ+size]};
  const normal=[-k*Math.cos(azimuth),-k*Math.sin(azimuth),1];
  const polygon=clipPlaneToBox(normal,vertexZ+h,box);
  const curve=conePlaneIntersection(h,k,{halfHeight:size,aperture,vertexZ,azimuth});
  const scene=[cone];
  if(polygon.length>=3)scene.push({kind:'polygon',points:polygon,color:PLANE_COLOR,
    alpha:.22,conicSection:true,sectionPlane:true});
  scene.push(...curve);
  scene.push({kind:'point',p:[0,0,vertexZ],label:'vértice',color:'#9a5bd2',conicSection:true});
  if(curve.length){
    const mid=curve[Math.floor(curve.length*.43)];
    const at=mid.a.map((v,i)=>(v+mid.b[i])/2);
    scene.push({kind:'label',p:at,text:CLASSIFICATIONS[type],color:CURVE_COLOR,conicSection:true});
  }
  const rounded=x=>Number(x.toFixed(5));
  return {scene,type,info:[
    'Cone: x² + y² = '+rounded(aperture*aperture)+'(z − '+rounded(vertexZ)+')²',
    'Plano secante: z = '+rounded(vertexZ+h)+' + '+rounded(k)+'(x cos('+rounded(azimuth)+') + y sin('+rounded(azimuth)+'))',
    'Interseção: '+CLASSIFICATIONS[type],
    'h: altura relativa ao vértice; k: inclinação; a: abertura; d: cota do vértice; p: rotação em radianos',
    'Critério para o tipo de seção: |a·k| = '+rounded(Math.abs(aperture*k))+' (1 é o limite parabólico)',
    'Cone e curva são truncados apenas pelos limites da visualização 3D.'
  ],count:curve.length};
}
