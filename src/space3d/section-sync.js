"use strict";
import {projectPoint} from './camera.js';
import {worldToSection,sectionToWorld} from './section-analysis.js';

const mix=(a,b,t)=>a.map((v,i)=>v+(b[i]-v)*t);
const closest=(a,b,x,y)=>{
  const vx=b.x-a.x,vy=b.y-a.y,den=vx*vx+vy*vy;
  const t=den>0?Math.min(1,Math.max(0,((x-a.x)*vx+(y-a.y)*vy)/den)):0;
  const px=a.x+t*vx,py=a.y+t*vy;
  return {t,distance:Math.hypot(px-x,py-y)};
};

// Coordinates and distance are measured in CSS screen pixels. Callers should
// not pick a point when the nearest visible curve is beyond thresholdPx.
export function nearestProjectedSection(segments,camera,viewport,x,y,thresholdPx=14){
  if(!Array.isArray(segments)||!camera||!viewport)return null;
  let best=null;
  for(const segment of segments){
    if(!Array.isArray(segment?.a)||!Array.isArray(segment?.b))continue;
    const a=projectPoint(camera,segment.a,viewport),b=projectPoint(camera,segment.b,viewport);
    if(a.behind||b.behind||!Number.isFinite(a.x+b.x+a.y+b.y))continue;
    const hit=closest(a,b,x,y);
    if(hit.distance<=thresholdPx&&(!best||hit.distance<best.distance))
      best={world:mix(segment.a,segment.b,hit.t),distance:hit.distance};
  }
  return best;
}

export function nearestSectionInPlane(segments,xy,x,y,thresholdPx=12){
  if(!Array.isArray(segments))return null;
  let best=null;
  for(const segment of segments){
    if(!Array.isArray(segment?.a)||!Array.isArray(segment?.b))continue;
    const aa=xy(segment.a),bb=xy(segment.b);
    const hit=closest({x:aa[0],y:aa[1]},{x:bb[0],y:bb[1]},x,y);
    if(hit.distance<=thresholdPx&&(!best||hit.distance<best.distance))
      best={local:mix(segment.a,segment.b,hit.t),distance:hit.distance};
  }
  return best;
}

export function linkedWorldFromSection(local,analysis){
  return sectionToWorld(local,analysis);
}
export function linkedSectionFromWorld(world,analysis){
  return worldToSection(world,analysis);
}
