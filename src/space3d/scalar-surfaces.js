"use strict";
// Scalar graphs z=f(x,y): numerical multivariable calculus and level curves.
// Supports general differentiable expressions accepted by the Curva parser.
import {compileXyz} from './implicit-quadric.js';

const vlen=x=>Math.hypot(...x);
const round=x=>Number(x.toPrecision(6));
const clamp=(x,a,b)=>Math.min(b,Math.max(a,x));
export function compileScalarSurface(raw,params={}){
  const src=String(raw||'').trim();
  const match=src.match(/^z\s*=\s*([\s\S]+)$/i)||src.match(/^([\s\S]+?)\s*=\s*z$/i);
  if(!match)throw new Error('Para uma função de duas variáveis, use superficie: z = f(x,y).');
  const expr=match[1].trim();
  if(!expr)throw new Error('Função f(x,y) vazia.');
  const f3=compileXyz(expr,params);
  for(const [x,y] of [[0,0],[1.2,-.7],[-1.1,1.4]]){
    if(Math.abs(f3(x,y,0)-f3(x,y,1))>1e-8)
      throw new Error('A expressão f(x,y) não pode depender de z.');
  }
  return {expr,at:(x,y)=>f3(x,y,0)};
}
function numeric(fn,x,y,dx=1e-3){
  const h=dx*Math.max(1,Math.abs(x),Math.abs(y));
  const z=fn(x,y),xp=fn(x+h,y),xm=fn(x-h,y),
    yp=fn(x,y+h),ym=fn(x,y-h);
  const fx=(xp-xm)/(2*h),fy=(yp-ym)/(2*h);
  const fxx=(xp-2*z+xm)/(h*h),fyy=(yp-2*z+ym)/(h*h);
  const fxy=(fn(x+h,y+h)-fn(x+h,y-h)-fn(x-h,y+h)+fn(x-h,y-h))/(4*h*h);
  return {z,fx,fy,fxx,fyy,fxy};
}
export function multivariateAt(fn,x=0,y=0,angle=0){
  if(![x,y].every(Number.isFinite))throw new Error('Ponto de cálculo inválido.');
  const d=numeric(fn,x,y),point=[x,y,d.z];
  const gradient=[d.fx,d.fy],rawNormal=[-d.fx,-d.fy,1],norm=vlen(rawNormal);
  const radians=angle*Math.PI/180,direction=[Math.cos(radians),Math.sin(radians)];
  const directionalDerivative=gradient[0]*direction[0]+gradient[1]*direction[1];
  const normal=rawNormal.map(a=>a/norm);
  const hessian=[[d.fxx,d.fxy],[d.fxy,d.fyy]];
  const det=d.fxx*d.fyy-d.fxy*d.fxy;
  const eps=.002*Math.max(1,Math.abs(d.fxx),Math.abs(d.fyy),Math.abs(d.fxy));
  const critical=vlen(gradient)<1e-3;
  const kind=det>eps?(d.fxx>0?'mínimo local':'máximo local'):det< -eps?'ponto de sela':'inconclusivo';
  return {point,gradient,normal,hessian,detHessian:det,direction,directionalDerivative,angle,
    tangentOffset:normal.reduce((a,b,i)=>a+b*point[i],0),
    critical,criticalType:critical?kind:null,
    derivatives:d};
}
export function findStationaryPoints(fn,{extent=4}={}){
  const roots=[];
  for(const x0 of [-extent*.75,-extent*.35,0,extent*.35,extent*.75]){
    for(const y0 of [-extent*.75,-extent*.35,0,extent*.35,extent*.75]){
      let x=x0,y=y0;
      for(let k=0;k<18;k++){
        let d;
        try{d=numeric(fn,x,y);}catch(_){break;}
        const det=d.fxx*d.fyy-d.fxy*d.fxy;
        if(Math.abs(det)<1e-7)break;
        const dx=(d.fyy*d.fx-d.fxy*d.fy)/det;
        const dy=(-d.fxy*d.fx+d.fxx*d.fy)/det;
        const reduction=Math.min(1,1.5/(Math.max(Math.abs(dx),Math.abs(dy),1e-12)));
        x-=dx*reduction;y-=dy*reduction;
        if(Math.abs(x)>extent||Math.abs(y)>extent)break;
        if(Math.hypot(dx,dy)<1e-6)break;
      }
      if(Math.abs(x)>extent||Math.abs(y)>extent)continue;
      try{
        const at=multivariateAt(fn,x,y);
        if(!at.critical||roots.some(p=>Math.hypot(p.point[0]-x,p.point[1]-y)<.05))continue;
        roots.push({...at,criticalType:at.criticalType});
      }catch(_){}
    }
  }
  return roots.slice(0,16);
}
const lerp=(a,b,fa,fb)=>{
  const t=Math.abs(fa-fb)<1e-13?.5:fa/(fa-fb);
  return a.map((x,i)=>x+t*(b[i]-x));
};
export function sampleLevelContours(fn,{extent=4,resolution=65,levels=null}={}){
  const n=Math.max(24,Math.min(140,Math.round(resolution)));
  const step=2*extent/n;
  const values=Array.from({length:n+1},(_,i)=>Array.from({length:n+1},(_,j)=>{
    const x=-extent+i*step,y=-extent+j*step;
    try{return fn(x,y);}catch(_){return NaN;}
  }));
  const finite=values.flat().filter(Number.isFinite),lo=Math.min(...finite),hi=Math.max(...finite);
  if(!finite.length)return {segments:[],levels:[]};
  const list=levels||Array.from({length:9},(_,i)=>lo+(hi-lo)*(i+1)/10);
  const segments=[];
  for(const [index,level] of list.entries()){
    for(let i=0;i<n;i++)for(let j=0;j<n;j++){
      const x=-extent+i*step,y=-extent+j*step;
      const p=[[x,y],[x+step,y],[x+step,y+step],[x,y+step]];
      const f=[values[i][j],values[i+1][j],values[i+1][j+1],values[i][j+1]];
      if(!f.every(Number.isFinite))continue;
      const hit=[];
      for(let e=0;e<4;e++){
        const next=(e+1)%4;
        if((f[e]<level)!==(f[next]<level))
          hit.push({edge:e,p:lerp(p[e],p[next],f[e]-level,f[next]-level)});
      }
      if(hit.length===2)segments.push({a:hit[0].p,b:hit[1].p,level,index});
      else if(hit.length===4){
        const center=fn(x+step/2,y+step/2);
        const match=(center<level)===(f[0]<level);
        for(const [a,b] of match?[[0,1],[2,3]]:[[0,3],[1,2]])
          segments.push({a:hit[a].p,b:hit[b].p,level,index});
      }
    }
  }
  return {segments,levels:list.map(round),range:[lo,hi]};
}
export function scalarSurfaceScene(raw,params={},opts={}){
  const {expr,at:fn}=compileScalarSurface(raw,params);
  const extent=Number.isFinite(opts.extent)?clamp(opts.extent,2,12):4;
  const n=40,step=extent*2/n,vertices=[],faces=[];
  for(let i=0;i<=n;i++)for(let j=0;j<=n;j++){
    const x=-extent+i*step,y=-extent+j*step;
    let z;try{z=fn(x,y);}catch(_){z=NaN;}
    vertices.push([x,y,Number.isFinite(z)&&Math.abs(z)<60?z:NaN]);
  }
  for(let i=0;i<n;i++)for(let j=0;j<n;j++){
    const a=i*(n+1)+j,b=a+1,c=a+n+1,d=c+1;
    if([a,b,c,d].some(k=>!Number.isFinite(vertices[k][2])))continue;
    if(Math.max(...[a,b,c,d].map(k=>vertices[k][2]))-Math.min(...[a,b,c,d].map(k=>vertices[k][2]))>20)continue;
    faces.push([a,c,d],[a,d,b]);
  }
  const px=clamp(Number.isFinite(opts.x)?opts.x:0,-extent,extent),
    py=clamp(Number.isFinite(opts.y)?opts.y:0,-extent,extent);
  const calc=multivariateAt(fn,px,py,opts.direction||0);
  const critical=findStationaryPoints(fn,{extent});
  const levels=sampleLevelContours(fn,{extent});
  // Invalid domain vertices are entirely excluded from the render mesh;
  // one undefined z must not invalidate the whole WebGL surface.
  const validVertices=[],validFaces=[],indexMap=new Map();
  for(const face of faces){
    const next=face.map(idx=>{
      if(!indexMap.has(idx)){indexMap.set(idx,validVertices.length);validVertices.push(vertices[idx]);}
      return indexMap.get(idx);
    });
    validFaces.push(next);
  }
  const point=calc.point,vectorTo=point.map((v,i)=>v+calc.normal[i]*1.2);
  const unit=calc.direction,endpoint=[point[0]+unit[0],point[1]+unit[1],
    point[2]+calc.directionalDerivative];
  const scene=[
    {kind:'mesh',vertices:validVertices,faces:validFaces,alpha:.75,color:'#3c98b0',scalarSurface:true},
    {kind:'plane',n:calc.normal,d:calc.tangentOffset,alpha:.26,color:'#efba43'},
    {kind:'point',p:point,color:'#e44780',label:'P'},
    {kind:'arrow',from:point,to:vectorTo,color:'#e44780',weight:2.5},
    {kind:'arrow',from:point,to:endpoint,color:'#e0a33f',weight:2.5,label:'Dᵥf'},
    ...critical.map((root,i)=>({kind:'point',p:root.point,label:'C'+(i+1),color:'#33bc85'}))
  ];
  const analysis={kind:'level-curves',type:'level-curves',
    canonical:'Curvas de nível de z = '+expr,equation:'z = '+expr,
    center:null,vertex:null,foci:[],semiaxes:null,eccentricity:null,asymptotes:null,
    ...levels,origin:[0,0,0],axisS:[1,0,0],axisT:[0,1,0],normal:[0,0,1],
    toWorld:local=>[local[0],local[1],fn(local[0],local[1])]};
  return {expr,fn,scene,calc,critical,levels:analysis,extent,mesh:{vertices:validVertices,faces:validFaces}};
}
