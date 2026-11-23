"use strict";

// Screen gesture -> angular and horizontal placement changes for a cutting
// plane. Kept independent of the WebGL and DOM code for deterministic testing.
export const PLANE_DRAG_CONFIG=Object.freeze({degreesPerPixel:.24,unitsPerPixel:.018});
export function dragPlaneParameters(start,delta,{bounds={q:[-90,90],b:[-4,4]}}={}){
  const q=Number(start?.q),b=Number(start?.b),dx=Number(delta?.dx),dy=Number(delta?.dy);
  if(![q,b,dx,dy].every(Number.isFinite))throw new Error('Movimentação do plano inválida.');
  const clamp=(v,limits)=>Math.max(limits[0],Math.min(limits[1],v));
  return {
    q:clamp(q-dy*PLANE_DRAG_CONFIG.degreesPerPixel,bounds.q),
    b:clamp(b-dx*PLANE_DRAG_CONFIG.unitsPerPixel,bounds.b)
  };
}
