"use strict";

// Screen gesture -> angular and horizontal placement changes for a cutting
// plane. Kept independent of the WebGL and DOM code for deterministic testing.
export const PLANE_DRAG_CONFIG=Object.freeze({degreesPerPixel:.24,unitsPerPixel:.018});
export function dragPlaneParameters(start,delta,{bounds={q:[-90,90],b:[-4,4]}}={}){
  const q=Number(start?.q),b=Number(start?.b),dx=Number(delta?.dx),dy=Number(delta?.dy);
  if(![q,b,dx,dy].every(Number.isFinite))throw new Error('Movimentação do plano inválida.');
  const clamp=(v,limits)=>Math.max(limits[0],Math.min(limits[1],v));
  const angle=clamp(q-dy*PLANE_DRAG_CONFIG.degreesPerPixel,bounds.q);
  const offset=clamp(b-dx*PLANE_DRAG_CONFIG.unitsPerPixel,bounds.b);
  return {
    q:Math.abs(angle)<1e-10?0:angle,
    b:Math.abs(offset)<1e-10?0:offset
  };
}

export function dragConeParameters(start,delta,{kind='cone'}={}){
  const a=Number(start?.a),d=Number(start?.d),dx=Number(delta?.dx),dy=Number(delta?.dy);
  if(![a,d,dx,dy].every(Number.isFinite))throw new Error('Movimentação do cone inválida.');
  return {
    a:kind==='vertex'?a:Math.max(.4,Math.min(2.5,a+dx*.01)),
    d:Math.max(-4,Math.min(4,d-dy*.025))
  };
}
