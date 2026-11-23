"use strict";

// General quadratic surfaces in R³: Q(x)=xᵀMx+lᵀx+k.
// All coefficients are recovered from the original expression and validated
// against independent points. Surface meshes do not determine classification.
import {compile,setImplicitY} from '../parser.js';
import {analysePlaneQuadratic,samplePlaneConic} from './quadric-sections.js';

const dot=(a,b)=>a.reduce((sum,x,i)=>sum+x*b[i],0);
const sum=(a,b)=>a.map((x,i)=>x+b[i]);
const scale=(a,k)=>a.map(x=>x*k);
const fmt=x=>String(Number((Math.abs(x)<1e-10?0:x).toPrecision(5)));
const finite=a=>a.every(Number.isFinite);
const TYPES=['x','y','z'];
const canonical=raw=>String(raw).trim()
  .replace(/([xyz])([xyz])/gi,'$1*$2')
  .replace(/\u00d7/g,'*');
export function compileXyz(raw,params={}){
  const source=canonical(raw).replace(/[A-Za-z\u03c0][A-Za-z0-9\u03c0]*/g,name=>name.toLowerCase()==='z'?'@z':name);
  let zValue=0;
  const fn=compile(source,params,{},name=>{
    if(name==='z')return zValue;
    throw new Error('Símbolo não definido na superfície: @'+name);
  });
  if(!fn)throw new Error('Equação vazia de superfície.');
  return (x,y,z)=>{
    setImplicitY(y);zValue=z;
    const v=fn(x);
    if(typeof v!=='number'||!Number.isFinite(v))throw new Error('Equação de superfície não definida neste domínio.');
    return v;
  };
}
export function generalQuadricFromEquation(raw,params={}){
  const sides=String(raw||'').split('=').map(x=>x.trim());
  if(sides.length!==2||sides.some(s=>!s))
    throw new Error('Superfície: use uma equação em x, y, z, por exemplo x²+y²+z²=9.');
  const l=compileXyz(sides[0],params),r=compileXyz(sides[1],params);
  const f=(x,y,z)=>l(x,y,z)-r(x,y,z);
  const origin=f(0,0,0),linear=[],m=[[0,0,0],[0,0,0],[0,0,0]];
  const at=p=>f(...p);
  const up=[],down=[];
  for(let i=0;i<3;i++){
    const p=[0,0,0];p[i]=1;up[i]=at(p);p[i]=-1;down[i]=at(p);
    linear[i]=(up[i]-down[i])/2;
    m[i][i]=(up[i]+down[i])/2-origin;
  }
  for(let i=0;i<3;i++)for(let j=i+1;j<3;j++){
    const p=[0,0,0];p[i]=p[j]=1;
    m[i][j]=m[j][i]=(at(p)-up[i]-up[j]+origin)/2;
  }
  const polynomial={matrix:m,linear,constant:origin,source:raw};
  const magnitude=Math.max(1,...linear.map(Math.abs),Math.abs(origin),...m.flat().map(Math.abs));
  if(!finite(linear)||!finite(m.flat()))throw new Error('Coeficientes não finitos.');
  for(const p of [[1.2,-.7,2.1],[-2.2,.9,-1.1],[.6,1.7,-.8],[2.3,1.4,2],[-1,-1.3,2.4]]){
    const measured=at(p),predicted=evaluateQuadric(polynomial,p);
    if(Math.abs(measured-predicted)>2e-7*magnitude*Math.max(1,...p.map(x=>x*x)))
      throw new Error('A equação deve ser quadrática em x, y e z (grau máximo 2).');
  }
  if(Math.max(...m.flat().map(Math.abs),...linear.map(Math.abs))<1e-11*magnitude)
    throw new Error('A equação não define uma superfície de dimensão 2.');
  return polynomial;
}

export function evaluateQuadric(poly,p){
  const {matrix:m,linear:l,constant:k}=poly;
  return k+dot(l,p)+dot(p,m.map(row=>dot(row,p)));
}
export function quadricGradient(poly,p){
  return poly.matrix.map((row,i)=>2*dot(row,p)+poly.linear[i]);
}
export function quadricHessian(poly){
  return poly.matrix.map(row=>row.map(x=>2*x));
}

// Jacobi diagonalization for real symmetric 3x3 matrices; eigenvectors are
// columns, returned as normalized vectors in the world reference system.
export function diagonalizeSymmetric3(matrix){
  const a=matrix.map(r=>[...r]),v=[[1,0,0],[0,1,0],[0,0,1]];
  if(a.length!==3||a.some(r=>r.length!==3)||!finite(a.flat()))
    throw new Error('Matriz simétrica 3×3 inválida.');
  for(let i=0;i<3;i++)for(let j=i+1;j<3;j++)
    if(Math.abs(a[i][j]-a[j][i])>1e-9*Math.max(1,Math.abs(a[i][j])))
      throw new Error('Matriz não simétrica.');
  for(let iter=0;iter<48;iter++){
    let p=0,q=1;
    for(const [i,j] of [[0,1],[0,2],[1,2]])if(Math.abs(a[i][j])>Math.abs(a[p][q]))[p,q]=[i,j];
    if(Math.abs(a[p][q])<1e-13*Math.max(1,...a.map((r,i)=>Math.abs(r[i]))))break;
    const t0=(a[q][q]-a[p][p])/(2*a[p][q]);
    const t=Math.sign(t0||1)/(Math.abs(t0)+Math.sqrt(1+t0*t0));
    const c=1/Math.sqrt(1+t*t),s=t*c,apq=a[p][q];
    a[p][p]-=t*apq;a[q][q]+=t*apq;a[p][q]=a[q][p]=0;
    for(let i=0;i<3;i++){
      if(i!==p&&i!==q){
        const x=a[i][p],y=a[i][q];
        a[i][p]=a[p][i]=c*x-s*y;
        a[i][q]=a[q][i]=s*x+c*y;
      }
      const x=v[i][p],y=v[i][q];
      v[i][p]=c*x-s*y;v[i][q]=s*x+c*y;
    }
  }
  return [0,1,2].map(i=>({value:a[i][i],vector:v.map(row=>row[i])}))
    .sort((x,y)=>Math.abs(y.value)-Math.abs(x.value));
}
export function analyseGeneralQuadric(poly){
  const eigen=diagonalizeSymmetric3(poly.matrix),values=eigen.map(e=>e.value);
  const magn=Math.max(1,...values.map(Math.abs)),tol=1e-9*magn;
  const positives=values.filter(v=>v>tol).length,negatives=values.filter(v=>v< -tol).length;
  const rank=positives+negatives;
  const linearRotated=eigen.map(e=>dot(e.vector,poly.linear));
  let center=[0,0,0],constant=poly.constant,affineNull=false;
  for(let i=0;i<3;i++){
    const lambda=values[i],g=linearRotated[i];
    if(Math.abs(lambda)>tol){
      const shifted=-g/(2*lambda);
      center=sum(center,scale(eigen[i].vector,shifted));
      constant-=g*g/(4*lambda);
    }else if(Math.abs(g)>1e-8*magn)affineNull=true;
  }
  const rhs=-constant,zero=Math.abs(rhs)<=1e-8*magn;
  let type='Superfície degenerada';
  if(affineNull){
    if(rank===2)type=positives===2||negatives===2?'Paraboloide elíptico':'Paraboloide hiperbólico (sela)';
    else if(rank===1)type='Cilindro parabólico';
    else type='Plano';
  }else if(rank===3){
    if(positives===3||negatives===3){
      type=zero?'Ponto isolado':rhs*values[0]>0?'Elipsoide':'Sem pontos reais';
    }else if(zero)type='Cone quadrático';
    else{
      const majoritySign=positives===2?1:-1;
      type=rhs*majoritySign>0?'Hiperboloide de uma folha':'Hiperboloide de duas folhas';
    }
  }else if(rank===2){
    if(positives===2||negatives===2)
      type=zero?'Reta (degenerada)':rhs*values[0]>0?'Cilindro elíptico':'Sem pontos reais';
    else type=zero?'Dois planos concorrentes':'Cilindro hiperbólico';
  }else if(rank===1){
    type=zero?'Plano duplo':rhs*values[0]>0?'Dois planos paralelos':'Sem pontos reais';
  }else type='Plano ou conjunto vazio';
  return {type,rank,signature:[positives,negatives,3-rank],eigen,center,
    reducedConstant:constant,affineNull,hasRealSurface:type!=='Sem pontos reais'};
}

function visibleBound(poly,analysis){
  const values=analysis.eigen.map(x=>Math.abs(x.value)).filter(v=>v>1e-7);
  const smallest=values.length?Math.min(...values):1;
  const radius=Math.sqrt(Math.abs(analysis.reducedConstant)/smallest);
  const c=Math.max(...analysis.center.map(Math.abs));
  return Math.max(3,Math.min(16,Math.max(Number.isFinite(radius)?radius*1.45:4,c+3,4)));
}

// Decomposes each active cube into six tetrahedra; interpolation is linear
// within a cell, while classification remains exact and independent of mesh.
const TETS=[[0,5,1,6],[0,1,2,6],[0,2,3,6],[0,3,7,6],[0,7,4,6],[0,4,5,6]];
const CORNERS=[[0,0,0],[1,0,0],[1,1,0],[0,1,0],[0,0,1],[1,0,1],[1,1,1],[0,1,1]];
export function meshImplicitQuadric(poly,{extent=null,resolution=24}={}){
  const analysis=analyseGeneralQuadric(poly);
  const bound=Number.isFinite(extent)&&extent>0?Math.min(30,extent):visibleBound(poly,analysis);
  const n=Math.max(12,Math.min(38,Math.round(resolution))),step=2*bound/n;
  const gridSize=n+1,values=new Float64Array(gridSize**3);
  const gi=(i,j,k)=>(i*gridSize+j)*gridSize+k;
  for(let i=0;i<=n;i++)for(let j=0;j<=n;j++)for(let k=0;k<=n;k++)
    values[gi(i,j,k)]=evaluateQuadric(poly,[-bound+i*step,-bound+j*step,-bound+k*step]);
  const vertices=[],faces=[];
  const emit=(a,b,c)=>{
    if(![...a,...b,...c].every(Number.isFinite))return;
    const idx=vertices.length;vertices.push(a,b,c);faces.push([idx,idx+1,idx+2]);
  };
  for(let i=0;i<n;i++)for(let j=0;j<n;j++)for(let k=0;k<n;k++){
    const points=CORNERS.map(([di,dj,dk])=>[-bound+(i+di)*step,-bound+(j+dj)*step,-bound+(k+dk)*step]);
    const f=CORNERS.map(([di,dj,dk])=>values[gi(i+di,j+dj,k+dk)]);
    if(Math.min(...f)>0||Math.max(...f)<0)continue;
    for(const tetra of TETS){
      const inside=tetra.filter(a=>f[a]<0),outside=tetra.filter(a=>f[a]>=0);
      if(!inside.length||!outside.length)continue;
      const edge=(a,b)=>{
        const fa=f[a],fb=f[b],t=Math.abs(fa-fb)<1e-15?.5:fa/(fa-fb);
        return points[a].map((v,h)=>v+(points[b][h]-v)*t);
      };
      if(inside.length===1){
        emit(...outside.map(o=>edge(inside[0],o)));
      }else if(outside.length===1){
        emit(...inside.map(a=>edge(outside[0],a)));
      }else{
        const a=edge(inside[0],outside[0]),b=edge(inside[0],outside[1]),
          c=edge(inside[1],outside[0]),d=edge(inside[1],outside[1]);
        emit(a,b,c);emit(b,d,c);
      }
    }
  }
  return {vertices,faces,extent:bound,resolution:n,analysis};
}
export function planeBasis({n,d}){
  const magnitude=Math.hypot(...n);
  if(!(magnitude>1e-12)||!Number.isFinite(d))throw new Error('Plano secante inválido.');
  const normal=n.map(x=>x/magnitude),origin=scale(normal,d/magnitude);
  const other=Math.abs(normal[2])<.85?[0,0,1]:[0,1,0];
  const cross=(a,b)=>[a[1]*b[2]-a[2]*b[1],a[2]*b[0]-a[0]*b[2],a[0]*b[1]-a[1]*b[0]];
  const raw=cross(other,normal),l=Math.hypot(...raw);
  const axisS=scale(raw,1/l),axisT=cross(normal,axisS);
  return {origin,normal,axisS,axisT,offset:d/magnitude};
}
export function restrictGeneralQuadric(poly,plane){
  const {origin:o,axisS:u,axisT:v}=plane,{matrix:m,linear:l,constant:k}=poly;
  const bil=(a,b)=>dot(a,m.map(row=>dot(row,b)));
  return {A:bil(u,u),B:2*bil(u,v),C:bil(v,v),
    D:2*bil(o,u)+dot(l,u),E:2*bil(o,v)+dot(l,v),F:bil(o,o)+dot(l,o)+k};
}
export function intersectGeneralQuadricPlane(poly,rawPlane,{extent=10,resolution=130}={}){
  const plane=planeBasis(rawPlane),q=restrictGeneralQuadric(poly,plane);
  const analysis=analysePlaneQuadratic(q);
  const segments=samplePlaneConic(q,{extent,resolution});
  const toWorld=st=>sum(plane.origin,sum(scale(plane.axisS,st[0]),scale(plane.axisT,st[1])));
  return {...analysis,...plane,segments,worldSegments:segments.map(({a,b})=>({a:toWorld(a),b:toWorld(b)})),
    toWorld,quadricType:'general',coefficients:analysis.coefficients};
}

// Clips triangle meshes to a half-space without modifying their source.
// Side +1 keeps n·p >= d, -1 keeps n·p <= d.
export function clipTriangleMesh(mesh,plane,side=1){
  const vertices=[],faces=[],n=plane.n,d=plane.d;
  const value=p=>side*(dot(n,p)-d),eps=1e-8*Math.max(1,Math.abs(d));
  for(const face of mesh.faces||[]){
    const ring=face.map(i=>mesh.vertices[i]);
    if(ring.some(p=>!p))continue;
    let out=[];
    for(let i=0;i<ring.length;i++){
      const a=ring[i],b=ring[(i+1)%ring.length],fa=value(a),fb=value(b);
      const ia=fa>=-eps,ib=fb>=-eps;
      if(ia)out.push(a);
      if(ia!==ib){
        const t=fa/(fa-fb);
        out.push(a.map((x,j)=>x+(b[j]-x)*t));
      }
    }
    if(out.length<3)continue;
    const first=vertices.length;
    vertices.push(...out);
    for(let i=1;i<out.length-1;i++)faces.push([first,first+i,first+i+1]);
  }
  return {...mesh,vertices,faces};
}
