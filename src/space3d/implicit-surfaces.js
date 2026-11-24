"use strict";
// Malhas e seções APROXIMADAS para F(x,y,z)=0 não quadrática.
// Sem classificação analítica: nenhuma propriedade focal é inferida da malha.
import {compileXyz} from './implicit-quadric.js';
import {planeBasis} from './implicit-quadric.js';

const TETS=[[0,5,1,6],[0,1,2,6],[0,2,3,6],[0,3,7,6],[0,7,4,6],[0,4,5,6]];
const CORNERS=[[0,0,0],[1,0,0],[1,1,0],[0,1,0],[0,0,1],[1,0,1],[1,1,1],[0,1,1]];

export function compileImplicitSurface(raw,params={}){
  const sides=String(raw||'').split('=').map(text=>text.trim());
  if(sides.length!==2||sides.some(x=>!x))
    throw new Error('Superfície implícita: use F(x,y,z) = G(x,y,z).');
  const a=compileXyz(sides[0],params),b=compileXyz(sides[1],params);
  return (x,y,z)=>a(x,y,z)-b(x,y,z);
}
const safeValue=(fn,x,y,z)=>{
  try{const v=fn(x,y,z);return Number.isFinite(v)?v:NaN;}
  catch(_){return NaN;}
};
const interpolate=(a,b,fa,fb)=>{
  const denom=fa-fb;
  const t=Math.abs(denom)<1e-14?.5:Math.max(0,Math.min(1,fa/denom));
  return a.map((v,i)=>v+(b[i]-v)*t);
};
export function meshImplicitFunction(fn,{extent=4,resolution=24,maxFaces=60000}={}){
  if(typeof fn!=='function')throw new TypeError('Função implícita inválida.');
  const bound=Math.max(.5,Math.min(20,Number(extent)||4));
  const n=Math.max(10,Math.min(42,Math.round(resolution)));
  const m=n+1,step=2*bound/n,values=new Float64Array(m*m*m);
  const index=(i,j,k)=>(i*m+j)*m+k;
  for(let i=0;i<=n;i++)for(let j=0;j<=n;j++)for(let k=0;k<=n;k++)
    values[index(i,j,k)]=safeValue(fn,-bound+i*step,-bound+j*step,-bound+k*step);
  const vertices=[],faces=[];
  const emit=(a,b,c)=>{
    if(![...a,...b,...c].every(Number.isFinite)||faces.length>=maxFaces)return;
    const first=vertices.length;vertices.push(a,b,c);faces.push([first,first+1,first+2]);
  };
  for(let i=0;i<n;i++)for(let j=0;j<n;j++)for(let k=0;k<n;k++){
    if(faces.length>=maxFaces)break;
    const p=CORNERS.map(([di,dj,dk])=>[-bound+(i+di)*step,-bound+(j+dj)*step,-bound+(k+dk)*step]);
    const f=CORNERS.map(([di,dj,dk])=>values[index(i+di,j+dj,k+dk)]);
    if(!f.every(Number.isFinite)||Math.min(...f)>0||Math.max(...f)<0)continue;
    for(const tet of TETS){
      const inside=tet.filter(j=>f[j]<0),outside=tet.filter(j=>f[j]>=0);
      if(!inside.length||!outside.length)continue;
      const edge=(a,b)=>interpolate(p[a],p[b],f[a],f[b]);
      if(inside.length===1)emit(...outside.map(j=>edge(inside[0],j)));
      else if(outside.length===1)emit(...inside.map(j=>edge(outside[0],j)));
      else{
        const a=edge(inside[0],outside[0]),b=edge(inside[0],outside[1]),
          c=edge(inside[1],outside[0]),d=edge(inside[1],outside[1]);
        emit(a,b,c);emit(b,d,c);
      }
    }
  }
  return {vertices,faces,extent:bound,resolution:n,approximate:true,
    truncated:faces.length>=maxFaces};
}
export function sampleImplicitPlane(fn,rawPlane,{extent=5,resolution=110}={}){
  const plane=planeBasis(rawPlane),n=Math.max(24,Math.min(180,Math.round(resolution)));
  const bound=Math.max(.5,Math.min(25,extent)),step=2*bound/n;
  const toWorld=st=>plane.origin.map((v,i)=>v+st[0]*plane.axisS[i]+st[1]*plane.axisT[i]);
  const sample=(s,t)=>safeValue(fn,...toWorld([s,t]));
  const values=Array.from({length:n+1},(_,i)=>Array.from({length:n+1},(_,j)=>
    sample(-bound+i*step,-bound+j*step)));
  const segments=[],corners=[[0,0],[1,0],[1,1],[0,1]];
  for(let i=0;i<n;i++)for(let j=0;j<n;j++){
    const p=corners.map(([di,dj])=>[-bound+(i+di)*step,-bound+(j+dj)*step]);
    const f=[values[i][j],values[i+1][j],values[i+1][j+1],values[i][j+1]];
    if(!f.every(Number.isFinite))continue;
    const crossings=[];
    for(let e=0;e<4;e++){
      const next=(e+1)%4;
      if((f[e]<0)!==(f[next]<0))crossings.push({edge:e,p:interpolate(p[e],p[next],f[e],f[next])});
    }
    if(crossings.length===2)segments.push({a:crossings[0].p,b:crossings[1].p});
    else if(crossings.length===4){
      const centre=sample(-bound+(i+.5)*step,-bound+(j+.5)*step);
      const same=(centre<0)===(f[0]<0);
      for(const [a,b] of same?[[0,1],[2,3]]:[[0,3],[1,2]])
        segments.push({a:crossings[a].p,b:crossings[b].p});
    }
  }
  return {...plane,type:'implicit-approximate',equation:'F(s,t) = 0 (amostrada)',
    canonical:'Seção aproximada por amostragem',segments,
    worldSegments:segments.map(({a,b})=>({a:toWorld(a),b:toWorld(b)})),
    toWorld,approximate:true,foci:[],eccentricity:null};
}
