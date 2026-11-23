"use strict";
import {validateProjectState} from './project-file.js';

// Scene links are a portable subset of Curva's versioned project document.
// We don't share local annotations, UI history or personal lesson progress.
const MAX_LINK_BYTES=12000;
const allowed=new Set(['text','name','params','visible','style','color','lw','showA','showD','showL','showI',
  'showD2','showGeoLabels','showGeoGuides','showAlgebraTransform','showAlgebraTransform3d','showAlgebraSystem','clipSide','surfaceDirection','surfacePoint']);
const isObj=v=>v!==null&&typeof v==='object'&&!Array.isArray(v);
function compactEquation(eq){
  const out={};
  for(const [key,value] of Object.entries(eq||{}))if(allowed.has(key)){
    if(key==='params'&&isObj(value))out.params=Object.fromEntries(
      Object.entries(value).filter(([,x])=>typeof x==='number'&&Number.isFinite(x)));
    else if(key==='surfacePoint'&&Array.isArray(value)&&value.length===2&&value.every(Number.isFinite))
      out.surfacePoint=[...value];
    else if(value===null||['string','number','boolean'].includes(typeof value))out[key]=value;
  }
  return out;
}
function utf8ToBase64url(value){
  const bytes=new TextEncoder().encode(value);
  let binary='';
  for(let i=0;i<bytes.length;i++)binary+=String.fromCharCode(bytes[i]);
  return btoa(binary).replace(/\+/g,'-').replace(/\//g,'_').replace(/=+$/,'');
}
function base64urlToUtf8(data){
  if(!/^[A-Za-z0-9_-]+$/.test(data))throw new Error('Caracteres inválidos no link.');
  const padded=data.replace(/-/g,'+').replace(/_/g,'/')+'='.repeat((4-data.length%4)%4);
  const binary=atob(padded);
  return new TextDecoder('utf-8',{fatal:true}).decode(Uint8Array.from(binary,c=>c.charCodeAt(0)));
}
export function encodeSharedScene(state){
  validateProjectState(state);
  const content={v:1,
    equations:state.equations.map(compactEquation),
    view:state.view,view3d:state.view3d,dualSection:state.dualSection
  };
  const json=JSON.stringify(content);
  if(new TextEncoder().encode(json).length>MAX_LINK_BYTES)
    throw new Error('Cena muito extensa para URL; exporte o projeto JSON.');
  return utf8ToBase64url(json);
}
export function decodeSharedScene(encoded){
  if(typeof encoded!=='string'||!encoded.length||encoded.length>MAX_LINK_BYTES*2)
    throw new Error('Link de cena inválido ou muito longo.');
  let data;
  try{data=JSON.parse(base64urlToUtf8(encoded));}
  catch(e){throw new Error('Não foi possível ler os dados da cena compartilhada.');}
  if(!isObj(data)||data.v!==1)throw new Error('Versão do link da cena não suportada.');
  const state={equations:data.equations,view:data.view,view3d:data.view3d,dualSection:data.dualSection};
  validateProjectState(state);
  return state;
}
