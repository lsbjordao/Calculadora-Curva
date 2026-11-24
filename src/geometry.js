"use strict";

import { compile, setImplicitY, splitTop } from './parser.js';
import { det as matrixDet, trace as matrixTrace, eiginfo, dot as algebraDot, norm as algebraNorm, angle as algebraAngle, proj as algebraProjection, validateMatrix } from './linear-algebra.js';
import { wants3d, parse3dCommand, parseUnprefixed3d, matrix3Result } from './space3d/geometry3d.js';
import { analysePlaneQuadratic } from './space3d/quadric-sections.js';

const EPS=1e-9;
const GEOMETRY_PARAM_NAMES=new Set(['a','b','c','d','h','k','m','n','p','q','r','u','v']);

const COMMAND_ALIASES={
  point:'point', points:'point', ponto:'point', pontos:'point',
  vector:'vector', vetor:'vector', vetores:'vector',
  angle:'angle', angulo:'angle',
  dot:'dot', produto:'dot', escalar:'dot', produtoescalar:'dot',
  projection:'projection', projecao:'projection', proj:'projection',
  triangle:'triangle', triangulo:'triangle', triangulos:'triangle',
  quadrilateral:'quadrilateral', quadrilatero:'quadrilateral', quadrilateros:'quadrilateral',
  polygon:'polygon', polygons:'polygon', poligono:'polygon', poligonos:'polygon',
  polilatero:'polygon', polilateros:'polygon',
  convex:'convexHull', hull:'convexHull', convexhull:'convexHull',
  convexo:'convexHull', convexos:'convexHull', fechoconvexo:'convexHull',
  envoltoria:'convexHull', envoltoriaconvexa:'convexHull', poligonoconvexo:'convexHull',
  distance:'distance', dist:'distance', distancia:'distance',
  midpoint:'midpoint', medio:'midpoint', mid:'midpoint',
  line:'line', reta:'line',
  intersect:'intersect', intersection:'intersect', intersecao:'intersect',
  conic:'conic', conica:'conic',
  section:'section', secao:'section', seccao:'section', secaocone:'section',
  quadric:'quadric', quadrica:'quadric', quadricas:'quadric',
  superficie:'surface', surface:'surface', superficie3d:'surface',
  campo:'vector-field', campovetorial:'vector-field', campo3d:'vector-field-3d',
  integrallinha:'line-integral', circulacao:'line-integral', fluxo:'flux-disk',
  funcao3d:'scalar-surface', grafico3d:'scalar-surface', scalar3d:'scalar-surface',
  corte:'quadric-slice', cortequadrica:'quadric-slice', quadricsection:'quadric-slice',
  tangente:'tangent', tangent:'tangent', gradient:'tangent', gradiente:'tangent',
  plane:'plane', plano:'plane',
  position:'position', posicao:'position',
  sum:'sum', soma:'sum',
  scale:'scale', escala:'scale',
  cross:'cross', vetorial:'cross', produtovetorial:'cross',
  triple:'triple', misto:'triple', produtomisto:'triple',
  parallelepiped:'parallelepiped', paralelepipedo:'parallelepiped',
  span:'span', ger:'span',
  matrix:'matrix', matriz:'matrix',
  transform:'matrix', transformacao:'matrix'
};

function asciiCommand(value){
  return String(value||'')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g,'')
    .toLowerCase();
}

function fmt(value){
  if(!Number.isFinite(value)) return String(value);
  if(Math.abs(value)<1e-10) return '0';
  const abs=Math.abs(value);
  if(abs>=1e5||abs<1e-4) return value.toExponential(3).replace(/\.?0+e/,'e');
  return String(Number(value.toFixed(5)));
}

function fmtPoint(point){
  return '('+fmt(point.x)+', '+fmt(point.y)+')';
}

function result(type,label){
  return {
    type,
    label,
    info:[],
    points:[],
    segments:[],
    lines:[],
    vectors:[],
    polygons:[],
    conics:[],
    angles:[],
    matrix:null,
    definitions:[]
  };
}

function errorResult(label,message){
  const r=result('error',label);
  r.error=message || 'entrada invalida';
  r.info=[r.error];
  return r;
}

function evalScalar(src,ctx={}){
  const text=String(src||'').trim();
  if(!text) throw new Error('coordenada vazia');
  const fn=compile(text,ctx.params||{});
  if(typeof fn!=='function') throw new Error('coordenada invalida: '+text);
  const value=fn(0);
  if(!Number.isFinite(value)) throw new Error('coordenada indefinida: '+text);
  return value;
}

function splitTopAny(str,sep){
  const out=[];
  let depth=0, last=0;
  for(let i=0;i<str.length;i++){
    const c=str[i];
    if(c==='('||c==='['||c==='{') depth++;
    else if(c===')'||c===']'||c==='}') depth--;
    else if(c===sep&&depth===0){
      out.push(str.slice(last,i));
      last=i+1;
    }
  }
  out.push(str.slice(last));
  return out;
}

function refFromRegistry(name,ctx={}){
  const registry=ctx.registry;
  if(!registry) return null;
  return registry.get(name) || registry.get(String(name).toLowerCase()) || null;
}

function define(result,name,kind,value){
  if(!name) return;
  result.definitions.push({name,kind,value});
}

export function addGeometryDefinitions(registry,geometry){
  if(!registry||!geometry?.definitions) return registry;
  geometry.definitions.forEach(def=>{
    if(!def?.name) return;
    registry.set(def.name,def);
    // The lowercase alias never overrides a name defined exactly in lowercase
    // (vetor: v=(4,5,6) followed by V = misto(u,v,w) keeps v the vector).
    const lower=String(def.name).toLowerCase();
    if(lower!==def.name&&registry.get(lower)?.name!==lower) registry.set(lower,def);
  });
  return registry;
}

function parsePoint(src,fallbackLabel='',ctx={}){
  let text=String(src||'').trim();
  let label=fallbackLabel;
  let explicitLabel=false;
  const named=text.match(/^([a-zA-Z][a-zA-Z0-9_]*)\s*=\s*(.+)$/);
  if(named){
    label=named[1];
    explicitLabel=true;
    text=named[2].trim();
  }
  const ref=text.match(/^[a-zA-Z][a-zA-Z0-9_]*$/) ? refFromRegistry(text,ctx) : null;
  if(ref?.kind==='point'){
    return {...ref.value, label:explicitLabel ? label : (ref.value.label || text || label)};
  }
  if(!text.startsWith('(')||!text.endsWith(')')) throw new Error('ponto esperado: '+src);
  const parts=splitTop(text.slice(1,-1),',');
  if(parts.length===3) return {x:evalScalar(parts[0],ctx), y:evalScalar(parts[1],ctx), z:evalScalar(parts[2],ctx), label, dim:3};
  if(parts.length!==2) throw new Error('ponto precisa de duas ou três coordenadas: '+src);
  return {x:evalScalar(parts[0],ctx), y:evalScalar(parts[1],ctx), label, dim:2};
}

function parsePointList(body,ctx={}){
  const parts=splitTop(String(body||''),',').map(p=>p.trim()).filter(Boolean);
  return parts.map((part,i)=>parsePoint(part, i===0?'A':i===1?'B':'', ctx));
}

function requirePointPair(body,ctx={}){
  const pts=parsePointList(body,ctx);
  if(pts.length!==2) throw new Error('use exatamente dois pontos');
  return pts;
}

function dist(a,b){
  return Math.hypot(b.x-a.x,b.y-a.y);
}

function samePoint(a,b){
  return dist(a,b)<EPS;
}

function midpoint(a,b){
  return {x:(a.x+b.x)/2, y:(a.y+b.y)/2, label:'M'};
}

function lineFromPoints(a,b,label=''){
  const dx=b.x-a.x, dy=b.y-a.y;
  if(Math.hypot(dx,dy)<EPS) throw new Error('pontos coincidentes nao definem reta');
  return {
    a:a.y-b.y,
    b:b.x-a.x,
    c:a.x*b.y-b.x*a.y,
    label,
    through:[a,b]
  };
}

function linePoint(line){
  const den=line.a*line.a+line.b*line.b;
  return {x:-line.a*line.c/den, y:-line.b*line.c/den};
}

function lineDirection(line){
  return {x:line.b, y:-line.a};
}

function lineEquation(line){
  if(Math.abs(line.b)>EPS){
    const m=-line.a/line.b;
    const q=-line.c/line.b;
    return 'y = '+fmt(m)+'x '+(q<0?'- ':'+ ')+fmt(Math.abs(q));
  }
  return 'x = '+fmt(-line.c/line.a);
}

function findTopLevelEquals(str){
  let depth=0;
  for(let i=0;i<str.length;i++){
    const c=str[i];
    if(c==='('||c==='['||c==='{') depth++;
    else if(c===')'||c===']'||c==='}') depth--;
    else if(c==='='&&depth===0){
      const prev=str[i-1], next=str[i+1];
      if(prev!=='<'&&prev!=='>'&&prev!=='!'&&prev!=='='&&next!=='=') return i;
    }
  }
  return -1;
}

function relationParts(raw){
  const text=String(raw||'').trim();
  const ei=findTopLevelEquals(text);
  if(ei>=0) return [text.slice(0,ei).trim(), text.slice(ei+1).trim()];
  return [text,'0'];
}

function relationFunction(raw,ctx={}){
  const [lhs,rhs]=relationParts(raw);
  const L=compile(lhs,ctx.params||{}), R=compile(rhs,ctx.params||{});
  if(typeof L!=='function'||typeof R!=='function') throw new Error('relacao invalida');
  return (x,y)=>{
    setImplicitY(y);
    return L(x)-R(x);
  };
}

function sampleQuadratic(raw,ctx={}){
  const f=relationFunction(raw,ctx);
  const at=(x,y)=>{
    const value=f(x,y);
    if(!Number.isFinite(value)) throw new Error('relacao indefinida');
    return value;
  };
  const F=at(0,0);
  const f10=at(1,0), fm10=at(-1,0), f01=at(0,1), f0m1=at(0,-1);
  const A=(f10+fm10-2*F)/2;
  const C=(f01+f0m1-2*F)/2;
  const D=(f10-fm10)/2;
  const E=(f01-f0m1)/2;
  const B=at(1,1)-A-C-D-E-F;
  const coeffs={A,B,C,D,E,F};
  const evalPoly=(x,y)=>A*x*x+B*x*y+C*y*y+D*x+E*y+F;
  const checks=[[2,-1],[-1,2],[1.5,-0.5]];
  for(const [x,y] of checks){
    if(Math.abs(at(x,y)-evalPoly(x,y))>1e-6) throw new Error('relacao nao quadratica');
  }
  return {coeffs, implicitF:f};
}

function parseLineExpression(raw,label='',ctx={}){
  const {coeffs}=sampleQuadratic(raw,ctx);
  if(Math.abs(coeffs.A)>EPS||Math.abs(coeffs.B)>EPS||Math.abs(coeffs.C)>EPS){
    throw new Error('a expressao nao e linear');
  }
  if(Math.hypot(coeffs.D,coeffs.E)<EPS) throw new Error('reta degenerada');
  return {a:coeffs.D, b:coeffs.E, c:coeffs.F, label};
}

function stripCall(spec,names){
  const text=String(spec||'').trim();
  const open=text.indexOf('(');
  if(open<0||!text.endsWith(')')) return null;
  const name=asciiCommand(text.slice(0,open).trim());
  if(!names.includes(name)) return null;
  return text.slice(open+1,-1).trim();
}

function parseLineSpec(spec,label='',ctx={}){
  const call=stripCall(spec,['line','reta']);
  const body=call ?? String(spec||'').trim();
  const ref=body.match(/^[a-zA-Z][a-zA-Z0-9_]*$/) ? refFromRegistry(body,ctx) : null;
  if(ref?.kind==='line') return {...ref.value, label:label || ref.value.label || body};
  try{
    const pts=requirePointPair(body,ctx);
    return lineFromPoints(pts[0],pts[1],label);
  }catch(_){
    return parseLineExpression(body,label,ctx);
  }
}

function parseConicSpec(spec,ctx={}){
  const call=stripCall(spec,['conic','conica']);
  const body=call ?? String(spec||'').trim();
  const ref=body.match(/^[a-zA-Z][a-zA-Z0-9_]*$/) ? refFromRegistry(body,ctx) : null;
  if(ref?.kind==='conic') return ref.value;
  const sampled=sampleQuadratic(body,ctx);
  const q=sampled.coeffs;
  if(Math.abs(q.A)<EPS&&Math.abs(q.B)<EPS&&Math.abs(q.C)<EPS){
    throw new Error('a expressao nao tem termo quadratico');
  }
  return {type:'conic', source:body, coeffs:q, implicitF:sampled.implicitF, analysis:analyzeConic(q)};
}

function parsePointCommand(body,ctx={},definitionName=''){
  const r=result('point','ponto');
  r.points=parsePointList(body,ctx);
  if(!r.points.length) throw new Error('adicione pelo menos um ponto');
  if(definitionName&&r.points.length===1) r.points[0].label=definitionName;
  r.info=r.points.map(p=>(p.label?p.label+' = ':'')+fmtPoint(p));
  r.points.forEach(point=>{ if(point.label) define(r,point.label,'point',point); });
  if(definitionName&&r.points.length) define(r,definitionName,'point',r.points[0]);
  return r;
}

function parseVectorCommand(body,ctx={},definitionName=''){
  const r=result('vector','vetor');
  const points=parsePointList(body,ctx);
  let from={x:0,y:0,label:'O'}, to, label='v';
  if(points.length===1){
    to={x:points[0].x,y:points[0].y,label:points[0].label||'v'};
    label=points[0].label||'v';
  } else if(points.length===2){
    from=points[0];
    to=points[1];
    label=(from.label&&to.label) ? from.label+to.label : 'v';
  } else {
    throw new Error('use um vetor ou dois pontos');
  }
  if(definitionName) label=definitionName;
  const comp={x:to.x-from.x,y:to.y-from.y};
  r.points=points.length===2 ? [from,to] : [];
  r.vectors=[{from,to,label}];
  r.info=['vetor '+label+' = ('+fmt(comp.x)+', '+fmt(comp.y)+')','|'+label+'| = '+fmt(Math.hypot(comp.x,comp.y))];
  if(definitionName) define(r,definitionName,'vector',r.vectors[0]);
  return r;
}

function vectorComponents(vec){
  return {x:vec.to.x-vec.from.x, y:vec.to.y-vec.from.y};
}

function vectorFromComponents(comp,label='v'){
  return {from:{x:0,y:0,label:'O'}, to:{x:comp.x,y:comp.y,label}, label};
}

function translatedVector(vec,vertex,label='v'){
  const comp=vectorComponents(vec);
  return {from:vertex, to:{x:vertex.x+comp.x,y:vertex.y+comp.y,label}, label};
}

function parseVectorSpec(spec,label='',ctx={}){
  const text=String(spec||'').trim();
  const ref=text.match(/^[a-zA-Z][a-zA-Z0-9_]*$/) ? refFromRegistry(text,ctx) : null;
  if(ref?.kind==='vector'){
    return {...ref.value, label:label || ref.value.label || text};
  }
  const call=stripCall(text,['vector','vetor']);
  const body=call ?? text;
  const points=parsePointList(body,ctx);
  let from={x:0,y:0,label:'O'}, to, vectorLabel=label || 'v';
  if(points.length===1){
    to={x:points[0].x,y:points[0].y,label:points[0].label||vectorLabel};
    vectorLabel=label || points[0].label || vectorLabel;
  } else if(points.length===2){
    from=points[0];
    to=points[1];
    vectorLabel=label || ((from.label&&to.label) ? from.label+to.label : 'v');
  } else {
    throw new Error('vetor precisa de um ponto, dois pontos ou um vetor nomeado');
  }
  return {from,to,label:vectorLabel};
}

function vectorPair(body,ctx={}){
  const parts=splitTopAny(String(body||''),';').map(part=>part.trim()).filter(Boolean);
  if(parts.length!==2) throw new Error('use dois vetores separados por ;');
  return [parseVectorSpec(parts[0],'u',ctx),parseVectorSpec(parts[1],'v',ctx)];
}

function dotVectors(u,v){
  const a=vectorComponents(u), b=vectorComponents(v);
  return algebraDot([a.x,a.y],[b.x,b.y]);
}

function vectorNorm(vec){
  const c=vectorComponents(vec);
  return algebraNorm([c.x,c.y]);
}

function vectorAngle(u,v){
  const a=vectorComponents(u), b=vectorComponents(v);
  const rad=algebraAngle([a.x,a.y],[b.x,b.y]);
  return {rad, deg:rad*180/Math.PI, dot:dotVectors(u,v)};
}

function parseAngleCommand(body,ctx={},definitionName=''){
  let vectors, points=[];
  const parts=splitTopAny(String(body||''),';').map(part=>part.trim()).filter(Boolean);
  if(parts.length===2){
    const pair=vectorPair(body,ctx);
    const vertex={x:0,y:0,label:'O'};
    vectors=[translatedVector(pair[0],vertex,'u'),translatedVector(pair[1],vertex,'v')];
  } else {
    points=parsePointList(body,ctx);
    if(points.length===3){
      vectors=[
        {from:points[1],to:points[0],label:(points[1].label||'B')+(points[0].label||'A')},
        {from:points[1],to:points[2],label:(points[1].label||'B')+(points[2].label||'C')}
      ];
    } else if(points.length===2){
      vectors=[
        {from:{x:0,y:0,label:'O'},to:points[0],label:points[0].label||'u'},
        {from:{x:0,y:0,label:'O'},to:points[1],label:points[1].label||'v'}
      ];
    } else {
      throw new Error('use angulo: A,B,C ou angulo: vetor1; vetor2');
    }
  }
  const [u,v]=vectors;
  const {rad,deg,dot}=vectorAngle(u,v);
  const r=result('angle','angulo');
  r.points=points;
  r.vectors=[u,v];
  r.angles=[{vertex:u.from,a:u.to,b:v.to,label:'θ',rad,deg}];
  r.info=['angulo = '+fmt(deg)+'°','rad = '+fmt(rad),'produto escalar = '+fmt(dot)];
  if(definitionName) define(r,definitionName,'scalar',deg);
  return r;
}

function polygonSignedArea(points){
  let sum=0;
  for(let i=0;i<points.length;i++){
    const a=points[i], b=points[(i+1)%points.length];
    sum+=a.x*b.y-b.x*a.y;
  }
  return sum/2;
}

function polygonPerimeter(points){
  let sum=0;
  for(let i=0;i<points.length;i++) sum+=dist(points[i],points[(i+1)%points.length]);
  return sum;
}

function turnCross(o,a,b){
  return (a.x-o.x)*(b.y-o.y)-(a.y-o.y)*(b.x-o.x);
}

function vertexName(point,index){
  return point.label || 'V'+(index+1);
}

function sideName(a,b,fallback){
  return a.label&&b.label ? a.label+b.label : fallback;
}

function ensurePolygonLabels(points){
  const labels='ABCDEFGHIJKLMNOPQRSTUVWXYZ'.split('');
  return points.map((point,index)=>{
    if(point.label) return point;
    return {...point, label:labels[index] || 'P'+(index+1)};
  });
}

function normalizePolygonPoints(points){
  const normalized=ensurePolygonLabels(points);
  if(normalized.length>1&&samePoint(normalized[0],normalized[normalized.length-1])){
    return normalized.slice(0,-1);
  }
  return normalized;
}

function convexHullPoints(points){
  const sorted=[...points].sort((a,b)=>
    (a.x-b.x) || (a.y-b.y) || String(a.label||'').localeCompare(String(b.label||''))
  );
  const unique=[];
  sorted.forEach(point=>{
    if(!unique.length||!samePoint(point,unique[unique.length-1])) unique.push(point);
  });
  if(unique.length<=2) return unique;
  const lower=[];
  unique.forEach(point=>{
    while(lower.length>=2&&turnCross(lower[lower.length-2],lower[lower.length-1],point)<=EPS){
      lower.pop();
    }
    lower.push(point);
  });
  const upper=[];
  for(let i=unique.length-1;i>=0;i--){
    const point=unique[i];
    while(upper.length>=2&&turnCross(upper[upper.length-2],upper[upper.length-1],point)<=EPS){
      upper.pop();
    }
    upper.push(point);
  }
  return lower.slice(0,-1).concat(upper.slice(0,-1));
}

function polygonAngles(points,signedArea){
  const orientation=signedArea>=0 ? 1 : -1;
  return points.map((vertex,index)=>{
    const prev=points[(index+points.length-1)%points.length];
    const next=points[(index+1)%points.length];
    const incoming={x:vertex.x-prev.x,y:vertex.y-prev.y};
    const outgoing={x:next.x-vertex.x,y:next.y-vertex.y};
    const turn=Math.atan2(incoming.x*outgoing.y-incoming.y*outgoing.x,incoming.x*outgoing.x+incoming.y*outgoing.y);
    let rad=Math.PI-orientation*turn;
    while(rad<=0) rad+=Math.PI*2;
    while(rad>Math.PI*2) rad-=Math.PI*2;
    const externalRad=Math.abs(Math.PI-rad);
    return {vertex,a:prev,b:next,label:vertexName(vertex,index),rad,deg:rad*180/Math.PI,externalRad,externalDeg:externalRad*180/Math.PI};
  });
}

function markSegment(seg,label){
  if(!seg) return;
  seg.label=label;
  seg.showLabel=true;
}

function classifyRightTriangle(points,angles,segments){
  if(points.length!==3) return null;
  const rightIndex=angles.findIndex(angle=>Math.abs(angle.deg-90)<=0.5);
  if(rightIndex<0) return null;
  const previous=(rightIndex+2)%3;
  const next=(rightIndex+1)%3;
  const edgeIndex=(i,j)=>{
    if((i+1)%3===j) return i;
    if((j+1)%3===i) return j;
    return -1;
  };
  const cathetusA=edgeIndex(previous,rightIndex);
  const cathetusB=edgeIndex(rightIndex,next);
  const hypotenuse=edgeIndex(previous,next);
  markSegment(segments[cathetusA],'cateto');
  markSegment(segments[cathetusB],'cateto');
  markSegment(segments[hypotenuse],'hipotenusa');
  return {
    vertex:points[rightIndex],
    catheti:[segments[cathetusA],segments[cathetusB]].filter(Boolean),
    hypotenuse:segments[hypotenuse]
  };
}

function closeLength(a,b){
  return Math.abs(a-b)<=1e-7*Math.max(1,Math.abs(a),Math.abs(b));
}

function classifyTriangle(points,angles,segments){
  if(points.length!==3) return null;
  const lengths=segments.map(seg=>seg.length ?? dist(seg.a,seg.b));
  const equal01=closeLength(lengths[0],lengths[1]);
  const equal12=closeLength(lengths[1],lengths[2]);
  const equal02=closeLength(lengths[0],lengths[2]);
  const sideType=equal01&&equal12 ? 'equilatero'
    : equal01||equal12||equal02 ? 'isosceles'
    : 'escaleno';
  const angleType=angles.some(angle=>Math.abs(angle.deg-90)<=0.5) ? 'retangulo'
    : angles.some(angle=>angle.deg>90.5) ? 'obtusangulo'
    : 'acutangulo';
  return {
    sideType,
    angleType,
    label:sideType+' '+angleType
  };
}

function formatSideLength(seg,fallback){
  if(!seg) return '';
  return sideName(seg.a,seg.b,fallback)+' = '+fmt(seg.length ?? dist(seg.a,seg.b));
}

function parsePolygonCommand(body,ctx={},definitionName='',kind='polygon'){
  const inputPoints=normalizePolygonPoints(parsePointList(body,ctx));
  let points=inputPoints;
  const expected=kind==='triangle' ? 3 : kind==='quadrilateral' ? 4 : 0;
  const label=kind==='triangle' ? 'triangulo'
    : kind==='quadrilateral' ? 'quadrilatero'
    : kind==='convexHull' ? 'poligono convexo'
    : 'poligono';
  if(expected&&points.length!==expected) throw new Error(label+' precisa de '+expected+' vertices');
  if(kind==='convexHull'){
    if(inputPoints.length<3) throw new Error('fecho convexo precisa de pelo menos 3 pontos');
    points=convexHullPoints(inputPoints);
    if(points.length<3) throw new Error('pontos colineares nao formam poligono convexo');
  } else {
    if(!expected&&points.length<3) throw new Error('poligono precisa de pelo menos 3 vertices');
    for(let i=0;i<points.length;i++){
      if(samePoint(points[i],points[(i+1)%points.length])) throw new Error('vertices consecutivos coincidentes');
    }
  }
  const signedArea=polygonSignedArea(points);
  if(Math.abs(signedArea)<EPS) throw new Error('poligono com area nula');
  const segments=points.map((a,index)=>{
    const b=points[(index+1)%points.length];
    return {a,b,label:sideName(a,b,'L'+(index+1)),length:dist(a,b)};
  });
  const angles=polygonAngles(points,signedArea);
  const area=Math.abs(signedArea);
  const perimeter=polygonPerimeter(points);
  const r=result('polygon',label);
  r.points=kind==='convexHull' ? inputPoints : points;
  r.segments=segments;
  const triangleClass=classifyTriangle(points,angles,segments);
  r.polygons=[{points,label:definitionName||label,caption:triangleClass?.label || ''}];
  r.angles=angles;
  r.info=[
    kind==='convexHull'
      ? 'fecho convexo: '+inputPoints.length+' pontos -> '+points.length+' vertices'
      : label+' com '+points.length+' vertices',
    'perimetro = '+fmt(perimeter),
    'area = '+fmt(area),
    'angulos: '+angles.map((angle,index)=>vertexName(points[index],index)+' '+fmt(angle.deg)+'°').join(' · ')
  ];
  if(triangleClass){
    r.triangleClass=triangleClass;
    r.info.push('classificacao: '+triangleClass.label);
  }
  const right=classifyRightTriangle(points,angles,segments);
  if(right){
    r.info.push('triangulo retangulo em '+vertexName(right.vertex,points.indexOf(right.vertex)));
    r.info.push('catetos: '+right.catheti.map((seg,index)=>formatSideLength(seg,'C'+(index+1))).join(' · '));
    r.info.push('hipotenusa: '+formatSideLength(right.hypotenuse,'H'));
  }
  r.points.forEach(point=>{ if(point.label) define(r,point.label,'point',point); });
  if(definitionName) define(r,definitionName,'polygon',r.polygons[0]);
  return r;
}

function parseDotCommand(body,ctx={},definitionName=''){
  const [u,v]=vectorPair(body,ctx);
  const dot=dotVectors(u,v);
  const nu=vectorNorm(u), nv=vectorNorm(v);
  const r=result('dot','produto escalar');
  r.vectors=[
    vectorFromComponents(vectorComponents(u),'u'),
    vectorFromComponents(vectorComponents(v),'v')
  ];
  r.info=['u · v = '+fmt(dot),'|u| = '+fmt(nu),'|v| = '+fmt(nv)];
  if(nu>EPS&&nv>EPS) r.info.push('cos(theta) = '+fmt(dot/(nu*nv)));
  if(definitionName) define(r,definitionName,'scalar',dot);
  return r;
}

function parseProjectionCommand(body,ctx={},definitionName=''){
  const [u,v]=vectorPair(body,ctx);
  const uc=vectorComponents(u), vc=vectorComponents(v);
  const values=algebraProjection([uc.x,uc.y],[vc.x,vc.y]);
  const proj={x:values[0],y:values[1]};
  const coef=algebraDot([uc.x,uc.y],[vc.x,vc.y])/algebraDot([vc.x,vc.y],[vc.x,vc.y]);
  const r=result('projection','projecao');
  r.vectors=[
    vectorFromComponents(uc,'u'),
    vectorFromComponents(vc,'v'),
    vectorFromComponents(proj,definitionName || 'proj')
  ];
  r.info=['proj_v(u) = ('+fmt(proj.x)+', '+fmt(proj.y)+')','coeficiente = '+fmt(coef),'u · v = '+fmt(algebraDot([uc.x,uc.y],[vc.x,vc.y]))];
  if(definitionName) define(r,definitionName,'vector',r.vectors[2]);
  return r;
}

function parseDistanceCommand(body,ctx={},definitionName=''){
  const [a,b]=requirePointPair(body,ctx);
  const r=result('distance','distancia');
  r.points=[a,b];
  r.segments=[{a,b,label:'d'}];
  const value=dist(a,b);
  r.info=['d('+labelOf(a,'A')+', '+labelOf(b,'B')+') = '+fmt(value),'delta = ('+fmt(b.x-a.x)+', '+fmt(b.y-a.y)+')'];
  if(definitionName) define(r,definitionName,'scalar',value);
  return r;
}

function parseMidpointCommand(body,ctx={},definitionName=''){
  const [a,b]=requirePointPair(body,ctx);
  const m=midpoint(a,b);
  if(definitionName) m.label=definitionName;
  const r=result('midpoint','ponto medio');
  r.points=[a,b,m];
  r.segments=[{a,b,label:'AB'}];
  r.info=['M = '+fmtPoint(m),'M e o ponto medio de '+labelOf(a,'A')+labelOf(b,'B')];
  define(r,m.label,'point',m);
  if(definitionName) define(r,definitionName,'point',m);
  return r;
}

function parseLineCommand(body,ctx={},definitionName=''){
  const [a,b]=requirePointPair(body,ctx);
  const line=lineFromPoints(a,b,definitionName||'r');
  const r=result('line','reta');
  r.points=[a,b];
  r.lines=[line];
  r.info=['reta por '+labelOf(a,'A')+' e '+labelOf(b,'B'),lineEquation(line)];
  define(r,line.label,'line',line);
  if(definitionName) define(r,definitionName,'line',line);
  return r;
}

function labelOf(point,fallback){
  return point.label || fallback || '';
}

function intersectLines(l1,l2){
  const det=l1.a*l2.b-l2.a*l1.b;
  if(Math.abs(det)<EPS) return null;
  return {
    x:(l1.b*l2.c-l2.b*l1.c)/det,
    y:(l1.c*l2.a-l2.c*l1.a)/det,
    label:'P'
  };
}

function solveQuadratic(a,b,c){
  if(Math.abs(a)<EPS){
    if(Math.abs(b)<EPS) return [];
    return [-c/b];
  }
  const disc=b*b-4*a*c;
  if(disc<-1e-9) return [];
  if(Math.abs(disc)<=1e-9) return [-b/(2*a)];
  const root=Math.sqrt(Math.max(0,disc));
  return [(-b-root)/(2*a),(-b+root)/(2*a)];
}

function intersectLineConic(line,conic){
  const p=linePoint(line);
  const d=lineDirection(line);
  const q=conic.coeffs;
  const alpha=q.A*d.x*d.x+q.B*d.x*d.y+q.C*d.y*d.y;
  const beta=2*q.A*p.x*d.x+q.B*(p.x*d.y+p.y*d.x)+2*q.C*p.y*d.y+q.D*d.x+q.E*d.y;
  const gamma=q.A*p.x*p.x+q.B*p.x*p.y+q.C*p.y*p.y+q.D*p.x+q.E*p.y+q.F;
  return solveQuadratic(alpha,beta,gamma).map((t,i)=>({x:p.x+t*d.x,y:p.y+t*d.y,label:i===0?'P':'Q'}));
}

function parseIntersectionObject(spec,index,ctx={}){
  const text=String(spec||'').trim();
  const ref=text.match(/^[a-zA-Z][a-zA-Z0-9_]*$/) ? refFromRegistry(text,ctx) : null;
  if(ref?.kind==='line') return {kind:'line', line:{...ref.value, label:ref.value.label || text}};
  if(ref?.kind==='conic') return {kind:'conic', conic:ref.value};
  const name=stripCall(text,['line','reta'])!==null ? 'line'
    : stripCall(text,['conic','conica'])!==null ? 'conic'
    : null;
  if(name==='line') return {kind:'line', line:parseLineSpec(text,index===0?'r':'s',ctx)};
  if(name==='conic') return {kind:'conic', conic:parseConicSpec(text,ctx)};
  const sampled=sampleQuadratic(text,ctx);
  if(Math.abs(sampled.coeffs.A)<EPS&&Math.abs(sampled.coeffs.B)<EPS&&Math.abs(sampled.coeffs.C)<EPS){
    return {kind:'line', line:parseLineExpression(text,index===0?'r':'s',ctx)};
  }
  return {kind:'conic', conic:{type:'conic',source:text,coeffs:sampled.coeffs,implicitF:sampled.implicitF,analysis:analyzeConic(sampled.coeffs)}};
}

function parseIntersectionCommand(body,ctx={},definitionName=''){
  const parts=splitTopAny(String(body||''),';').map(p=>p.trim()).filter(Boolean);
  if(parts.length!==2) throw new Error('use duas retas/curvas separadas por ;');
  const a=parseIntersectionObject(parts[0],0,ctx);
  const b=parseIntersectionObject(parts[1],1,ctx);
  const r=result('intersect','intersecao');
  if(a.kind==='line') r.lines.push(a.line); else r.conics.push(a.conic);
  if(b.kind==='line') r.lines.push(b.line); else r.conics.push(b.conic);
  let pts=[];
  if(a.kind==='line'&&b.kind==='line'){
    const p=intersectLines(a.line,b.line);
    if(p) pts=[p];
  } else if(a.kind==='line'&&b.kind==='conic'){
    pts=intersectLineConic(a.line,b.conic);
  } else if(a.kind==='conic'&&b.kind==='line'){
    pts=intersectLineConic(b.line,a.conic);
  } else {
    throw new Error('intersecao entre duas conicas ainda nao suportada');
  }
  if(definitionName&&pts.length===1){
    pts[0].label=definitionName;
    define(r,definitionName,'point',pts[0]);
  }
  r.points=pts;
  r.info=pts.length ? pts.map(p=>(p.label||'P')+' = '+fmtPoint(p)) : ['sem intersecoes reais'];
  return r;
}

function parseConicCommand(body,ctx={},definitionName=''){
  const conic=parseConicSpec(body,ctx);
  const r=result('conic','conica');
  r.conics=[conic];
  r.points=conic.analysis.points || [];
  r.lines=conic.analysis.lines || [];
  r.segments=conic.analysis.segments || [];
  r.info=conic.analysis.info;
  if(definitionName) define(r,definitionName,'conic',conic);
  return r;
}

function parseMatrixText(body,ctx={}){
  const ref=String(body||'').trim().match(/^[a-zA-Z][a-zA-Z0-9_]*$/) ? refFromRegistry(String(body).trim(),ctx) : null;
  if(ref?.kind==='matrix') return ref.value.values;
  let text=String(body||'').trim();
  if(!text) throw new Error('matriz vazia');
  if(!text.startsWith('[')&&!text.startsWith('@')) text='['+text+']';
  const values=compile(text,ctx.params||{},{},ctx.symbols)(0);
  validateMatrix(values);
  const n=values.length;
  if((n!==2&&n!==3)||values.some(row=>row.length!==n)) throw new Error('matriz 2x2 ou 3x3 esperada');
  return values;
}

function parseMatrixCommand(body,ctx={},definitionName=''){
  const m=parseMatrixText(body,ctx);
  if(m.length===3) return matrix3Result(m,ctx,definitionName);
  const [[a,b],[c,d]]=m;
  const det=matrixDet(m);
  const tr=matrixTrace(m);
  const info=['A = ['+fmt(a)+' '+fmt(b)+'; '+fmt(c)+' '+fmt(d)+']','det = '+fmt(det),'traco = '+fmt(tr)];
  let eigen=null;
  try {
    eigen=eiginfo(m);
    info.push('autovalores = '+eigen.value.map(fmt).join(', '));
    info.push(...eigen.warnings);
  } catch(e) { if(e.code!=='COMPLEX') throw e; info.push('autovalores complexos'); }
  const r=result('matrix','matriz 2x2');
  r.matrix={values:m, det, trace:tr, eigen};
  r.vectors=[
    {from:{x:0,y:0}, to:{x:a,y:c}, label:'A i'},
    {from:{x:0,y:0}, to:{x:b,y:d}, label:'A j'}
  ];
  r.polygons=[{points:[{x:0,y:0},{x:a,y:c},{x:a+b,y:c+d},{x:b,y:d}], label:'A unidade'}];
  r.info=info;
  if(definitionName) define(r,definitionName,'matrix',r.matrix);
  return r;
}

function lineX(x,label,style='dotted'){
  return {a:1,b:0,c:-x,label,style};
}

function lineY(y,label,style='dotted'){
  return {a:0,b:1,c:-y,label,style};
}

const coeffScale=q=>Math.max(1,...['A','B','C','D','E','F'].map(key=>Math.abs(q[key])));

// Genus by the quadratic part a x^2 + b xy + c y^2 (course notation b^2 - 4ac).
function conicGenus(q){
  const disc=q.B*q.B-4*q.A*q.C;
  const tol=1e-9*Math.max(1,q.B*q.B,Math.abs(4*q.A*q.C));
  const sign=Math.abs(disc)<=tol ? 0 : Math.sign(disc);
  const genus=sign<0 ? 'eliptico' : sign>0 ? 'hiperbolico' : 'parabolico';
  const value=sign===0 ? '0' : fmt(disc)+(sign<0?' < 0':' > 0');
  return {disc:sign===0?0:disc,sign,label:'b^2 - 4ac = '+value+' (genero '+genus+')'};
}

// Determinant of the 3x3 matrix of the conic: zero means a degenerate conic.
function conicDelta(q){
  const a=q.A,b=q.B/2,c=q.C,d=q.D/2,e=q.E/2,f=q.F;
  return a*(c*f-e*e)-b*(b*f-e*d)+d*(b*e-c*d);
}

function analyzeRotatedConic(q){
  // A general real quadratic is a symmetric matrix. Its eigenvectors give
  // the principal axes, so foci/directrices can be drawn even with xy present.
  const genus=conicGenus(q), analysis=analysePlaneQuadratic(q);
  const p=st=>({x:st[0],y:st[1]});
  const point=(st,label)=>({...p(st),label});
  const add=(a,b)=>a.map((x,i)=>x+b[i]);
  const mul=(v,t)=>v.map(x=>x*t);
  const lineThrough=(origin,direction,label,style='dotted')=>{
    const n=[-direction[1],direction[0]];
    return {a:n[0],b:n[1],c:-(n[0]*origin[0]+n[1]*origin[1]),label,style};
  };
  const perpendicularAt=(point,axis,label)=>({
    a:axis[0],b:axis[1],c:-(axis[0]*point[0]+axis[1]*point[1]),label,style:'dashed'
  });
  const points=[],lines=[],segments=[];
  const title={
    ellipse:'elipse',circle:'circunferência',hyperbola:'hipérbole',parabola:'parábola',
    empty:'cônica sem pontos reais','vertex-point':'ponto (elipse degenerada)',
    'two-lines':'par de retas concorrentes','parallel-lines':'retas paralelas',
    'one-line':'reta','all-plane':'plano inteiro'
  }[analysis.type]||analysis.type;
  const info=['cônica rotacionada',title,genus.label,
    'rotação dos eixos principais = '+fmt(analysis.rotation)+'°',
    'autovalores da parte quadrática = '+analysis.eigenvalues.map(fmt).join(', ')];
  if(analysis.canonical)info.push('forma canônica no referencial rotacionado: '+analysis.canonical);
  if(analysis.center){
    points.push(point(analysis.center,'C'));
    info.push('centro C = '+fmtPoint(p(analysis.center)));
    const axisLength=Math.max(2,analysis.semiaxes?.major||analysis.semiaxes?.real||3)*1.3;
    for(let i=0;i<2;i++){
      const dir=analysis.axes[i];
      lines.push(lineThrough(analysis.center,dir,'eixo principal '+(i+1)));
      segments.push({a:p(add(analysis.center,mul(dir,-axisLength))),
        b:p(add(analysis.center,mul(dir,axisLength))),style:'dotted'});
    }
  }
  if(analysis.vertex){
    points.push(point(analysis.vertex,'V'));
    info.push('vértice V = '+fmtPoint(p(analysis.vertex)));
  }
  if(analysis.foci.length){
    analysis.foci.forEach((focus,i)=>points.push(point(focus,'F'+(i+1))));
    info.push('focos = '+analysis.foci.map(f=>fmtPoint(p(f))).join(' e '));
  }
  if(analysis.eccentricity!==null)info.push('excentricidade e = '+fmt(analysis.eccentricity));
  if(analysis.semiaxes){
    if(analysis.type==='ellipse'||analysis.type==='circle'){
      const {major,minor}=analysis.semiaxes;
      info.push('semieixos = '+fmt(major)+' e '+fmt(minor));
    }else{
      const {real,conjugate}=analysis.semiaxes;
      info.push('semieixos real/conjugado = '+fmt(real)+' e '+fmt(conjugate));
    }
  }
  if(analysis.asymptotes?.length&&analysis.center){
    for(const [i,dir] of analysis.asymptotes.entries())
      lines.push(lineThrough(analysis.center,dir,'assíntota '+(i+1),'dashed'));
  }
  // Focal directrices: n·(X-C) = ±a/e for ellipses/hyperbolas.
  if(analysis.center&&analysis.foci.length===2&&analysis.eccentricity>1e-9&&analysis.semiaxes){
    const axis=analysis.foci[1].map((v,i)=>v-analysis.center[i]);
    const norm=Math.hypot(...axis);
    if(norm>0){
      const dir=axis.map(v=>v/norm),a=analysis.semiaxes.major||analysis.semiaxes.real;
      for(const sign of [-1,1])lines.push(perpendicularAt(
        add(analysis.center,mul(dir,sign*a/analysis.eccentricity)),dir,'diretriz'));
      info.push('diretrizes perpendiculares ao eixo focal');
    }
  }
  if(analysis.type==='parabola'&&analysis.vertex&&analysis.foci[0]){
    const axis=analysis.foci[0].map((v,i)=>v-analysis.vertex[i]);
    const focal=Math.hypot(...axis);
    const dir=axis.map(v=>v/(focal||1));
    lines.push(lineThrough(analysis.vertex,dir,'eixo da parábola'));
    lines.push(perpendicularAt(add(analysis.vertex,mul(dir,-focal)),dir,'diretriz'));
    info.push('distância focal = '+fmt(focal),'excentricidade e = 1');
  }
  return {info,points,lines,segments,
    rotationDemo:{
      angle:analysis.rotation,
      center:analysis.center||analysis.vertex||[0,0],
      coefficients:[q.A,q.B,q.C]
    }
  };
}

function analyzeConic(q){
  if(Math.abs(q.B)>EPS) return analyzeRotatedConic(q);
  const result=analyzeAlignedConic(q);
  result.info.push(conicGenus(q).label);
  return result;
}

function analyzeAlignedConic(q){
  const info=[];
  const points=[];
  const lines=[];
  const segments=[];
  const hasX2=Math.abs(q.A)>EPS;
  const hasY2=Math.abs(q.C)>EPS;
  if(hasX2&&hasY2){
    const h=-q.D/(2*q.A);
    const k=-q.E/(2*q.C);
    const K=-q.F+q.D*q.D/(4*q.A)+q.E*q.E/(4*q.C);
    points.push({x:h,y:k,label:'C'});
    lines.push(lineX(h,'eixo x=C','dotted'),lineY(k,'eixo y=C','dotted'));
    const sx=K/q.A, sy=K/q.C;
    if(q.A*q.C>0){
      if(!(sx>0&&sy>0)) return {info:['conica sem pontos reais'],points,lines,segments};
      const rx=Math.sqrt(sx), ry=Math.sqrt(sy);
      if(Math.abs(rx-ry)<=1e-7*Math.max(1,rx,ry)){
        info.push('circunferencia');
        info.push('centro C = '+fmtPoint({x:h,y:k}));
        info.push('raio = '+fmt(rx));
        info.push('excentricidade e = 0');
        segments.push({a:{x:h,y:k},b:{x:h+rx,y:k},label:'r',style:'dotted'});
        return {info,points,lines,segments};
      }
      info.push('elipse');
      info.push('centro C = '+fmtPoint({x:h,y:k}));
      info.push('semieixos = '+fmt(Math.max(rx,ry))+' e '+fmt(Math.min(rx,ry)));
      const major=Math.max(rx,ry), focal=Math.sqrt(Math.max(0,major*major-Math.min(rx,ry)**2));
      info.push('eixo maior '+(rx>=ry?'horizontal':'vertical'));
      info.push('semidistancia focal c = '+fmt(focal)+' (a^2 = b^2 + c^2)');
      info.push('excentricidade e = c/a = '+fmt(focal/major));
      if(rx>=ry){
        const c=Math.sqrt(Math.max(0,rx*rx-ry*ry));
        points.push({x:h-c,y:k,label:'F1'},{x:h+c,y:k,label:'F2'});
        segments.push({a:{x:h-rx,y:k},b:{x:h+rx,y:k},label:'eixo maior',style:'dotted'});
        segments.push({a:{x:h,y:k-ry},b:{x:h,y:k+ry},label:'eixo menor',style:'dotted'});
        if(c>EPS){
          const e=c/rx;
          lines.push(lineX(h-rx/e,'diretriz','dashed'),lineX(h+rx/e,'diretriz','dashed'));
          info.push('focos = '+fmtPoint({x:h-c,y:k})+' e '+fmtPoint({x:h+c,y:k}));
        }
      } else {
        const c=Math.sqrt(Math.max(0,ry*ry-rx*rx));
        points.push({x:h,y:k-c,label:'F1'},{x:h,y:k+c,label:'F2'});
        segments.push({a:{x:h,y:k-ry},b:{x:h,y:k+ry},label:'eixo maior',style:'dotted'});
        segments.push({a:{x:h-rx,y:k},b:{x:h+rx,y:k},label:'eixo menor',style:'dotted'});
        if(c>EPS){
          const e=c/ry;
          lines.push(lineY(k-ry/e,'diretriz','dashed'),lineY(k+ry/e,'diretriz','dashed'));
          info.push('focos = '+fmtPoint({x:h,y:k-c})+' e '+fmtPoint({x:h,y:k+c}));
        }
      }
      return {info,points,lines,segments};
    }
    if(q.A*q.C<0){
      if(Math.abs(sx)<EPS||Math.abs(sy)<EPS) return {info:['hiperbole degenerada'],points,lines,segments};
      const horizontal=sx>0;
      const a=Math.sqrt(Math.abs(horizontal?sx:sy));
      const b=Math.sqrt(Math.abs(horizontal?sy:sx));
      const c=Math.sqrt(a*a+b*b);
      const e=c/a;
      info.push('hiperbole');
      info.push('centro C = '+fmtPoint({x:h,y:k}));
      info.push('semieixos = '+fmt(a)+' e '+fmt(b));
      info.push('eixo real '+(horizontal?'horizontal':'vertical'));
      info.push('semidistancia focal c = '+fmt(c)+' (c^2 = a^2 + b^2)');
      info.push('excentricidade e = c/a = '+fmt(e));
      if(horizontal){
        points.push({x:h-c,y:k,label:'F1'},{x:h+c,y:k,label:'F2'});
        segments.push({a:{x:h-a,y:k},b:{x:h+a,y:k},label:'eixo real',style:'dotted'});
        lines.push(lineX(h-a/e,'diretriz','dashed'),lineX(h+a/e,'diretriz','dashed'));
        info.push('focos = '+fmtPoint({x:h-c,y:k})+' e '+fmtPoint({x:h+c,y:k}));
      } else {
        points.push({x:h,y:k-c,label:'F1'},{x:h,y:k+c,label:'F2'});
        segments.push({a:{x:h,y:k-a},b:{x:h,y:k+a},label:'eixo real',style:'dotted'});
        lines.push(lineY(k-a/e,'diretriz','dashed'),lineY(k+a/e,'diretriz','dashed'));
        info.push('focos = '+fmtPoint({x:h,y:k-c})+' e '+fmtPoint({x:h,y:k+c}));
      }
      return {info,points,lines,segments};
    }
  }
  if(hasX2&&!hasY2&&Math.abs(q.E)>EPS){
    const h=-q.D/(2*q.A);
    const F2=q.F-q.D*q.D/(4*q.A);
    const k=-F2/q.E;
    const p=-q.E/(4*q.A);
    const vertex={x:h,y:k,label:'V'};
    const focus={x:h,y:k+p,label:'F'};
    points.push(vertex,focus);
    lines.push(lineX(h,'eixo','dotted'),lineY(k-p,'diretriz','dashed'));
    info.push('parabola');
    info.push('vertice V = '+fmtPoint(vertex));
    info.push('foco F = '+fmtPoint(focus));
    info.push('diretriz y = '+fmt(k-p));
    info.push('eixo vertical, abertura para '+(p>0?'cima':'baixo'));
    info.push('excentricidade e = 1');
    return {info,points,lines,segments};
  }
  if(hasY2&&!hasX2&&Math.abs(q.D)>EPS){
    const k=-q.E/(2*q.C);
    const F2=q.F-q.E*q.E/(4*q.C);
    const h=-F2/q.D;
    const p=-q.D/(4*q.C);
    const vertex={x:h,y:k,label:'V'};
    const focus={x:h+p,y:k,label:'F'};
    points.push(vertex,focus);
    lines.push(lineY(k,'eixo','dotted'),lineX(h-p,'diretriz','dashed'));
    info.push('parabola');
    info.push('vertice V = '+fmtPoint(vertex));
    info.push('foco F = '+fmtPoint(focus));
    info.push('diretriz x = '+fmt(h-p));
    info.push('eixo horizontal, abertura para a '+(p>0?'direita':'esquerda'));
    info.push('excentricidade e = 1');
    return {info,points,lines,segments};
  }
  return {info:['conica degenerada ou incompleta'],points,lines,segments};
}

function commandCall(text){
  const open=text.indexOf('(');
  if(open<1||!text.endsWith(')')) return null;
  const command=COMMAND_ALIASES[asciiCommand(text.slice(0,open).trim())];
  if(!command) return null;
  let body=text.slice(open+1,-1).trim();
  if(command==='point'&&!body.startsWith('(')&&splitTop(body,',').length===2){
    body='('+body+')';
  }
  // ponto(x,y,z): coordinates, unless the three items are named points (see pointCallBody).
  const parts=command==='point' ? splitTop(body,',') : [];
  if(parts.length===3&&parts.every(part=>!part.trim().startsWith('(')&&!part.includes('='))){
    return {command, body, tupleBody:'('+body+')'};
  }
  return {command, body};
}

function definitionInput(text){
  const ei=findTopLevelEquals(text);
  if(ei<0) return null;
  const lhs=text.slice(0,ei).trim();
  const rhs=text.slice(ei+1).trim();
  // π, π1… name objects built by a command call (planes, §7).
  if(/^\u03c0[a-zA-Z0-9_]*$/.test(lhs)){
    const call=commandCall(rhs);
    return call ? {name:lhs, ...call} : null;
  }
  if(!/^[a-zA-Z][a-zA-Z0-9_]*$/.test(lhs)) return null;
  const call=commandCall(rhs);
  if(call) return {name:lhs, ...call};
  if(rhs.startsWith('(')&&rhs.endsWith(')')) return {name:lhs, command:'point', body:rhs};
  if(rhs.startsWith('[')&&rhs.endsWith(']')) return {name:lhs, command:'matrix', body:rhs};
  return null;
}

function pointCallBody(def,ctx){
  if(!def.tupleBody) return def.body;
  const allNamedPoints=splitTop(def.body,',').every(part=>refFromRegistry(part.trim(),ctx)?.kind==='point');
  return allNamedPoints ? def.body : def.tupleBody;
}

const COMMAND_NAMES_PT={
  angle:'angulo', dot:'produto escalar', projection:'projecao', triangle:'triangulo',
  quadrilateral:'quadrilatero', polygon:'poligono', convexHull:'poligono convexo',
  distance:'distancia', midpoint:'ponto medio', line:'reta', intersect:'intersecao',
  conic:'conica', section:'seção do cone', quadric:'quádrica 3D', surface:'superfície 3D geral', 'quadric-slice':'seção de quádrica', tangent:'plano tangente 3D', matrix:'matriz', plane:'plano', position:'posicao',
  sum:'soma', scale:'escala', cross:'vetorial', triple:'misto',
  parallelepiped:'paralelepipedo', span:'ger', equation3d:'equação em x, y, z'
};

function runCommand(command,body,ctx,definitionName=''){
  if(wants3d(command,body,ctx)){
    const r3=parse3dCommand(command,body,ctx,definitionName);
    if(r3) return r3;
    throw new Error((COMMAND_NAMES_PT[command]||command)+': objetos 3D ainda não são aceitos neste comando');
  }
  if(command==='point') return parsePointCommand(body,ctx,definitionName);
  if(command==='vector') return parseVectorCommand(body,ctx,definitionName);
  if(command==='angle') return parseAngleCommand(body,ctx,definitionName);
  if(command==='dot') return parseDotCommand(body,ctx,definitionName);
  if(command==='projection') return parseProjectionCommand(body,ctx,definitionName);
  if(command==='triangle') return parsePolygonCommand(body,ctx,definitionName,'triangle');
  if(command==='quadrilateral') return parsePolygonCommand(body,ctx,definitionName,'quadrilateral');
  if(command==='polygon') return parsePolygonCommand(body,ctx,definitionName,'polygon');
  if(command==='convexHull') return parsePolygonCommand(body,ctx,definitionName,'convexHull');
  if(command==='distance') return parseDistanceCommand(body,ctx,definitionName);
  if(command==='midpoint') return parseMidpointCommand(body,ctx,definitionName);
  if(command==='line') return parseLineCommand(body,ctx,definitionName);
  if(command==='intersect') return parseIntersectionCommand(body,ctx,definitionName);
  if(command==='conic') return parseConicCommand(body,ctx,definitionName);
  if(command==='matrix') return parseMatrixCommand(body,ctx,definitionName);
  return null;
}

// "u=(…)", "n=(2,-1,k)", "P=A", "v=u": inside an argument list the name before "="
// is a keyword of the command (§7a.2), not a slider; its value is still scanned
// (k above stays a slider). An argument whose value mentions x, y or z, or holds
// another "=", is an equation (a = x + y keeps a as a slider).
function stripArgumentLabels(text,labels=new Set()){
  const src=String(text);
  let out='', i=0;
  const argEnd=from=>{
    let depth=0;
    for(let j=from;j<src.length;j++){
      const c=src[j];
      if(c==='('||c==='['||c==='{') depth++;
      else if(c===')'||c===']'||c==='}'){ if(depth===0) return j; depth--; }
      else if((c===','||c===';')&&depth===0) return j;
    }
    return src.length;
  };
  while(i<src.length){
    const atStart=i===0||/[,;(\[]/.test(src[i-1]);
    if(atStart){
      const m=src.slice(i).match(/^(\s*)([A-Za-z\u03c0][A-Za-z0-9_\u03c0]*)\s*=(?![=])/);
      if(m){
        const valueStart=i+m[0].length, value=src.slice(valueStart,argEnd(valueStart));
        if(!/=/.test(value)&&!/(^|[^A-Za-z0-9_])[xyzXYZ](?=$|[^A-Za-z0-9_])/.test(value)){
          labels.add(m[2]);
          out+=m[1];
          i=valueStart;
          continue;
        }
      }
    }
    out+=src[i++];
  }
  return out;
}

// Commands whose positional scalars are sliders even when an object has that name.
const POSITIONAL_SCALAR_COMMANDS=new Set(['tangent','section','quadric','quadric-slice','scalar-surface']);

// ctx.registry (optional): a name defined as an object in another line
// (vetor: u=…, A = (…)) is that object, not a slider.
export function extractGeometryParams(raw,ctx={}){
  let text=String(raw==null?'':raw).trim();
  let command='';
  const def=definitionInput(text);
  if(def){ text=def.body; command=def.command; }
  else {
    const match=text.match(/^([a-zA-Z\u00c0-\u017f][a-zA-Z0-9\u00c0-\u017f]*)\s*:\s*(.+)$/);
    if(match){ text=match[2]; command=COMMAND_ALIASES[asciiCommand(match[1])]||''; }
  }
  // Names labelled in this same line (vetor: u=(1,2,3), v=u*k) are objects too.
  const labels=new Set();
  text=stripArgumentLabels(text,labels);
  const names=new Set();
  const re=/(^|[^A-Za-z0-9_])([abcdhkmnpqruv])(?=$|[^A-Za-z0-9_])/g;
  let m;
  while((m=re.exec(text))){
    if(GEOMETRY_PARAM_NAMES.has(m[2])) names.add(m[2]);
  }
  if(!POSITIONAL_SCALAR_COMMANDS.has(command)) labels.forEach(name=>names.delete(name));
  const registry=ctx?.registry;
  if(registry&&!POSITIONAL_SCALAR_COMMANDS.has(command)){
    for(const name of [...names]){
      const ref=registry.get(name);
      if(ref&&ref.name===name&&ref.kind!=='scalar') names.delete(name);
    }
  }
  return [...names];
}

export function parseGeometryInput(raw,ctx={}){
  const text=String(raw==null?'':raw).trim();
  const def=definitionInput(text);
  if(def){
    try{
      const r=runCommand(def.command,pointCallBody(def,ctx),ctx,def.name);
      if(r) r.definitionName=def.name;
      return r;
    }catch(err){
      return errorResult(def.command, err?.message || 'entrada invalida');
    }
  }
  const match=text.match(/^([a-zA-Z\u00c0-\u017f][a-zA-Z0-9\u00c0-\u017f]*)\s*:\s*(.+)$/);
  if(!match){
    // Equations in x, y, z without a prefix (§7a.3); lines without z return null.
    try{
      return parseUnprefixed3d(text,ctx);
    }catch(err){
      return errorResult('equation3d', err?.message || 'entrada invalida');
    }
  }
  const command=COMMAND_ALIASES[asciiCommand(match[1])];
  if(!command) return null;
  const body=match[2].trim();
  try{
    return runCommand(command,body,ctx);
  }catch(err){
    return errorResult(command, err?.message || 'entrada invalida');
  }
}

// Shared with src/space3d/geometry3d.js (which geometry.js imports back).
export const _geometryCore={
  fmt,
  result,
  define,
  evalScalar,
  splitTopAny,
  refFromRegistry,
  parsePoint,
  parseConic:(body,ctx)=>parseConicCommand(body,ctx)
};

export const _geometryTest={
  fmt,
  parsePoint,
  parseLineSpec,
  parseConicSpec,
  intersectLines,
  intersectLineConic,
  parseMatrixText
};
