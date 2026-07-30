"use strict";

import { compile, setImplicitY, splitTop } from './parser.js';

const EPS=1e-9;
const GEOMETRY_PARAM_NAMES=new Set(['a','b','c','d','k','m','n','p','q','r']);

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
    registry.set(String(def.name).toLowerCase(),def);
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
  if(parts.length!==2) throw new Error('ponto precisa de duas coordenadas: '+src);
  return {x:evalScalar(parts[0],ctx), y:evalScalar(parts[1],ctx), label};
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
  return a.x*b.x+a.y*b.y;
}

function vectorNorm(vec){
  const c=vectorComponents(vec);
  return Math.hypot(c.x,c.y);
}

function vectorAngle(u,v){
  const nu=vectorNorm(u), nv=vectorNorm(v);
  if(nu<EPS||nv<EPS) throw new Error('angulo com vetor nulo indefinido');
  const dot=dotVectors(u,v);
  const cos=Math.min(1,Math.max(-1,dot/(nu*nv)));
  const rad=Math.acos(cos);
  return {rad, deg:rad*180/Math.PI, dot};
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
  const denom=vc.x*vc.x+vc.y*vc.y;
  if(denom<EPS) throw new Error('projecao sobre vetor nulo indefinida');
  const coef=(uc.x*vc.x+uc.y*vc.y)/denom;
  const proj={x:coef*vc.x,y:coef*vc.y};
  const r=result('projection','projecao');
  r.vectors=[
    vectorFromComponents(uc,'u'),
    vectorFromComponents(vc,'v'),
    vectorFromComponents(proj,definitionName || 'proj')
  ];
  r.info=['proj_v(u) = ('+fmt(proj.x)+', '+fmt(proj.y)+')','coeficiente = '+fmt(coef),'u · v = '+fmt(uc.x*vc.x+uc.y*vc.y)];
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
  let rows;
  if(text.startsWith('[[')&&text.endsWith(']]')){
    const inner=text.slice(1,-1);
    rows=splitTopAny(inner,',').map(row=>row.trim().replace(/^\[/,'').replace(/\]$/,''));
  } else {
    if(text.startsWith('[')&&text.endsWith(']')) text=text.slice(1,-1);
    rows=splitTopAny(text,';');
  }
  if(rows.length!==2) throw new Error('matriz 2x2 esperada');
  const values=rows.map(row=>splitTopAny(row,',').map(value=>evalScalar(value,ctx)));
  if(values.some(row=>row.length!==2)) throw new Error('cada linha precisa de dois valores');
  return values;
}

function parseMatrixCommand(body,ctx={},definitionName=''){
  const m=parseMatrixText(body,ctx);
  const [[a,b],[c,d]]=m;
  const det=a*d-b*c;
  const tr=a+d;
  const disc=tr*tr-4*det;
  const info=['A = ['+fmt(a)+' '+fmt(b)+'; '+fmt(c)+' '+fmt(d)+']','det = '+fmt(det),'traco = '+fmt(tr)];
  if(disc>=-EPS){
    const root=Math.sqrt(Math.max(0,disc));
    info.push('autovalores = '+fmt((tr-root)/2)+', '+fmt((tr+root)/2));
  } else {
    info.push('autovalores complexos');
  }
  const r=result('matrix','matriz 2x2');
  r.matrix={values:m, det, trace:tr};
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

function analyzeConic(q){
  const info=[];
  const points=[];
  const lines=[];
  const segments=[];
  if(Math.abs(q.B)>EPS){
    return {info:['conica rotacionada','termo xy detectado: desenho implicito sem focos/eixos'],points,lines,segments};
  }
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
        segments.push({a:{x:h,y:k},b:{x:h+rx,y:k},label:'r',style:'dotted'});
        return {info,points,lines,segments};
      }
      info.push('elipse');
      info.push('centro C = '+fmtPoint({x:h,y:k}));
      info.push('semieixos = '+fmt(Math.max(rx,ry))+' e '+fmt(Math.min(rx,ry)));
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
  return {command, body};
}

function definitionInput(text){
  const ei=findTopLevelEquals(text);
  if(ei<0) return null;
  const lhs=text.slice(0,ei).trim();
  if(!/^[a-zA-Z][a-zA-Z0-9_]*$/.test(lhs)) return null;
  const rhs=text.slice(ei+1).trim();
  const call=commandCall(rhs);
  if(call) return {name:lhs, ...call};
  if(rhs.startsWith('(')&&rhs.endsWith(')')) return {name:lhs, command:'point', body:rhs};
  if(rhs.startsWith('[')&&rhs.endsWith(']')) return {name:lhs, command:'matrix', body:rhs};
  return null;
}

function runCommand(command,body,ctx,definitionName=''){
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

export function extractGeometryParams(raw){
  let text=String(raw==null?'':raw).trim();
  const def=definitionInput(text);
  if(def) text=def.body;
  else {
    const match=text.match(/^([a-zA-Z\u00c0-\u017f]+)\s*:\s*(.+)$/);
    if(match) text=match[2];
  }
  const names=new Set();
  const re=/(^|[^A-Za-z0-9_])([abcdkmnpqr])(?=$|[^A-Za-z0-9_])/g;
  let m;
  while((m=re.exec(text))){
    if(GEOMETRY_PARAM_NAMES.has(m[2])) names.add(m[2]);
  }
  return [...names];
}

export function parseGeometryInput(raw,ctx={}){
  const text=String(raw==null?'':raw).trim();
  const def=definitionInput(text);
  if(def){
    try{
      const r=runCommand(def.command,def.body,ctx,def.name);
      if(r) r.definitionName=def.name;
      return r;
    }catch(err){
      return errorResult(def.command, err?.message || 'entrada invalida');
    }
  }
  const match=text.match(/^([a-zA-Z\u00c0-\u017f]+)\s*:\s*(.+)$/);
  if(!match) return null;
  const command=COMMAND_ALIASES[asciiCommand(match[1])];
  if(!command) return null;
  const body=match[2].trim();
  try{
    return runCommand(command,body,ctx);
  }catch(err){
    return errorResult(command, err?.message || 'entrada invalida');
  }
}

export const _geometryTest={
  fmt,
  parsePoint,
  parseLineSpec,
  parseConicSpec,
  intersectLines,
  intersectLineConic,
  parseMatrixText
};
