"use strict";

// ℝ³ commands for the geometry analyzer. geometry.js#runCommand calls
// parse3dCommand first whenever involves3d(body) is true; the result keeps the
// usual result(type,label) shape plus `dim: 3` and `scene3d` (primitives of
// scene3d.js, with role but no color: the app sets the line color). 2D points
// and vectors used next to 3D ones are promoted to z = 0 with a warning (§7a.4).
// Absence of `dim` (or dim 2) means a 2D object.

import { _geometryCore as core } from '../geometry.js';
import { compile, setImplicitY } from '../parser.js';
import { makeConicSectionScene } from './conic-sections.js';

const EPS=1e-9;
// Object names: identifiers, plus π, π1… for planes (§7).
const IDENT=/^(?:[A-Za-z]|\u03c0)[A-Za-z0-9_]*$/;

export function toVec3(point){
  if(Array.isArray(point)) return [point[0],point[1],point.length>2 ? point[2] : 0];
  return [point.x,point.y,Number.isFinite(point.z) ? point.z : 0];
}

function point3(point,label=point.label){
  const [x,y,z]=toVec3(point);
  return {x,y,z,label,dim:3};
}

function fmtVec(v){
  return '('+v.map(core.fmt).join(', ')+')';
}

function is3dDefinition(def){
  return def?.dim===3 || def?.value?.dim===3;
}

// Parenthesized groups with three top-level components that are not call
// arguments (a call has an identifier right before its "(").
function hasTripleLiteral(text){
  for(let i=0;i<text.length;i++){
    if(text[i]!=='(') continue;
    let j=i-1;
    while(j>=0&&/\s/.test(text[j])) j--;
    if(j>=0&&/[A-Za-z0-9_]/.test(text[j])) continue;
    let depth=0, end=-1;
    for(let k=i;k<text.length;k++){
      if(text[k]==='('||text[k]==='['||text[k]==='{') depth++;
      else if(text[k]===')'||text[k]===']'||text[k]==='}'){ depth--; if(depth===0){ end=k; break; } }
    }
    if(end<0) return false;
    if(core.splitTopAny(text.slice(i+1,end),',').length===3) return true;
  }
  return false;
}

// Bare identifiers in reference position: list items, "label = name" and call
// arguments such as vetor(A,B). Coordinates inside tuples are scalars, not names.
function referenceNames(text,out=[]){
  for(const raw of core.splitTopAny(text,';').flatMap(part=>core.splitTopAny(part,','))){
    let part=raw.trim();
    const named=part.match(/^[A-Za-z][A-Za-z0-9_]*\s*=\s*([\s\S]+)$/);
    if(named) part=named[1].trim();
    const call=part.match(/^[A-Za-z][A-Za-z0-9_]*\s*\(([\s\S]*)\)$/);
    if(call) referenceNames(call[1],out);
    else if(IDENT.test(part)) out.push(part);
  }
  return out;
}

export function involves3d(body,ctx={}){
  const text=String(body??'');
  try{
    if(hasTripleLiteral(text)) return true;
    return referenceNames(text).some(name=>is3dDefinition(core.refFromRegistry(name,ctx)));
  }catch(_){
    return false;
  }
}

// Like parsePointList in geometry.js (same fallback labels A, B), promoting 2D
// points to z = 0; returns the promoted labels for the warning.
function pointList3(body,ctx,fallbacks=['A','B']){
  const parts=core.splitTopAny(String(body||''),',').map(p=>p.trim()).filter(Boolean);
  const promoted=[];
  const points=parts.map((part,i)=>{
    const p=core.parsePoint(part,fallbacks[i]||'',ctx);
    if(p.dim!==3) promoted.push(p.label||part);
    return point3(p);
  });
  return {points,promoted};
}

function promotionWarning(promoted){
  if(!promoted.length) return [];
  return ['aviso: '+promoted.join(', ')+(promoted.length>1?' têm':' tem')+' duas coordenadas; '+(promoted.length>1?'promovidos':'promovido')+' para z = 0'];
}

function result3(type,label){
  const r=core.result(type,label);
  r.dim=3;
  r.scene3d=[];
  return r;
}

function scenePoint(point){
  const prim={kind:'point', p:toVec3(point), role:'main'};
  if(point.label) prim.label=point.label;
  return prim;
}

function sectionCommand(body,ctx){
  const parts=core.splitTopAny(String(body),',').map(x=>x.trim());
  if(parts.length!==2)throw new Error('seção do cone: use secao: h,k (altura h > 0 e inclinação k).');
  const h=core.evalScalar(parts[0],ctx),k=core.evalScalar(parts[1],ctx);
  const section=makeConicSectionScene(h,k);
  if(!section.count)throw new Error('O plano não corta a parte visível do cone; ajuste h ou k.');
  const result=result3('section','seção do cone');
  result.scene3d=section.scene;
  result.info=section.info;
  result.section={kind:section.type,h,k};
  return result;
}

function pointCommand(body,ctx,definitionName){
  const {points,promoted}=pointList3(body,ctx);
  if(!points.length) throw new Error('adicione pelo menos um ponto');
  if(definitionName&&points.length===1) points[0].label=definitionName;
  const r=result3('point','ponto');
  r.points=points;
  r.info=[...points.map(p=>(p.label?p.label+' = ':'')+fmtVec(toVec3(p))),...promotionWarning(promoted)];
  r.scene3d=points.map(scenePoint);
  points.forEach(point=>{ if(point.label) core.define(r,point.label,'point',point); });
  if(definitionName) core.define(r,definitionName,'point',points[0]);
  return r;
}

function vectorCommand(body,ctx,definitionName){
  const parts=core.splitTopAny(String(body||''),',').map(p=>p.trim()).filter(Boolean);
  const named=parts.length===1 ? parts[0].match(/^([A-Za-z][A-Za-z0-9_]*)\s*=/) : null;
  const {points,promoted}=pointList3(body,ctx,['','']);
  let from={x:0,y:0,z:0,label:'O',dim:3}, to, label='v';
  if(points.length===1){
    label=points[0].label||'v';
    to={...points[0], label};
  } else if(points.length===2){
    [from,to]=points;
    label=(from.label&&to.label) ? from.label+to.label : 'v';
  } else {
    throw new Error('use um vetor ou dois pontos');
  }
  if(definitionName) label=definitionName;
  const comp=toVec3(to).map((c,i)=>c-toVec3(from)[i]);
  const length=Math.hypot(...comp);
  const vector={from,to,label,dim:3};
  const r=result3('vector','vetor');
  r.points=points.length===2 ? [from,to] : [];
  r.vectors=[vector];
  r.info=['vetor '+label+' = '+fmtVec(comp),'|'+label+'| = '+core.fmt(length),...promotionWarning(promoted)];
  r.scene3d=r.points.map(scenePoint);
  const scale=Math.max(1,...toVec3(from).map(Math.abs),...toVec3(to).map(Math.abs));
  if(length>EPS*scale) r.scene3d.push({kind:'arrow', from:toVec3(from), to:toVec3(to), label, role:'main'});
  else r.info.push('aviso: vetor nulo (não desenhado)');
  const name=definitionName || named?.[1];
  if(name) core.define(r,name,'vector',vector);
  return r;
}

// Returns a 3D result, or null when the command has no ℝ³ version yet.
export function parse3dCommand(command,body,ctx={},definitionName=''){
  if(command==='section') return sectionCommand(body,ctx);
  if(command==='point') return pointCommand(body,ctx,definitionName);
  if(command==='vector') return vectorCommand(body,ctx,definitionName);
  if(command==='plane') return planeCommand(body,ctx,definitionName);
  if(command==='line') return lineCommand(body,ctx,definitionName);
  if(command==='intersect') return intersectCommand(body,ctx,definitionName);
  if(command==='distance') return distanceCommand(body,ctx,definitionName);
  if(command==='angle') return angleCommand(body,ctx,definitionName);
  if(command==='position') return positionCommand(body,ctx,definitionName);
  return null;
}

// Routing used by geometry.js#runCommand. plano/posicao exist only in ℝ³; reta,
// intersecao, distancia and angulo go to ℝ³ when an object is 3D or when an
// equation (a "=") mentions the variable z (lines without z keep the 2D
// analyzers, §7a.3). A registered object named z keeps its old meaning.
const ALWAYS_3D=new Set(['plane','position','section']);
const Z_EQUATION_COMMANDS=new Set(['line','intersect','distance','angle']);

function equationWithZ(text,ctx){
  const src=String(text||'');
  if(!src.includes('=')||core.refFromRegistry('z',ctx)) return false;
  for(const m of src.matchAll(/[A-Za-z\u03c0][A-Za-z0-9_\u03c0]*/g)){
    if(m[0]==='z'||m[0]==='Z') return true;
  }
  return false;
}

export function wants3d(command,body,ctx={}){
  if(ALWAYS_3D.has(command)) return true;
  if(involves3d(body,ctx)) return true;
  return Z_EQUATION_COMMANDS.has(command) && equationWithZ(body,ctx);
}

// ── Vector helpers and tolerances ─────────────────────────────────────────
// Tolerances are relative to the size of the inputs (TOL), like linear-algebra.js;
// NULL_TOL decides whether a direction or a normal is the zero vector.

const TOL=1e-9;
const NULL_TOL=1e-12;
const add=(a,b)=>a.map((c,i)=>c+b[i]);
const sub=(a,b)=>a.map((c,i)=>c-b[i]);
const mul=(a,k)=>a.map(c=>c*k);
const dot3=(a,b)=>a[0]*b[0]+a[1]*b[1]+a[2]*b[2];
const cross3=(a,b)=>[a[1]*b[2]-a[2]*b[1],a[2]*b[0]-a[0]*b[2],a[0]*b[1]-a[1]*b[0]];
const len=a=>Math.hypot(a[0],a[1],a[2]);
const noNegZero=x=>x===0 ? 0 : x;
const sizeOf=(...vs)=>Math.max(1,...vs.flat().map(Math.abs));

function v3(value,what='coordenada'){
  const v=toVec3(value);
  if(!v.every(Number.isFinite)) throw new Error(what+' indefinida');
  return v.map(noNegZero);
}

function nullVector(v,...context){
  return len(v)<=NULL_TOL*sizeOf(v,...context);
}

function parallelVectors(u,v){
  return len(cross3(u,v))<=TOL*len(u)*len(v);
}

function pointOnPlane(P,pl){
  return Math.abs(dot3(pl.n,P)-pl.d)/len(pl.n)<=TOL*sizeOf(P,[pl.d/len(pl.n)]);
}

function pointOnLine(P,l){
  return len(cross3(sub(P,l.p),l.v))/len(l.v)<=TOL*sizeOf(P,l.p);
}

function planePoint(pl){
  return mul(pl.n,pl.d/dot3(pl.n,pl.n));
}

function footOnPlane(P,pl){
  return sub(P,mul(pl.n,(dot3(pl.n,P)-pl.d)/dot3(pl.n,pl.n)));
}

function footOnLine(P,l){
  return add(l.p,mul(l.v,dot3(sub(P,l.p),l.v)/dot3(l.v,l.v)));
}

const isLine3=o=>Array.isArray(o?.p)&&Array.isArray(o?.v);
const isPlane3=o=>Array.isArray(o?.n)&&Number.isFinite(o?.d);

// ── Constructors ──────────────────────────────────────────────────────────

export function lineFromPoints(A,B){
  const a=v3(A), b=v3(B), v=sub(b,a);
  if(len(v)<=TOL*sizeOf(a,b)) throw new Error('pontos coincidentes: não determinam uma reta');
  return {p:a, v};
}

export function lineFromPointDir(P,v){
  const p=v3(P), d=v3(v,'vetor diretor');
  if(nullVector(d,p)) throw new Error('vetor diretor nulo: não determina uma reta');
  return {p, v:d};
}

export function planeFromPoints(A,B,C){
  const a=v3(A), b=v3(B), c=v3(C);
  const u=sub(b,a), w=sub(c,a), n=cross3(u,w);
  if(len(u)<=TOL*sizeOf(a,b)||len(w)<=TOL*sizeOf(a,c)||len(n)<=TOL*len(u)*len(w)){
    throw new Error('pontos colineares: não determinam um plano');
  }
  return {n:n.map(noNegZero), d:noNegZero(dot3(n,a))};
}

export function planeFromPointNormal(P,n){
  const p=v3(P), normal=v3(n,'normal');
  if(nullVector(normal,p)) throw new Error('normal nula: não determina um plano');
  return {n:normal, d:noNegZero(dot3(normal,p))};
}

export function planeFromPointDirs(P,u,v){
  const p=v3(P), a=v3(u,'vetor diretor'), b=v3(v,'vetor diretor');
  if(nullVector(a,p)||nullVector(b,p)) throw new Error('vetor diretor nulo: não determina um plano');
  if(parallelVectors(a,b)) throw new Error('vetores diretores paralelos: não determinam um plano');
  const n=cross3(a,b).map(noNegZero);
  return {n, d:noNegZero(dot3(n,p))};
}

// ── Equations in x, y, z ──────────────────────────────────────────────────
// The parser knows x and y (implicit relations) but not z: z is rewritten as
// the symbol @z and fed through the symbols callback.

let zValue=0;

function splitEquals(text){
  const out=[];
  let depth=0, last=0;
  for(let i=0;i<text.length;i++){
    const c=text[i];
    if(c==='('||c==='['||c==='{') depth++;
    else if(c===')'||c===']'||c==='}') depth--;
    else if(c==='='&&depth===0){
      const prev=text[i-1], next=text[i+1];
      if(prev==='<'||prev==='>'||prev==='!'||prev==='='||next==='=') continue;
      out.push(text.slice(last,i));
      last=i+1;
    }
  }
  out.push(text.slice(last));
  return out.map(part=>part.trim());
}

function xyzFunction(expr,ctx){
  const src=String(expr).replace(/[A-Za-z\u03c0][A-Za-z0-9\u03c0]*/g,name=>name==='z'||name==='Z' ? '@z' : name);
  const fn=compile(src,ctx.params||{},{},name=>{
    if(name==='z') return zValue;
    if(typeof ctx.symbols==='function') return ctx.symbols(name);
    throw new Error('nome desconhecido: @'+name);
  });
  if(typeof fn!=='function') throw new Error('equação incompleta');
  return (x,y,z)=>{ setImplicitY(y); zValue=z; return fn(x); };
}

// Affine function of one side: c·(x,y,z) + k.
function affineSide(expr,ctx){
  const fn=xyzFunction(expr,ctx);
  const at=(x,y,z)=>{
    const value=fn(x,y,z);
    if(typeof value!=='number'||!Number.isFinite(value)) throw new Error('equação indefinida: '+String(expr).trim());
    return value;
  };
  const k=at(0,0,0);
  const c=[at(1,0,0)-k,at(0,1,0)-k,at(0,0,1)-k];
  const scale=sizeOf(c,[k]);
  for(const P of [[2,-1,3],[-1.5,2.5,0.5],[0.7,-2.2,-1.3]]){
    if(Math.abs(at(...P)-(dot3(c,P)+k))>1e-8*scale) throw new Error('a equação não é linear em x, y, z');
  }
  return {c,k};
}

export function parsePlaneEquation(text,ctx={}){
  const sides=splitEquals(String(text||''));
  if(sides.length!==2||!sides[0]||!sides[1]) throw new Error('plano: use uma equação como 2x - y + z = 3');
  const L=affineSide(sides[0],ctx), R=affineSide(sides[1],ctx);
  const n=sub(L.c,R.c).map(noNegZero), d=noNegZero(R.k-L.k);
  if(len(n)<=NULL_TOL*sizeOf(L.c,R.c,[d])) throw new Error('a equação não define um plano (coeficientes de x, y, z nulos)');
  return {n, d};
}

// (x-1)/2 = (y+1)/3 = z/1, or any chain of three affine expressions.
function symmetricLine(parts,ctx){
  const sides=parts.map(part=>affineSide(part,ctx));
  const scale=sizeOf(...sides.map(s=>s.c));
  const single=sides.map(s=>{
    const nz=s.c.map((c,i)=>Math.abs(c)>NULL_TOL*scale ? i : -1).filter(i=>i>=0);
    return nz.length===1 ? nz[0] : -1;
  });
  if(single.every(i=>i>=0)&&new Set(single).size===3){
    const p=[0,0,0], v=[0,0,0];
    sides.forEach((s,i)=>{ const j=single[i]; p[j]=noNegZero(-s.k/s.c[j]); v[j]=1/s.c[j]; });
    return lineFromPointDir(p,v);
  }
  const plane=(a,b)=>({n:sub(a.c,b.c), d:b.k-a.k});
  const pl1=plane(sides[0],sides[1]), pl2=plane(sides[1],sides[2]);
  if(len(pl1.n)<=NULL_TOL*scale||len(pl2.n)<=NULL_TOL*scale) throw new Error('as equações não definem uma reta');
  const res=intersectPlanes(pl1,pl2);
  if(res.kind!=='line') throw new Error('as equações não definem uma reta');
  return res.line;
}

// x = 1 + 2t, y = -t, z = 3
function parametricLine(parts,ctx){
  const exprs={};
  for(const part of parts){
    const m=part.match(/^([xyzXYZ])\s*=\s*([\s\S]+)$/);
    if(!m) return null;
    exprs[m[1].toLowerCase()]=m[2];
  }
  if(!exprs.x||!exprs.y||!exprs.z) return null;
  const p=[], v=[];
  for(const name of ['x','y','z']){
    const fn=compile(exprs[name],ctx.params||{});
    if(typeof fn!=='function') throw new Error('reta: expressão vazia para '+name);
    const at=t=>{
      const value=fn(t);
      if(typeof value!=='number'||!Number.isFinite(value)) throw new Error('reta: expressão indefinida para '+name);
      return value;
    };
    const f0=at(0), f1=at(1);
    const scale=sizeOf([f0,f1]);
    for(const t of [2,-1.5]){
      if(Math.abs(at(t)-(f0+t*(f1-f0)))>1e-8*scale) throw new Error('reta: '+name+' precisa ser linear em t');
    }
    p.push(noNegZero(f0)); v.push(noNegZero(f1-f0));
  }
  return lineFromPointDir(p,v);
}

// "P + t*v" / "P - t v" at the top level.
function splitParam(text){
  let depth=0;
  for(let i=0;i<text.length;i++){
    const c=text[i];
    if(c==='('||c==='['||c==='{') depth++;
    else if(c===')'||c===']'||c==='}') depth--;
    else if((c==='+'||c==='-')&&depth===0&&i>0){
      const m=text.slice(i+1).match(/^\s*t(?![A-Za-z0-9_])\s*\*?\s*([\s\S]+)$/);
      if(m) return {left:text.slice(0,i).trim(), sign:c==='-' ? -1 : 1, right:m[1].trim()};
    }
  }
  return null;
}

function isTuple(text){
  if(!text.startsWith('(')||!text.endsWith(')')) return false;
  let depth=0;
  for(let i=0;i<text.length;i++){
    if(text[i]==='(') depth++;
    else if(text[i]===')'){ depth--; if(depth===0&&i<text.length-1) return false; }
  }
  return true;
}

function callBody(text,names){
  const m=String(text||'').trim().match(/^([A-Za-z\u00c0-\u017f]+)\s*\(([\s\S]*)\)$/);
  if(!m) return null;
  const name=m[1].normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase();
  if(!names.includes(name)) return null;
  return isTuple(text.slice(text.indexOf('('))) ? m[2].trim() : null;
}

function splitList(body){
  const text=String(body||'');
  const sep=core.splitTopAny(text,';').length>1 ? ';' : ',';
  return core.splitTopAny(text,sep).map(part=>part.trim()).filter(Boolean);
}

// ── Points, vectors, lines and planes from text ───────────────────────────

const VECTOR_LABELS=new Set(['u','v','w','d','n']);

function partLabel(part){
  const m=part.match(/^([A-Za-z][A-Za-z0-9_]*)\s*=\s*([\s\S]+)$/);
  return m ? {label:m[1], text:m[2].trim()} : {label:'', text:part.trim()};
}

function isVectorPart(part,ctx){
  const {label,text}=partLabel(part);
  if(label) return VECTOR_LABELS.has(label);
  return IDENT.test(text) && core.refFromRegistry(text,ctx)?.kind==='vector';
}

function pointOf(part,ctx,state,fallback=''){
  const p=core.parsePoint(part,fallback,ctx);
  if(p.dim!==3) state.promoted.push(p.label||part);
  return {p:v3(p), label:p.label||''};
}

function vectorOf(part,ctx,state){
  const {label,text}=partLabel(part);
  if(IDENT.test(text)){
    const ref=core.refFromRegistry(text,ctx);
    const value=ref?.value;
    if(ref?.kind==='vector'){
      if(value.dim!==3) state.promoted.push(text);
      return {v:sub(v3(value.to),v3(value.from)).map(noNegZero), label:label||text, from:v3(value.from)};
    }
    if(ref?.kind==='point'){
      if(value.dim!==3) state.promoted.push(text);
      return {v:v3(value), label:label||text};
    }
    if(!ref) throw new Error('nome desconhecido: '+text);
    throw new Error(text+' não é um vetor');
  }
  if(isTuple(text)){
    const p=core.parsePoint(text,'',ctx);
    if(p.dim!==3) state.promoted.push(label||text);
    return {v:v3(p), label};
  }
  throw new Error('vetor esperado: '+part);
}

const LINE_FORMS='reta: use dois pontos, P=(…), v=(…), (…) + t*(…), x = …, y = …, z = … ou (x-1)/2 = (y+1)/3 = z';
const PLANE_FORMS='plano: use uma equação (2x - y + z = 3), três pontos, P=(…), n=(…) ou P=(…), u=(…), v=(…)';

function promote2dLine(line){
  const den=line.a*line.a+line.b*line.b;
  if(!(den>0)) throw new Error('reta degenerada');
  return lineFromPointDir([-line.a*line.c/den,-line.b*line.c/den,0],[line.b,-line.a,0]);
}

// Returns {line, label, extras} (extras: scene primitives of the construction).
function lineSpec(body,ctx,state){
  let text=String(body||'').trim();
  const call=callBody(text,['reta','line']);
  if(call!==null) text=call;
  if(IDENT.test(text)){
    const ref=core.refFromRegistry(text,ctx);
    if(ref?.kind==='line3') return {line:{p:v3(ref.value.p),v:v3(ref.value.v)}, label:text, extras:[]};
    if(ref?.kind==='line'){ state.promoted.push(text); return {line:promote2dLine(ref.value), label:text, extras:[]}; }
    if(!ref) throw new Error('nome desconhecido: '+text);
    throw new Error(text+' não é uma reta');
  }
  const parts=core.splitTopAny(text,',').map(part=>part.trim()).filter(Boolean);
  if(parts.length===3){
    const line=parametricLine(parts,ctx);
    if(line) return {line, extras:[]};
  }
  if(parts.length===1){
    const eqs=splitEquals(text);
    if(eqs.length===3) return {line:symmetricLine(eqs,ctx), extras:[]};
    const param=splitParam(text);
    if(param&&eqs.length===1){
      const P=pointOf(param.left,ctx,state);
      const d=vectorOf(param.right,ctx,state);
      return {line:lineFromPointDir(P.p,mul(d.v,param.sign)), extras:[]};
    }
    throw new Error(LINE_FORMS);
  }
  if(parts.length===2){
    if(isVectorPart(parts[1],ctx)){
      const P=pointOf(parts[0],ctx,state);
      const d=vectorOf(parts[1],ctx,state);
      const line=lineFromPointDir(P.p,d.v);
      return {line, extras:[
        scenePoint({...vecPoint(P.p),label:P.label}),
        {kind:'arrow', from:P.p, to:add(P.p,d.v), label:d.label||'v', role:'aux'}
      ]};
    }
    const A=pointOf(parts[0],ctx,state,'A'), B=pointOf(parts[1],ctx,state,'B');
    return {line:lineFromPoints(A.p,B.p), extras:[A,B].map(P=>scenePoint({...vecPoint(P.p),label:P.label})), through:[A.label,B.label]};
  }
  throw new Error(LINE_FORMS);
}

function planeSpec(body,ctx,state){
  let text=String(body||'').trim();
  const call=callBody(text,['plano','plane']);
  if(call!==null) text=call;
  if(IDENT.test(text)){
    const ref=core.refFromRegistry(text,ctx);
    if(ref?.kind==='plane') return {plane:{n:v3(ref.value.n),d:ref.value.d}, label:text, extras:[]};
    if(!ref) throw new Error('nome desconhecido: '+text);
    throw new Error(text+' não é um plano');
  }
  const parts=core.splitTopAny(text,',').map(part=>part.trim()).filter(Boolean);
  if(parts.length===1){
    if(splitEquals(text).length===2) return {plane:parsePlaneEquation(text,ctx), extras:[]};
    throw new Error(PLANE_FORMS);
  }
  if(parts.length===2){
    const P=pointOf(parts[0],ctx,state);
    const n=vectorOf(parts[1],ctx,state);
    const plane=planeFromPointNormal(P.p,n.v);
    return {plane, extras:[
      scenePoint({...vecPoint(P.p),label:P.label}),
      {kind:'arrow', from:P.p, to:add(P.p,n.v), label:n.label||'n', role:'aux'}
    ]};
  }
  if(parts.length===3){
    if(isVectorPart(parts[1],ctx)&&isVectorPart(parts[2],ctx)){
      const P=pointOf(parts[0],ctx,state);
      const u=vectorOf(parts[1],ctx,state), v=vectorOf(parts[2],ctx,state);
      const plane=planeFromPointDirs(P.p,u.v,v.v);
      return {plane, extras:[
        scenePoint({...vecPoint(P.p),label:P.label}),
        {kind:'arrow', from:P.p, to:add(P.p,u.v), label:u.label||'u', role:'aux'},
        {kind:'arrow', from:P.p, to:add(P.p,v.v), label:v.label||'v', role:'aux'}
      ]};
    }
    const pts=parts.map(part=>pointOf(part,ctx,state));
    const plane=planeFromPoints(pts[0].p,pts[1].p,pts[2].p);
    return {plane, extras:pts.map(P=>scenePoint({...vecPoint(P.p),label:P.label}))};
  }
  throw new Error(PLANE_FORMS);
}

export function parseLine3(body,ctx={}){
  const {line}=lineSpec(body,ctx,{promoted:[]});
  return {p:line.p, v:line.v};
}

export function parsePlane(body,ctx={}){
  const {plane}=planeSpec(body,ctx,{promoted:[]});
  return {n:plane.n, d:plane.d};
}

// Any object of intersecao/distancia/angulo/posicao.
function objectSpec(part,ctx,state){
  const text=part.trim();
  if(IDENT.test(text)){
    const ref=core.refFromRegistry(text,ctx);
    if(!ref) throw new Error('nome desconhecido: '+text);
    const value=ref.value;
    if(ref.kind==='point'){
      if(value.dim!==3) state.promoted.push(text);
      return {kind:'point', point:v3(value), label:text};
    }
    if(ref.kind==='vector'){
      const vec=vectorOf(text,ctx,state);
      return {kind:'vector', vec:vec.v, from:vec.from||[0,0,0], label:text};
    }
    if(ref.kind==='line3'||ref.kind==='line') return {kind:'line', ...lineSpec(text,ctx,state), label:text};
    if(ref.kind==='plane') return {kind:'plane', ...planeSpec(text,ctx,state), label:text};
    throw new Error(text+' não é ponto, vetor, reta nem plano');
  }
  const {label,text:rest}=partLabel(text);
  if(isTuple(text)||(label&&isTuple(rest))){
    const P=pointOf(text,ctx,state);
    return {kind:'point', point:P.p, label:P.label};
  }
  if(callBody(text,['reta','line'])!==null) return {kind:'line', ...lineSpec(text,ctx,state)};
  if(callBody(text,['plano','plane'])!==null) return {kind:'plane', ...planeSpec(text,ctx,state)};
  const pointCall=callBody(text,['ponto','point']);
  if(pointCall!==null){
    const P=pointOf(isTuple(pointCall) ? pointCall : '('+pointCall+')',ctx,state);
    return {kind:'point', point:P.p, label:''};
  }
  const eqs=splitEquals(text);
  if(eqs.length===1&&splitParam(text)) return {kind:'line', ...lineSpec(text,ctx,state)};
  if(eqs.length===2) return {kind:'plane', plane:parsePlaneEquation(text,ctx), extras:[]};
  if(eqs.length===3) return {kind:'line', line:symmetricLine(eqs,ctx), extras:[]};
  throw new Error('não reconheci "'+text+'" como ponto, reta ou plano');
}

// Default names of unnamed objects, by kind: P, Q · r, s · π (π1, π2, π3 when
// several), skipping names already used in the line or in the registry.
const FALLBACK_NAMES={
  point:['P','Q','R','P1','P2','P3'],
  line:['r','s','t','r1','r2','r3'],
  vector:['u','v','w','v1','v2','v3']
};

function objectList(body,ctx,state){
  const objs=splitList(body).map(part=>objectSpec(part,ctx,state));
  const planes=objs.filter(o=>o.kind==='plane'&&!o.label).length;
  const used=new Set(objs.map(o=>o.label).filter(Boolean));
  const free=name=>!used.has(name)&&!core.refFromRegistry(name,ctx);
  objs.forEach(o=>{
    if(o.label) return;
    const names=o.kind==='plane'
      ? (planes>1 ? [] : ['\u03c0']).concat([1,2,3,4,5,6].map(i=>'\u03c0'+i))
      : FALLBACK_NAMES[o.kind];
    o.label=names.find(name=>free(name)) || names.find(name=>!used.has(name)) || names[0];
    used.add(o.label);
  });
  return objs;
}

// ── Intersections ─────────────────────────────────────────────────────────

export function intersectLinePlane(l,pl){
  const den=dot3(pl.n,l.v);
  if(Math.abs(den)<=TOL*len(pl.n)*len(l.v)){
    return {kind:pointOnPlane(l.p,pl) ? 'contained' : 'none'};
  }
  const t=(pl.d-dot3(pl.n,l.p))/den;
  return {kind:'point', point:add(l.p,mul(l.v,t)).map(noNegZero)};
}

export function intersectPlanes(p1,p2){
  const dir=cross3(p1.n,p2.n);
  if(len(dir)<=TOL*len(p1.n)*len(p2.n)){
    return {kind:pointOnPlane(planePoint(p1),p2) ? 'same' : 'none'};
  }
  // Point of the line closest to the origin: α n1 + β n2.
  const a=dot3(p1.n,p1.n), b=dot3(p1.n,p2.n), c=dot3(p2.n,p2.n), den=a*c-b*b;
  const alpha=(p1.d*c-p2.d*b)/den, beta=(p2.d*a-p1.d*b)/den;
  return {kind:'line', line:{p:add(mul(p1.n,alpha),mul(p2.n,beta)).map(noNegZero), v:dir.map(noNegZero)}};
}

export function intersectThreePlanes(p1,p2,p3){
  const planes=[p1,p2,p3];
  const det=dot3(p1.n,cross3(p2.n,p3.n));
  if(Math.abs(det)>TOL*len(p1.n)*len(p2.n)*len(p3.n)){
    const sum=add(add(mul(cross3(p2.n,p3.n),p1.d),mul(cross3(p3.n,p1.n),p2.d)),mul(cross3(p1.n,p2.n),p3.d));
    return {kind:'point', point:mul(sum,1/det).map(noNegZero)};
  }
  for(const [i,j,k] of [[0,1,2],[0,2,1],[1,2,0]]){
    const pair=intersectPlanes(planes[i],planes[j]);
    if(pair.kind==='none') return {kind:'none'};
    if(pair.kind!=='line') continue;
    const hit=intersectLinePlane(pair.line,planes[k]);
    if(hit.kind==='contained') return {kind:'line', line:pair.line};
    if(hit.kind==='point') return hit;
    return {kind:'none'};
  }
  return {kind:'plane', plane:p1};
}

export function intersectLines3(r,s){
  const n=cross3(r.v,s.v), w=sub(s.p,r.p);
  if(len(n)<=TOL*len(r.v)*len(s.v)){
    return {kind:pointOnLine(s.p,r) ? 'same' : 'parallel'};
  }
  if(Math.abs(dot3(w,n))>TOL*len(n)*sizeOf(r.p,s.p)) return {kind:'skew'};
  const t=dot3(cross3(w,s.v),n)/dot3(n,n);
  return {kind:'point', point:add(r.p,mul(r.v,t)).map(noNegZero)};
}

// ── Distances, angles and positions ───────────────────────────────────────

export function distancePointPlane(P,pl){
  const p=v3(P);
  return Math.abs(dot3(pl.n,p)-pl.d)/len(pl.n);
}

export function distancePointLine(P,l){
  const p=v3(P);
  return len(cross3(sub(p,l.p),l.v))/len(l.v);
}

export function distanceLines(r,s){
  let P, Q;
  if(parallelVectors(r.v,s.v)){
    Q=s.p;
    P=footOnLine(Q,r);
  } else {
    const w0=sub(r.p,s.p);
    const a=dot3(r.v,r.v), b=dot3(r.v,s.v), c=dot3(s.v,s.v), d=dot3(r.v,w0), e=dot3(s.v,w0);
    const den=a*c-b*b;
    P=add(r.p,mul(r.v,(b*e-c*d)/den));
    Q=add(s.p,mul(s.v,(a*e-b*d)/den));
  }
  P=P.map(noNegZero); Q=Q.map(noNegZero);
  return {value:len(sub(Q,P)), closest:[P,Q]};
}

export function distancePlanes(p1,p2){
  if(!parallelVectors(p1.n,p2.n)) return 0;
  return distancePointPlane(planePoint(p1),p2);
}

const toDeg=rad=>rad*180/Math.PI;
const clamp01=x=>Math.min(1,Math.max(0,x));

export function angleBetween(a,b){
  if(isLine3(a)&&isLine3(b)) return toDeg(Math.acos(clamp01(Math.abs(dot3(a.v,b.v))/(len(a.v)*len(b.v)))));
  if(isPlane3(a)&&isPlane3(b)) return toDeg(Math.acos(clamp01(Math.abs(dot3(a.n,b.n))/(len(a.n)*len(b.n)))));
  const l=isLine3(a) ? a : b, pl=isPlane3(a) ? a : b;
  if(!isLine3(l)||!isPlane3(pl)) throw new Error('ângulo: use retas e planos');
  return toDeg(Math.asin(clamp01(Math.abs(dot3(l.v,pl.n))/(len(l.v)*len(pl.n)))));
}

export function relativePosition(a,b){
  if(isLine3(a)&&isLine3(b)){
    return {point:'concorrentes', parallel:'paralelas', same:'coincidentes', skew:'reversas'}[intersectLines3(a,b).kind];
  }
  if(isPlane3(a)&&isPlane3(b)){
    return {line:'concorrentes', none:'paralelos', same:'coincidentes'}[intersectPlanes(a,b).kind];
  }
  const l=isLine3(a) ? a : b, pl=isPlane3(a) ? a : b;
  if(!isLine3(l)||!isPlane3(pl)) throw new Error('posição: use retas e planos');
  return {point:'fura', none:'paralela', contained:'contida'}[intersectLinePlane(l,pl).kind];
}

// ── Scene and text ────────────────────────────────────────────────────────

function vecPoint(p){
  return {x:p[0], y:p[1], z:p[2], dim:3};
}

function fmtLinear(c){
  const scale=Math.max(...c.map(Math.abs));
  let out='';
  c.forEach((coef,i)=>{
    if(Math.abs(coef)<=NULL_TOL*scale) return;
    const abs=Math.abs(coef), body=(Math.abs(abs-1)<=1e-12 ? '' : core.fmt(abs))+'xyz'[i];
    out+=out ? (coef<0?' - ':' + ')+body : (coef<0?'-':'')+body;
  });
  return out||'0';
}

function fmtPlane(pl){
  return fmtLinear(pl.n)+' = '+core.fmt(pl.d);
}

function fmtLine(l){
  return 'X = '+fmtVec(l.p)+' + t·'+fmtVec(l.v);
}

// Lines and planes are infinite primitives: render3d.js clips them against the
// visible box at draw time, so parsing does not depend on the view.
function lineScene(l,label,role){
  const prim={kind:'line', p:[...l.p], v:[...l.v], role};
  if(label) prim.label=label;
  return [prim];
}

function planeScene(pl,label,role,alpha=0.25){
  const prim={kind:'plane', n:[...pl.n], d:pl.d, alpha, role};
  if(label) prim.label=label;
  return [prim];
}

function objectScene(o,role='main'){
  if(o.kind==='line') return lineScene(o.line,o.label,role);
  if(o.kind==='plane') return planeScene(o.plane,o.label,role);
  if(o.kind==='point') return [{kind:'point', p:o.point, label:o.label, role}];
  const from=o.from||[0,0,0];
  return [{kind:'arrow', from, to:add(from,o.vec), label:o.label, role}];
}

function mainPoint(p,label){
  return {kind:'point', p, label, role:'main'};
}

function pointValue(p,label){
  return {...vecPoint(p), label};
}

// ── Commands ──────────────────────────────────────────────────────────────

function planeCommand(body,ctx,definitionName){
  const state={promoted:[]};
  const spec=planeSpec(body,ctx,state);
  const label=definitionName||spec.label||'\u03c0';
  const r=result3('plane','plano');
  r.info=[label+': '+fmtPlane(spec.plane),'normal n = '+fmtVec(spec.plane.n),...promotionWarning(state.promoted)];
  r.scene3d=[...spec.extras,...planeScene(spec.plane,label,'main')];
  core.define(r,label,'plane',{n:spec.plane.n, d:spec.plane.d, label, dim:3});
  return r;
}

function lineCommand(body,ctx,definitionName){
  const state={promoted:[]};
  const spec=lineSpec(body,ctx,state);
  const label=definitionName||spec.label||'r';
  const r=result3('line','reta');
  r.info=[label+': '+fmtLine(spec.line),'vetor diretor v = '+fmtVec(spec.line.v)];
  if(spec.through?.every(Boolean)) r.info.unshift('reta por '+spec.through.join(' e '));
  r.info.push(...promotionWarning(state.promoted));
  r.scene3d=[...spec.extras,...lineScene(spec.line,label,'main')];
  core.define(r,label,'line3',{p:spec.line.p, v:spec.line.v, label, dim:3});
  return r;
}

function requireKinds(objs,kinds,message){
  if(objs.some(o=>!kinds.includes(o.kind))) throw new Error(message);
}

function intersectCommand(body,ctx,definitionName){
  const state={promoted:[]};
  const objs=objectList(body,ctx,state);
  if(objs.length<2||objs.length>3) throw new Error('interseção: use duas retas/planos, ou três planos');
  requireKinds(objs,['line','plane'],'interseção: use retas e planos');
  const r=result3('intersect','intersecao');
  const names=objs.map(o=>o.label).join(', ');
  let out;
  if(objs.length===3){
    if(objs.some(o=>o.kind!=='plane')) throw new Error('interseção de três objetos: use três planos');
    const res=intersectThreePlanes(...objs.map(o=>o.plane));
    out=res.kind==='none' ? {kind:'empty', text:'os três planos não têm ponto comum'}
      : res.kind==='plane' ? {kind:'plane', text:'os três planos coincidem'}
      : {...res, text:res.kind==='point' ? 'os três planos se cortam num ponto' : 'os três planos se cortam numa reta'};
  } else {
    const [a,b]=objs;
    if(a.kind==='line'&&b.kind==='line'){
      const res=intersectLines3(a.line,b.line);
      out=res.kind==='point' ? {...res, text:'retas concorrentes'}
        : res.kind==='same' ? {kind:'line', line:a.line, text:'retas coincidentes'}
        : {kind:'empty', text:res.kind==='skew' ? 'retas reversas' : 'retas paralelas'};
    } else if(a.kind==='plane'&&b.kind==='plane'){
      const res=intersectPlanes(a.plane,b.plane);
      out=res.kind==='line' ? {...res, text:'planos concorrentes'}
        : res.kind==='same' ? {kind:'plane', text:'planos coincidentes'}
        : {kind:'empty', text:'planos paralelos'};
    } else {
      const l=a.kind==='line' ? a : b, pl=a.kind==='plane' ? a : b;
      const res=intersectLinePlane(l.line,pl.plane);
      out=res.kind==='point' ? {...res, text:'a reta fura o plano'}
        : res.kind==='contained' ? {kind:'line', line:l.line, text:'a reta está contida no plano'}
        : {kind:'empty', text:'a reta é paralela ao plano'};
    }
  }
  r.scene3d=objs.flatMap(o=>objectScene(o));
  r.info=[names+': '+out.text];
  if(out.kind==='point'){
    const label=definitionName||'P';
    r.points=[pointValue(out.point,label)];
    r.scene3d.push(mainPoint(out.point,label));
    r.info.push(label+' = '+fmtVec(out.point));
    if(definitionName) core.define(r,definitionName,'point',r.points[0]);
  } else if(out.kind==='line'){
    const label=definitionName||'';
    r.info.push('interseção: reta '+fmtLine(out.line));
    r.scene3d.push(...lineScene(out.line,label,'main'));
    if(definitionName) core.define(r,definitionName,'line3',{p:out.line.p, v:out.line.v, label, dim:3});
  } else if(out.kind==='plane'){
    r.info.push('interseção: o próprio plano');
    if(definitionName){
      const pl=objs[0].plane;
      core.define(r,definitionName,'plane',{n:pl.n, d:pl.d, label:definitionName, dim:3});
    }
  } else {
    r.info.push('interseção vazia');
  }
  r.info.push(...promotionWarning(state.promoted));
  return r;
}

function perpendicular(r,from,to,footLabel){
  r.scene3d.push(
    {kind:'segment', a:from, b:to, role:'aux'},
    {kind:'point', p:to, label:footLabel, role:'aux'}
  );
}

function distanceCommand(body,ctx,definitionName){
  const state={promoted:[]};
  const parts=splitList(body);
  const objs=objectList(body,ctx,state);
  if(objs.length!==2) throw new Error('distância: use dois objetos (pontos, retas ou planos)');
  requireKinds(objs,['point','line','plane'],'distância: use pontos, retas e planos');
  // Point–point keeps the 2D names A, B.
  if(objs.every(o=>o.kind==='point')) objs.forEach((o,i)=>{ if(!core.refFromRegistry(parts[i],ctx)&&!partLabel(parts[i]).label) o.label='AB'[i]; });
  const order={point:0,line:1,plane:2};
  const [a,b]=[...objs].sort((x,y)=>order[x.kind]-order[y.kind]);
  const r=result3('distance','distancia');
  r.scene3d=objs.flatMap(o=>objectScene(o));
  const notes=[];
  let value;
  if(a.kind==='point'&&b.kind==='point'){
    value=len(sub(b.point,a.point));
    r.scene3d.push({kind:'segment', a:a.point, b:b.point, role:'main'});
    notes.push('delta = '+fmtVec(sub(objs[1].point,objs[0].point)));
  } else if(a.kind==='point'&&b.kind==='plane'){
    value=distancePointPlane(a.point,b.plane);
    const H=footOnPlane(a.point,b.plane);
    perpendicular(r,a.point,H,'H');
    notes.push('pé da perpendicular H = '+fmtVec(H));
  } else if(a.kind==='point'&&b.kind==='line'){
    value=distancePointLine(a.point,b.line);
    const H=footOnLine(a.point,b.line);
    perpendicular(r,a.point,H,'H');
    notes.push('pé da perpendicular H = '+fmtVec(H));
  } else if(a.kind==='line'&&b.kind==='line'){
    const res=distanceLines(a.line,b.line);
    value=res.value;
    notes.push('posição: '+relativePosition(a.line,b.line));
    if(value>TOL*sizeOf(...res.closest)){
      r.scene3d.push({kind:'segment', a:res.closest[0], b:res.closest[1], role:'aux'});
      res.closest.forEach(p=>r.scene3d.push({kind:'point', p, role:'aux'}));
      notes.push('perpendicular comum de '+fmtVec(res.closest[0])+' a '+fmtVec(res.closest[1]));
    }
  } else if(a.kind==='line'&&b.kind==='plane'){
    const pos=relativePosition(a.line,b.plane);
    notes.push('posição: '+pos);
    value=pos==='paralela' ? distancePointPlane(a.line.p,b.plane) : 0;
    if(value>0) perpendicular(r,a.line.p,footOnPlane(a.line.p,b.plane),'H');
  } else {
    value=distancePlanes(a.plane,b.plane);
    notes.push('posição: '+relativePosition(a.plane,b.plane));
    if(value>0){
      const P=planePoint(a.plane);
      perpendicular(r,P,footOnPlane(P,b.plane),'H');
    }
  }
  r.info=['d('+objs[0].label+', '+objs[1].label+') = '+core.fmt(value),...notes,...promotionWarning(state.promoted)];
  if(definitionName) core.define(r,definitionName,'scalar',value);
  return r;
}

function angleCommand(body,ctx,definitionName){
  const state={promoted:[]};
  const objs=objectList(body,ctx,state);
  const r=result3('angle','angulo');
  let deg, extra=[];
  const asVector=o=>o.kind==='vector' ? o : o.kind==='point' ? {...o, vec:o.point, from:[0,0,0]} : null;
  if(objs.length===3&&objs.every(o=>o.kind==='point')){
    const [A,B,C]=objs;
    const u=sub(A.point,B.point), v=sub(C.point,B.point);
    if(nullVector(u,B.point)||nullVector(v,B.point)) throw new Error('ângulo: vértice coincide com outro ponto');
    deg=toDeg(Math.acos(Math.max(-1,Math.min(1,dot3(u,v)/(len(u)*len(v))))));
    r.scene3d=[...objs.map(o=>mainPoint(o.point,o.label)),
      {kind:'arrow', from:B.point, to:A.point, role:'main'},
      {kind:'arrow', from:B.point, to:C.point, role:'main'}];
    extra=['produto escalar = '+core.fmt(dot3(u,v))];
  } else if(objs.length===2&&objs.every(o=>o.kind==='vector'||o.kind==='point')){
    const [u,v]=objs.map(asVector);
    if(nullVector(u.vec)||nullVector(v.vec)) throw new Error('ângulo: vetor nulo');
    deg=toDeg(Math.acos(Math.max(-1,Math.min(1,dot3(u.vec,v.vec)/(len(u.vec)*len(v.vec))))));
    r.scene3d=[u,v].flatMap(o=>objectScene({...o, kind:'vector'}));
    extra=['produto escalar = '+core.fmt(dot3(u.vec,v.vec))];
  } else if(objs.length===2&&objs.every(o=>o.kind==='line'||o.kind==='plane')){
    const [a,b]=objs.map(o=>o.kind==='line' ? o.line : o.plane);
    deg=angleBetween(a,b);
    r.scene3d=objs.flatMap(o=>objectScene(o));
    extra=['posição: '+relativePosition(a,b)];
  } else {
    throw new Error('ângulo: use duas retas, reta e plano, dois planos, dois vetores ou três pontos');
  }
  const head=objs.length===2 ? 'ângulo('+objs[0].label+', '+objs[1].label+')' : 'ângulo';
  r.info=[head+' = '+core.fmt(deg)+'°','rad = '+core.fmt(deg*Math.PI/180),...extra,...promotionWarning(state.promoted)];
  if(definitionName) core.define(r,definitionName,'scalar',deg);
  return r;
}

function positionCommand(body,ctx){
  const state={promoted:[]};
  const objs=objectList(body,ctx,state);
  if(objs.length!==2) throw new Error('posição: use dois objetos (retas ou planos)');
  requireKinds(objs,['point','line','plane'],'posição: use pontos, retas e planos');
  const r=result3('position','posicao');
  r.scene3d=objs.flatMap(o=>objectScene(o));
  const [a,b]=objs;
  const names=a.label+' e '+b.label;
  const notes=[];
  let text;
  const pt=objs.find(o=>o.kind==='point'), other=objs.find(o=>o!==pt);
  if(pt&&other.kind==='point'){
    text=len(sub(a.point,b.point))<=TOL*sizeOf(a.point,b.point) ? 'coincidentes' : 'distintos';
  } else if(pt){
    const on=other.kind==='line' ? pointOnLine(pt.point,other.line) : pointOnPlane(pt.point,other.plane);
    text=pt.label+(on ? ' pertence a ' : ' não pertence a ')+other.label;
  } else {
    const A=a.kind==='line' ? a.line : a.plane, B=b.kind==='line' ? b.line : b.plane;
    text=relativePosition(A,B);
    if(isLine3(A)&&isLine3(B)){
      const res=intersectLines3(A,B);
      if(res.kind==='point'){ notes.push('ponto comum P = '+fmtVec(res.point)); r.scene3d.push(mainPoint(res.point,'P')); }
      if(res.kind==='parallel'||res.kind==='skew') notes.push('distância = '+core.fmt(distanceLines(A,B).value));
    } else if(isPlane3(A)&&isPlane3(B)){
      const res=intersectPlanes(A,B);
      if(res.kind==='line'){ notes.push('interseção: reta '+fmtLine(res.line)); r.scene3d.push(...lineScene(res.line,'','main')); }
      if(res.kind==='none') notes.push('distância = '+core.fmt(distancePlanes(A,B)));
    } else {
      const l=isLine3(A) ? A : B, pl=isPlane3(A) ? A : B;
      const res=intersectLinePlane(l,pl);
      if(res.kind==='point'){ notes.push('P = '+fmtVec(res.point)); r.scene3d.push(mainPoint(res.point,'P')); }
      if(res.kind==='none') notes.push('distância = '+core.fmt(distancePointPlane(l.p,pl)));
    }
  }
  r.info=[names+': '+text,...notes,...promotionWarning(state.promoted)];
  return r;
}
