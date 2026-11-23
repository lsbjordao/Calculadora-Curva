"use strict";
import {quadricPolynomial} from './quadric-sections.js';
import {quadricScene} from './quadrics.js';

const TAU=2*Math.PI;
const dot=(a,b)=>a.reduce((s,x,i)=>s+x*b[i],0);
const norm=a=>Math.hypot(...a);

// Parameter values u,v are in [0,1], matching the generated mesh sampling
// for every standard quadric family.
export function quadricSurfacePoint(type,{a=1,b=1,c=1,d=0}={},u=.5,v=.2,face=1){
  if(![u,v].every(Number.isFinite)||u<0||u>1||v<0||v>1)
    throw new Error('Coordenadas paramétricas u e v devem estar entre 0 e 1.');
  const theta=TAU*v;
  switch(type){
    case 'esfera':case 'elipsoide':{
      const phi=-Math.PI/2+Math.PI*u;
      return [a*Math.cos(phi)*Math.cos(theta),b*Math.cos(phi)*Math.sin(theta),d+c*Math.sin(phi)];
    }
    case 'paraboloide':{
      const r=1.8*u;
      return [a*r*Math.cos(theta),b*r*Math.sin(theta),d+c*r*r];
    }
    case 'hiperboloide1':{
      const t=-1.4+2.8*u;
      return [a*Math.cosh(t)*Math.cos(theta),b*Math.cosh(t)*Math.sin(theta),d+c*Math.sinh(t)];
    }
    case 'hiperboloide2':{
      const t=1.5*u;
      const sign=face<0?-1:1;
      return [a*Math.sinh(t)*Math.cos(theta),b*Math.sinh(t)*Math.sin(theta),d+sign*c*Math.cosh(t)];
    }
    case 'sela':{
      const x=3.2*(u-.5),y=3.2*(v-.5);
      return [a*x,b*y,d+c*(x*x-y*y)];
    }
    case 'cilindro':
      return [a*Math.cos(theta),b*Math.sin(theta),d+c*(u-.5)*5];
    default:throw new Error('Tipo de superfície não suportado: '+type);
  }
}

export function quadricTangent(type,params={},u=.5,v=.2,face=1){
  const poly=quadricPolynomial(type,params);
  const point=quadricSurfacePoint(type,params,u,v,face);
  const {diag,linear,constant}=poly;
  const residual=diag.reduce((sum,coef,i)=>sum+coef*point[i]*point[i]+linear[i]*point[i],constant);
  const gradient=point.map((x,i)=>2*diag[i]*x+linear[i]);
  const magnitude=norm(gradient);
  if(magnitude<=1e-10)throw new Error('Gradiente nulo: não há plano tangente único neste ponto singular.');
  const normal=gradient.map(x=>x/magnitude),distance=dot(normal,point);
  const derivatives=type==='paraboloide'||type==='sela'?{
    dx:2*(params.c??1)*point[0]/((params.a??1)**2),
    dy:(type==='sela'?-2:2)*(params.c??1)*point[1]/((params.b??1)**2)
  }:null;
  return {point,gradient,normal,distance,gradientMagnitude:magnitude,
    residual,derivatives,u,v,face};
}
export function tangentScene(type,params={},u=.5,v=.2,face=1){
  const surface=quadricScene(type,params);
  const tangent=quadricTangent(type,params,u,v,face);
  const {point,normal,distance}=tangent;
  const vectorLength=Math.min(2,Math.max(.65,...[params.a,params.b,params.c].filter(Number.isFinite))*.6);
  const end=point.map((x,i)=>x+normal[i]*vectorLength);
  const scene=[
    ...surface.scene,
    {kind:'plane',n:normal,d:distance,alpha:.2,color:'#e4a53a',conicSection:true},
    {kind:'arrow',from:point,to:end,color:'#ef4b86',weight:3,conicSection:true},
    {kind:'point',p:point,color:'#24bba5',label:'P',conicSection:true}
  ];
  return {surface,tangent,scene};
}
