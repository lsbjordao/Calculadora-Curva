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
