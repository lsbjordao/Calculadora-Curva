"use strict";

/**
 * Exact conic in an orthonormal coordinate system of the cutting plane.
 *
 * Cone: x²+y²=a²(z-d)²
 * Plane: cos(q)(z-d-h)-sin(q)(x cos(p)+y sin(p))=b|sin(q)|.
 *
 * Origin is the orthogonal projection of the cone vertex onto the plane.
 * In-plane coordinates (s,t): A s² + t² + B s + D = 0.
 *
 * This module contains no browser, DOM or renderer dependencies.
 */
const RAD=Math.PI/180;
const finite=x=>typeof x==='number'&&Number.isFinite(x);
const fmt=x=>Number(Math.abs(x)<1e-12?0:x.toPrecision(5));
const projection=(p,axis)=>p.reduce((sum,v,i)=>sum+v*axis[i],0);
const add=(u,v)=>u.map((x,i)=>x+v[i]);
const scaled=(v,s)=>v.map(x=>x*s);
export const classifyPlaneConic=(A,C,eps=1e-9)=>{
  if(Math.abs(C)<eps)return A< -eps?'two-lines':Math.abs(A)<=eps?'one-line':'vertex-point';
  if(Math.abs(A)<=eps)return 'parabola';
  return A<0?'hyperbola':'ellipse';
};
export function analyseConicSection(section){
  if(!section||!finite(section.h)||!finite(section.aperture)||section.aperture<=0) return null;
  const {h,aperture:a,vertexZ:d=0,azimuth:p=0}=section;
  // The legacy slope equation has no horizontal offset. New angular
  // sections expose b explicitly; keep older project files mathematically exact.
  const b=finite(section.angle)?(section.offset??.75):0;
  const angle=finite(section.angle)?section.angle:Math.atan(section.k||0)/RAD;
  if(![h,a,d,p,b,angle].every(finite))return null;
  const q=angle*RAD,cos=Math.abs(angle)===90?0:Math.cos(q),sin=Math.sin(q);
  const normal=[-sin*Math.cos(p),-sin*Math.sin(p),cos];
  const axisS=[cos*Math.cos(p),cos*Math.sin(p),sin];
  const axisT=[-Math.sin(p),Math.cos(p),0];
  const C=h*cos+b*Math.abs(sin);
  const vertex=[0,0,d];
  const origin=add(vertex,scaled(normal,C));
  const A=cos*cos-a*a*sin*sin;
  const B=-2*C*sin*cos*(1+a*a);
  const D=C*C*(sin*sin-a*a*cos*cos);
  const tolerance=1e-9*Math.max(1,Math.abs(A),Math.abs(B),Math.abs(D));
  let type=classifyPlaneConic(A,C,tolerance);
  if(type==='ellipse'&&Math.abs(sin)<1e-10)type='circle';
  const analysis={type,angle,aperture:a,vertexZ:d,azimuth:p,offset:b,h,
    origin,axisS,axisT,normal,A,B,D,C,coefficients:[A,0,1,B,0,D],
    planeEquation:'cos(q)(z−d−h) − sin(q)(x cos(p)+y sin(p)) = b |sin(q)|',
    equation:fmt(A)+'s² + t² '+(B<0?'− ':'+ ')+fmt(Math.abs(B))+'s '+(D<0?'− ':'+ ')+fmt(Math.abs(D))+' = 0',
    center:null,vertex:null,semiaxes:null,foci:[],eccentricity:null,asymptotes:null};
  if(Math.abs(C)<=tolerance){
    analysis.type=type;
    return analysis;
  }
  if(Math.abs(A)<=tolerance){
    // t² = -B(s - sVertex), equivalent to t² = 4f(s-sVertex).
    if(Math.abs(B)<=tolerance)return analysis;
    const sVertex=-D/B,focal=-B/4;
    analysis.vertex=[sVertex,0];
    analysis.foci=[[sVertex+focal,0]];
    analysis.focalLength=Math.abs(focal);
    analysis.eccentricity=1;
    analysis.canonical='t² = '+fmt(4*focal)+'(s − '+fmt(sVertex)+')';
    return analysis;
  }
  const s0=-B/(2*A),K=B*B/(4*A)-D;
  analysis.center=[s0,0];
  if(A>0&&K>0){
    const sAxis=Math.sqrt(K/A),tAxis=Math.sqrt(K);
    const major=Math.max(sAxis,tAxis),minor=Math.min(sAxis,tAxis);
    const alongS=sAxis>=tAxis,focusDistance=Math.sqrt(Math.max(0,major*major-minor*minor));
    analysis.semiaxes={s:sAxis,t:tAxis,major,minor};
    analysis.eccentricity=major?focusDistance/major:0;
    analysis.foci=alongS?[[s0-focusDistance,0],[s0+focusDistance,0]]:
      [[s0,-focusDistance],[s0,focusDistance]];
    analysis.canonical='(s − '+fmt(s0)+')²/'+fmt(sAxis*sAxis)+' + t²/'+fmt(tAxis*tAxis)+' = 1';
    return analysis;
  }
  if(A<0&&K<0){
    const real=Math.sqrt(K/A),conj=Math.sqrt(-K);
    const focusDistance=Math.hypot(real,conj);
    analysis.semiaxes={real,conjugate:conj,axis:'s'};
    analysis.eccentricity=focusDistance/real;
    analysis.foci=[[s0-focusDistance,0],[s0+focusDistance,0]];
    analysis.asymptotes=[conj/real,-conj/real];
    analysis.canonical='(s − '+fmt(s0)+')²/'+fmt(real*real)+' − t²/'+fmt(conj*conj)+' = 1';
    return analysis;
  }
  if(A<0&&K>0){
    const real=Math.sqrt(K),conj=Math.sqrt(-K/A);
    analysis.semiaxes={real,conjugate:conj,axis:'t'};
    analysis.eccentricity=Math.hypot(real,conj)/real;
    analysis.foci=[[s0,-Math.hypot(real,conj)],[s0,Math.hypot(real,conj)]];
    analysis.asymptotes=[real/conj,-real/conj];
    analysis.canonical='t²/'+fmt(real*real)+' − (s − '+fmt(s0)+')²/'+fmt(conj*conj)+' = 1';
  }
  return analysis;
}
export function worldToSection(point,analysis){
  const offset=point.map((v,i)=>v-analysis.origin[i]);
  return [projection(offset,analysis.axisS),projection(offset,analysis.axisT)];
}
export function sectionToWorld(st,analysis){
  return add(analysis.origin,add(scaled(analysis.axisS,st[0]),scaled(analysis.axisT,st[1])));
}
export function sectionCurves(geometry){
  if(geometry?.section?.kind==='function-levels')return geometry.section.analysis||null;
  if(geometry?.section?.kind==='quadric-plane')return geometry.section.analysis||null;
  if(geometry?.section?.kind==='implicit-plane')return geometry.section.analysis||null;
  const analysis=analyseConicSection(geometry?.section);
  if(!analysis)return null;
  const segments=(geometry.scene3d||[]).filter(p=>p.sectionCurve&&p.kind==='segment')
    .map(({a,b})=>({a:worldToSection(a,analysis),b:worldToSection(b,analysis)}));
  return {...analysis,segments};
}
export function conicMetricSummary(analysis){
  if(!analysis)return [];
  if(analysis.type==='level-curves')return [
    ['Tipo','Curvas de nível'],
    ['Níveis',analysis.levels?.map(fmt).join(', ')||''],
    ['Intervalo z',analysis.range?.map(fmt).join(' a ')||'']
  ];
  const info=[['Tipo',({
    circle:'Circunferência',ellipse:'Elipse',parabola:'Parábola',hyperbola:'Hipérbole',
    'two-lines':'Duas retas concorrentes','one-line':'Reta','vertex-point':'Ponto tangente',
    'parallel-lines':'Duas retas paralelas',empty:'Sem interseção real','all-plane':'Plano contido na superfície'
  })[analysis.type]||analysis.type]];
  if(analysis.center)info.push(['Centro (s,t)',analysis.center.map(fmt).join(', ')]);
  if(analysis.vertex)info.push(['Vértice (s,t)',analysis.vertex.map(fmt).join(', ')]);
  if(analysis.semiaxes){
    if(analysis.type==='ellipse'||analysis.type==='circle'){
      info.push(['Semieixo maior',fmt(analysis.semiaxes.major)],['Semieixo menor',fmt(analysis.semiaxes.minor)]);
    }else{
      info.push(['Semieixo real',fmt(analysis.semiaxes.real)],['Semieixo conjugado',fmt(analysis.semiaxes.conjugate)]);
    }
  }
  if(analysis.eccentricity!==null)info.push(['Excentricidade',fmt(analysis.eccentricity)]);
  if(analysis.foci.length)info.push(['Focos (s,t)',analysis.foci.map(p=>'('+p.map(fmt).join(', ')+')').join('; ')]);
  if(analysis.asymptotes)info.push(['Inclinações das assíntotas',analysis.asymptotes.map(fmt).join('; ')]);
  return info;
}
