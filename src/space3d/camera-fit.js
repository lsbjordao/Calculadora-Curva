"use strict";

// Precise bounds for finite geometry. Excludes infinite planes and lines and
// ignores non-finite values, so "enquadrar" follows the actual surfaces rather
// than assuming the whole scene is centered at the origin.
export function finiteSceneBounds(equations=[]){
  const min=[Infinity,Infinity,Infinity],max=[-Infinity,-Infinity,-Infinity];
  let total=0;
  const include=p=>{
    if(!Array.isArray(p)||p.length!==3||!p.every(Number.isFinite))return;
    p.forEach((v,i)=>{min[i]=Math.min(min[i],v);max[i]=Math.max(max[i],v);});
    total++;
  };
  const visit=prim=>{
    if(!prim)return;
    if(prim.kind==='point'||prim.kind==='label')include(prim.p);
    if(prim.kind==='segment'){include(prim.a);include(prim.b);}
    if(prim.kind==='arrow'){include(prim.from);include(prim.to);}
    if(prim.kind==='polygon')prim.points?.forEach(include);
    if(prim.kind==='mesh')prim.vertices?.forEach(include);
  };
  for(const eq of equations){
    if(!eq||eq.visible===false||eq.error||eq.kind!=='geometry'||eq.geometry?.dim!==3)continue;
    eq.geometry.scene3d?.forEach(visit);
  }
  if(!total)return null;
  // A point-only geometry needs some room for mouse orbit and labels.
  for(let i=0;i<3;i++)if(max[i]-min[i]<.4){
    const mid=(min[i]+max[i])/2;min[i]=mid-.2;max[i]=mid+.2;
  }
  return {min,max,target:min.map((v,i)=>(v+max[i])/2),count:total};
}
