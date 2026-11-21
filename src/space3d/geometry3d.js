"use strict";

// ℝ³ commands for the geometry analyzer. geometry.js#runCommand calls
// parse3dCommand first whenever involves3d(body) is true; the result keeps the
// usual result(type,label) shape plus `dim: 3` and `scene3d` (primitives of
// scene3d.js, with role but no color: the app sets the line color). 2D points
// and vectors used next to 3D ones are promoted to z = 0 with a warning (§7a.4).
// Absence of `dim` (or dim 2) means a 2D object.

import { _geometryCore as core } from '../geometry.js';

const EPS=1e-9;
const IDENT=/^[A-Za-z][A-Za-z0-9_]*$/;

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
  if(command==='point') return pointCommand(body,ctx,definitionName);
  if(command==='vector') return vectorCommand(body,ctx,definitionName);
  return null;
}
