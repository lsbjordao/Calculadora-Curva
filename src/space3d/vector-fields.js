"use strict";
// Laboratório numérico de cálculo vetorial no espaço.
// Integrais e operadores diferenciais são aproximações, não primitivas exatas.
import {compileXyz} from './implicit-quadric.js';

export function compileVectorField(expressions,params={}){
  if(!Array.isArray(expressions)||![2,3].includes(expressions.length))
    throw new Error('Campo: informe duas ou três componentes.');
  const dimension=expressions.length;
  const fns=expressions.map(expression=>compileXyz(expression,params));
  const field=(x,y,z=0)=>{
    const vector=fns.map(fn=>fn(x,y,z));
    if(vector.some(value=>!Number.isFinite(value)))throw new Error('Campo indefinido neste ponto.');
    return dimension===2?[...vector,0]:vector;
  };
  field.dimension=dimension;
  field.expressions=expressions;
  return field;
}
const norm=x=>Math.hypot(...x);
export function fieldDifferentials(field,point=[0,0,0]){
  if(!Array.isArray(point)||point.length!==3||!point.every(Number.isFinite))
    throw new Error('Ponto inválido para cálculo vetorial.');
  const value=field(...point);
  const step=point.map(x=>2e-4*Math.max(1,Math.abs(x)));
  const jacobian=Array.from({length:3},()=>[0,0,0]);
  for(let axis=0;axis<3;axis++){
    const plus=[...point],minus=[...point];
    plus[axis]+=step[axis];minus[axis]-=step[axis];
    const high=field(...plus),low=field(...minus);
    for(let i=0;i<3;i++)jacobian[i][axis]=(high[i]-low[i])/(2*step[axis]);
  }
  const divergence=jacobian[0][0]+jacobian[1][1]+jacobian[2][2];
  const curl=[jacobian[2][1]-jacobian[1][2],
    jacobian[0][2]-jacobian[2][0],
    jacobian[1][0]-jacobian[0][1]];
  return {point,value,jacobian,divergence,curl,method:'diferenças centrais'};
}
export function vectorFieldScene(field,{extent=2,count=5,scale=.6}={}){
  const bound=Math.max(.5,Math.min(5,Number(extent)||2));
  const n=Math.max(2,Math.min(7,Math.round(count)));
  const scene=[];
  const axis=Array.from({length:n},(_,i)=>-bound+2*bound*i/(n-1));
  const zz=field.dimension===2?[0]:axis;
  for(const x of axis)for(const y of axis)for(const z of zz){
    let v;
    try{v=field(x,y,z);}catch(_){continue;}
    const length=norm(v);
    if(!(length>1e-10))continue;
    const size=scale*Math.min(1,length);
    const from=[x,y,z],to=from.map((coordinate,i)=>coordinate+size*v[i]/length);
    scene.push({kind:'arrow',from,to,role:'main',color:'#328dc9',weight:1.6});
  }
  return scene;
}
export function lineIntegralCircle(field,{radius=1,steps=720}={}){
  if(!Number.isFinite(radius)||radius<=0||radius>20)throw new Error('Raio deve estar entre 0 e 20.');
  const n=Math.max(32,Math.min(4096,Math.round(steps)));
  const integrate=count=>{
    let sum=0;
    for(let i=0;i<count;i++){
      const t=2*Math.PI*(i+.5)/count,x=radius*Math.cos(t),y=radius*Math.sin(t);
      const f=field(x,y,0);
      sum+=(f[0]*(-radius*Math.sin(t))+f[1]*(radius*Math.cos(t)))*2*Math.PI/count;
    }
    return sum;
  };
  const value=integrate(n),coarse=integrate(Math.max(16,Math.floor(n/2)));
  return {value,errorEstimate:Math.abs(value-coarse),radius,steps:n,
    orientation:'anti-horária vista de +z',method:'quadratura do ponto médio'};
}
export function fluxThroughDisk(field,{radius=1,radialSteps=32,angularSteps=96}={}){
  if(!Number.isFinite(radius)||radius<=0||radius>20)throw new Error('Raio deve estar entre 0 e 20.');
  const integrate=(nr,na)=>{
    let total=0;
    for(let i=0;i<nr;i++){
      const r=radius*(i+.5)/nr;
      for(let j=0;j<na;j++){
        const theta=2*Math.PI*(j+.5)/na;
        total+=field(r*Math.cos(theta),r*Math.sin(theta),0)[2]
          *r*(radius/nr)*(2*Math.PI/na);
      }
    }
    return total;
  };
  const nr=Math.max(8,Math.min(128,radialSteps)),na=Math.max(16,Math.min(256,angularSteps));
  const value=integrate(nr,na),coarse=integrate(Math.floor(nr/2),Math.floor(na/2));
  return {value,errorEstimate:Math.abs(value-coarse),radius,
    orientation:'normal +z',method:'quadratura polar do ponto médio'};
}
