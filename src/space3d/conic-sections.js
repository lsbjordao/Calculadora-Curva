"use strict";

// Conic sections of the double cone x²+y²=z², cut by z=h+kx.
// |k|<1: ellipse (circle if k=0); |k|=1: parabola; |k|>1: hyperbola.
// Reuses ordinary mesh, polygon, segment and label scene primitives in all
// three 3D renderers (Canvas 2D, Plotly.js and Three.js).
import {clipPlaneToBox} from './scene3d.js';

const CONE_COLOR='#4199ba';
const PLANE_COLOR='#e4a53a';
const CURVE_COLOR='#ef4b86';
const RIM_COLOR='#31718b';
const TAU=2*Math.PI;
const CLASSIFICATIONS={
  circle:'circunferência',ellipse:'elipse',parabola:'parábola',hyperbola:'hipérbole'
};
const finite=x=>typeof x==='number'&&Number.isFinite(x);

export function classifyConicSection(k){
  if(!finite(k))throw new Error('A inclinação do plano deve ser um número finito.');
  const t=Math.abs(k);
  if(t<1e-9)return 'circle';
  if(Math.abs(t-1)<1e-9)return 'parabola';
  return t<1?'ellipse':'hyperbola';
}

export function coneSurface({halfHeight=5,radialSegments=40,heightSegments=9}={}){
  if(!finite(halfHeight)||halfHeight<=0||halfHeight>50)throw new Error('Altura do cone inválida.');
  const vertices=[],faces=[],n=Math.max(12,Math.min(96,Math.round(radialSegments)));
  const m=Math.max(2,Math.min(32,Math.round(heightSegments)));
  for(const sign of [-1,1]){
    const start=vertices.length;
    for(let layer=0;layer<=m;layer++){
      const radius=halfHeight*layer/m;
      const z=sign*radius;
      for(let j=0;j<n;j++){
        const theta=TAU*j/n;
        vertices.push([radius*Math.cos(theta),radius*Math.sin(theta),z]);
      }
    }
    for(let layer=0;layer<m;layer++)for(let j=0;j<n;j++){
      const a=start+layer*n+j,b=start+layer*n+(j+1)%n;
      const c=a+n,d=b+n;
      faces.push(sign===1?[a,b,d,c]:[a,c,d,b]);
    }
  }
  return {kind:'mesh',vertices,faces,color:CONE_COLOR,alpha:.13,conicSection:true};
}

// Exact parametrization by a generator angle theta on each cone nappe:
// x = s z cos(theta), y = s z sin(theta), z = h/(1-s k cos(theta)).
function sectionPoint(h,k,sign,theta,halfHeight){
  const den=1-sign*k*Math.cos(theta);
  if(Math.abs(den)<1e-10)return null;
  const z=h/den;
  if(sign*z<=1e-9||Math.abs(z)>halfHeight+1e-9)return null;
  return [sign*z*Math.cos(theta),sign*z*Math.sin(theta),z];
}

export function conePlaneIntersection(h,k,{halfHeight=5,samples=360}={}){
  if(!finite(h)||h<=0||h>50||!finite(k)||Math.abs(k)>20)
    throw new Error('Use h positivo e inclinação finita (|k| ≤ 20).');
  const segments=[];
  const n=Math.max(72,Math.min(720,Math.round(samples)));
  for(const sign of [-1,1]){
    for(let j=0;j<n;j++){
      const p=sectionPoint(h,k,sign,TAU*j/n,halfHeight);
      const q=sectionPoint(h,k,sign,TAU*(j+1)/n,halfHeight);
      if(!p||!q)continue;
      if(Math.hypot(...p.map((x,i)=>x-q[i]))>halfHeight*.35)continue;
      segments.push({kind:'segment',a:p,b:q,color:CURVE_COLOR,weight:3.5,
        conicSection:true,sectionCurve:true});
    }
  }
  return segments;
}

export function makeConicSectionScene(h=2,k=0,{halfHeight=5}={}){
  const type=classifyConicSection(k);
  const cone=coneSurface({halfHeight});
  const box={min:[-halfHeight,-halfHeight,-halfHeight],max:[halfHeight,halfHeight,halfHeight]};
  const polygon=clipPlaneToBox([-k,0,1],h,box);
  const curve=conePlaneIntersection(h,k,{halfHeight});
  const scene=[cone];
  if(polygon.length>=3)scene.push({kind:'polygon',points:polygon,color:PLANE_COLOR,
    alpha:.22,conicSection:true,sectionPlane:true});
  scene.push(...curve);
  // A single label is enough; do not repeat it for every line segment.
  if(curve.length){
    const mid=curve[Math.floor(curve.length*.43)];
    const at=mid.a.map((v,i)=>(v+mid.b[i])/2);
    scene.push({kind:'label',p:at,text:CLASSIFICATIONS[type],color:CURVE_COLOR,conicSection:true});
  }
  return {scene,type,
    info:[
      'Cone duplo: x² + y² = z² (limitado para visualização)',
      'Plano secante: z = '+h+(k<0?' - ':' + ')+Math.abs(k)+'x',
      'Interseção: '+CLASSIFICATIONS[type],
      'k = 0: circunferência; 0 < |k| < 1: elipse; |k| = 1: parábola; |k| > 1: hipérbole',
      'A curva rosa está sobre o cone e o plano; a inclinação k pode ser alterada.'
    ],
    count:curve.length
  };
}
