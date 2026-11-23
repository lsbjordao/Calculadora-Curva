"use strict";

// Intersection of a standard quadric with an arbitrarily oriented plane.
// All coefficients and conic properties are computed in an orthonormal (s,t)
// basis of the plane. The finite contour mesh is for visualization only.
const RAD=Math.PI/180;
const dot=(a,b)=>a.reduce((s,x,i)=>s+x*b[i],0);
const plus=(a,b)=>a.map((x,i)=>x+b[i]);
const times=(a,k)=>a.map(x=>x*k);
const fmt=x=>String(Number(Math.abs(x)<1e-10?0:x.toPrecision(5)));
const valid=x=>typeof x==='number'&&Number.isFinite(x);
const planeTypes=new Set(['esfera','elipsoide','paraboloide','hiperboloide1','hiperboloide2','sela','cilindro']);
const xy=(p,u,v)=>[dot(p,u),dot(p,v)];

export function quadricPolynomial(type,{a=1,b=1,c=1,d=0}={}){
  if(!planeTypes.has(type))throw new Error('Tipo de quádrica desconhecido: '+type);
  if(![a,b,c,d].every(valid)||Math.min(a,b,c)<=0||Math.max(a,b,c)>20||Math.abs(d)>50)
    throw new Error('Escalas a, b, c positivas (até 20) e deslocamento d finito.');
  const X=1/(a*a),Y=1/(b*b),Z=1/(c*c);
  switch(type){
    case 'esfera':case 'elipsoide':
      return {diag:[X,Y,Z],linear:[0,0,-2*d*Z],constant:d*d*Z-1};
    case 'paraboloide':
      return {diag:[X,Y,0],linear:[0,0,-1/c],constant:d/c};
    case 'hiperboloide1':
      return {diag:[X,Y,-Z],linear:[0,0,2*d*Z],constant:-1-d*d*Z};
    case 'hiperboloide2':
      return {diag:[-X,-Y,Z],linear:[0,0,-2*d*Z],constant:d*d*Z-1};
    case 'sela':
      return {diag:[X,-Y,0],linear:[0,0,-1/c],constant:d/c};
    case 'cilindro':
      return {diag:[X,Y,0],linear:[0,0,0],constant:-1};
  }
}

export function sectionPlane({inclination=0,azimuth=0,offset=0}={}){
  if(![inclination,azimuth,offset].every(valid)||Math.abs(inclination)>90||Math.abs(offset)>50)
    throw new Error('Plano: inclinação entre −90° e 90° e distância de até 50.');
  const q=inclination*RAD,p=azimuth*RAD;
  const cq=Math.abs(inclination)===90?0:Math.cos(q),sq=Math.sin(q);
  const cp=Math.cos(p),sp=Math.sin(p);
  const normal=[-sq*cp,-sq*sp,cq];
  const axisS=[cq*cp,cq*sp,sq],axisT=[-sp,cp,0];
  const origin=times(normal,offset);
  return {normal,axisS,axisT,origin,offset,inclination,azimuth};
}

export function restrictQuadricToPlane(polynomial,plane){
  const {diag:q,linear:l,constant:f}=polynomial;
  const {origin:o,axisS:u,axisT:v}=plane;
  const quad=(a,b)=>a.reduce((s,x,i)=>s+x*q[i]*b[i],0);
  return {
    A:quad(u,u), B:2*quad(u,v), C:quad(v,v),
    D:2*quad(o,u)+dot(l,u), E:2*quad(o,v)+dot(l,v),
    F:quad(o,o)+dot(l,o)+f
  };
}

export const evaluatePlaneConic=(q,s,t)=>
  ((q.A*s+q.B*t+q.D)*s+(q.C*t+q.E)*t+q.F);

const fromBasis=(u,v,first,second)=>plus(times(u,first),times(v,second));
const linearTranslate=(p,delta)=>plus(p,delta);
const near=(x,tol)=>Math.abs(x)<=tol;

// Determine conic type and metrics from the full symmetric 2x2 quadratic
// form, including nonzero st term and degenerate sections.
export function analysePlaneQuadratic(q){
  const {A,B,C,D,E,F}=q;
  if(![A,B,C,D,E,F].every(valid))throw new Error('Coeficientes não finitos.');
  const size=Math.max(Math.abs(A),Math.abs(B),Math.abs(C),Math.abs(D),Math.abs(E),Math.abs(F),1e-12);
  const eps=1e-9*size;
  const theta=.5*Math.atan2(B,A-C);
  const u=[Math.cos(theta),Math.sin(theta)],v=[-Math.sin(theta),Math.cos(theta)];
  const radical=Math.hypot((A-C)/2,B/2);
  const l1=(A+C)/2+radical,l2=(A+C)/2-radical;
  const m1=dot([D,E],u),m2=dot([D,E],v);
  const result={type:'empty',coefficients:[A,B,C,D,E,F],equation:
    fmt(A)+'s² '+(B<0?'− ':'+ ')+fmt(Math.abs(B))+'st '+(C<0?'− ':'+ ')+fmt(Math.abs(C))+'t² '+
    (D<0?'− ':'+ ')+fmt(Math.abs(D))+'s '+(E<0?'− ':'+ ')+fmt(Math.abs(E))+'t '+
    (F<0?'− ':'+ ')+fmt(Math.abs(F))+' = 0',
    center:null,vertex:null,semiaxes:null,foci:[],eccentricity:null,asymptotes:null,
    rotation:theta*180/Math.PI,axes:[u,v],eigenvalues:[l1,l2],canonical:null};
  const both= !near(l1,eps)&&!near(l2,eps);
  if(both){
    const c1=-m1/(2*l1),c2=-m2/(2*l2),center=fromBasis(u,v,c1,c2);
    const K=-(F+m1*c1+m2*c2+l1*c1*c1+l2*c2*c2);
    result.center=center;
    if(l1*l2>0){
      if(near(K,eps)){result.type='vertex-point';result.vertex=center;return result;}
      if(K/l1<0){result.type='empty';result.center=null;return result;}
      const r1=Math.sqrt(K/l1),r2=Math.sqrt(K/l2);
      const major=Math.max(r1,r2),minor=Math.min(r1,r2);
      const dir=r1>=r2?u:v;
      const dist=Math.sqrt(Math.max(0,major*major-minor*minor));
      result.type=near(major-minor,1e-8*Math.max(1,major))?'circle':'ellipse';
      result.semiaxes={major,minor,s:r1,t:r2};
      result.foci=[plus(center,times(dir,-dist)),plus(center,times(dir,dist))];
      result.eccentricity=major?dist/major:0;
      result.canonical='u²/'+fmt(r1*r1)+' + v²/'+fmt(r2*r2)+' = 1';
      return result;
    }
    if(near(K,eps)){
      result.type='two-lines';
      result.asymptotes=[fromBasis(u,v,1,Math.sqrt(-l1/l2)),fromBasis(u,v,1,-Math.sqrt(-l1/l2))];
      return result;
    }
    const first=K/l1>0;
    const real=Math.sqrt(Math.abs(K/(first?l1:l2)));
    const conj=Math.sqrt(Math.abs(K/(first?l2:l1)));
    const dir=first?u:v;
    const dist=Math.hypot(real,conj);
    result.type='hyperbola';result.semiaxes={real,conjugate:conj,axis:first?'u':'v'};
    result.foci=[plus(center,times(dir,-dist)),plus(center,times(dir,dist))];
    result.eccentricity=dist/real;
    const slope=conj/real;
    result.asymptotes=first?
      [fromBasis(u,v,1,slope),fromBasis(u,v,1,-slope)]:
      [fromBasis(u,v,slope,1),fromBasis(u,v,-slope,1)];
    result.canonical=first?'u²/'+fmt(real*real)+' − v²/'+fmt(conj*conj)+' = 1':
      'v²/'+fmt(real*real)+' − u²/'+fmt(conj*conj)+' = 1';
    return result;
  }
  if(near(l1,eps)&&near(l2,eps)){
    if(Math.hypot(D,E)>eps){result.type='one-line';return result;}
    result.type=near(F,eps)?'all-plane':'empty';return result;
  }
  const along=near(l1,eps)?v:u,flat=near(l1,eps)?u:v;
  const lambda=near(l1,eps)?l2:l1;
  const mAlong=dot([D,E],along),mFlat=dot([D,E],flat);
  const along0=-mAlong/(2*lambda),K=F-mAlong*mAlong/(4*lambda);
  if(Math.abs(mFlat)>eps){
    const flat0=-K/mFlat,vertex=fromBasis(along,flat,along0,flat0);
    const focal=-mFlat/(4*lambda);
    result.type='parabola';result.vertex=vertex;
    result.foci=[plus(vertex,times(flat,focal))];
    result.focalLength=Math.abs(focal);
    result.eccentricity=1;
    result.canonical='u² = '+fmt(4*focal)+'v';
    return result;
  }
  const val=-K/lambda;
  if(near(val,eps)){result.type='one-line';return result;}
  result.type=val>0?'parallel-lines':'empty';
  return result;
}

// Marching squares on a bounded local plane.  Ambiguous saddle cells use
// the centre sign rather than connecting arbitrary diagonals.
export function samplePlaneConic(q,{extent=8,resolution=110}={}){
  const n=Math.max(32,Math.min(220,Math.round(resolution)));
  const span=Math.max(1,Math.min(50,extent));
  const step=2*span/n,segments=[];
  const grid=Array.from({length:n+1},(_,j)=>Array.from({length:n+1},(_,i)=>
    evaluatePlaneConic(q,-span+i*step,-span+j*step)));
  const interp=(a,b,fa,fb)=>{
    const t=Math.abs(fa-fb)<1e-14?.5:fa/(fa-fb);
    return [a[0]+t*(b[0]-a[0]),a[1]+t*(b[1]-a[1])];
  };
  for(let j=0;j<n;j++)for(let i=0;i<n;i++){
    const x=-span+i*step,y=-span+j*step;
    const p=[[x,y],[x+step,y],[x+step,y+step],[x,y+step]];
    const f=[grid[j][i],grid[j][i+1],grid[j+1][i+1],grid[j+1][i]];
    const hits=[];
    for(let edge=0;edge<4;edge++){
      const next=(edge+1)%4;
      if((f[edge]<0)!==(f[next]<0))hits.push({edge,p:interp(p[edge],p[next],f[edge],f[next])});
    }
    if(hits.length===2)segments.push({a:hits[0].p,b:hits[1].p});
    else if(hits.length===4){
      const mid=evaluatePlaneConic(q,x+step/2,y+step/2);
      const same=(mid<0)===(f[0]<0);
      const pairs=same?[[0,1],[2,3]]:[[0,3],[1,2]];
      for(const [a,b] of pairs)segments.push({a:hits[a].p,b:hits[b].p});
    }
  }
  return segments;
}

export function quadricPlaneSection(type,params={},planeParams={}){
  const poly=quadricPolynomial(type,params),plane=sectionPlane(planeParams);
  const q=restrictQuadricToPlane(poly,plane);
  const analysis=analysePlaneQuadratic(q);
  const base=Math.max(params.a??1,params.b??1,params.c??1,1);
  const extent=Math.min(28,Math.max(5,base*3.3,Math.abs(plane.offset)*1.5+base*2));
  const segments=samplePlaneConic(q,{extent});
  const toWorld=st=>plus(plane.origin,plus(times(plane.axisS,st[0]),times(plane.axisT,st[1])));
  return {
    ...analysis, ...plane,
    coefficients:analysis.coefficients,
    segments,worldSegments:segments.map(({a,b})=>({a:toWorld(a),b:toWorld(b)})),
    toWorld,quadricType:type
  };
}
