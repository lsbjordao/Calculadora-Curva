"use strict";

// Curva project document: portable, versioned JSON without executable code.
export const CURVA_PROJECT_FORMAT='curva-project';
export const CURVA_PROJECT_VERSION=1;
export const MAX_PROJECT_BYTES=2_000_000;
const isObject=x=>x!==null&&typeof x==='object'&&!Array.isArray(x);
const finite=x=>typeof x==='number'&&Number.isFinite(x);

export function validateProjectState(state){
  if(!isObject(state))throw new Error('O projeto não contém um estado válido.');
  if(!Array.isArray(state.equations)||!state.equations.length||state.equations.length>500)
    throw new Error('O projeto deve conter entre 1 e 500 linhas.');
  if(state.equations.some(eq=>!isObject(eq)||typeof eq.text!=='string'||eq.text.length>4000))
    throw new Error('Uma das linhas do projeto é inválida ou muito extensa.');
  if(state.view!==undefined&&(!isObject(state.view)||!finite(state.view.cx)||!finite(state.view.cy)||!finite(state.view.scale)||state.view.scale<=0))
    throw new Error('A vista 2D do projeto é inválida.');
  if(state.view3d!==undefined){
    if(!isObject(state.view3d)||!['2d','3d'].includes(state.view3d.mode))
      throw new Error('A vista 3D do projeto é inválida.');
    if(state.view3d.camera!==undefined){
      const c=state.view3d.camera;
      if(!isObject(c)||(c.target!==undefined&&(!Array.isArray(c.target)||c.target.length!==3||!c.target.every(finite))))
        throw new Error('A câmera 3D do projeto é inválida.');
    }
  }
  if(state.annotations!==undefined&&(!Array.isArray(state.annotations)||state.annotations.length>500||
      state.annotations.some(a=>!isObject(a)||!finite(a.x)||!finite(a.y)||typeof a.text!=='string'||a.text.length>4000)))
    throw new Error('As anotações do projeto são inválidas.');
  return state;
}
export function encodeProjectDocument(state,{title='Projeto Curva',now=new Date()}={}){
  validateProjectState(state);
  if(typeof title!=='string'||title.length>120)throw new Error('Título inválido.');
  return JSON.stringify({
    format:CURVA_PROJECT_FORMAT,
    version:CURVA_PROJECT_VERSION,
    title:title.trim()||'Projeto Curva',
    createdAt:now.toISOString(),
    state
  },null,2)+'\n';
}
export function decodeProjectDocument(text){
  if(typeof text!=='string'||new TextEncoder().encode(text).length>MAX_PROJECT_BYTES)
    throw new Error('Arquivo inválido ou maior que 2 MB.');
  let data;
  try{data=JSON.parse(text);}catch{throw new Error('O arquivo não é JSON válido.');}
  if(!isObject(data)||data.format!==CURVA_PROJECT_FORMAT)
    throw new Error('Este arquivo não é um projeto da Calculadora Curva.');
  if(data.version!==CURVA_PROJECT_VERSION)
    throw new Error('Versão do projeto não suportada: '+String(data.version)+'.');
  const state=validateProjectState(data.state);
  // Never import unknown top-level metadata into the app state.
  return {title:typeof data.title==='string'?data.title:'Projeto Curva',state};
}
export function projectFilename(date=new Date()){
  return 'curva-projeto-'+date.toISOString().slice(0,10)+'.json';
}