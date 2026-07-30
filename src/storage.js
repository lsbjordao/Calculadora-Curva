"use strict";

const STORAGE_KEY='curva-state-v1';

export function loadState(){
  if(typeof localStorage==='undefined') return null;
  try{
    const raw=localStorage.getItem(STORAGE_KEY);
    if(!raw) return null;
    const state=JSON.parse(raw);
    return state&&state.version===1 ? state : null;
  }catch(_){
    return null;
  }
}

export function saveState(state){
  if(typeof localStorage==='undefined') return;
  try{
    localStorage.setItem(STORAGE_KEY, JSON.stringify({version:1,...state}));
  }catch(_){
    /* Storage can be unavailable in private/sandboxed contexts. */
  }
}

export function clearState(){
  if(typeof localStorage==='undefined') return;
  try{
    localStorage.removeItem(STORAGE_KEY);
  }catch(_){
    /* Storage can be unavailable in private/sandboxed contexts. */
  }
}
