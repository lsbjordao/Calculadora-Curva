"use strict";

// Descriptive statistics. Pure: takes arrays of numbers, returns summary metrics.

function sortedFinite(values){
  return (values||[]).filter(Number.isFinite).slice().sort((a,b)=>a-b);
}

// Linear-interpolation quantile on a sorted array.
function quantile(sorted, q){
  if(!sorted.length) return null;
  if(sorted.length===1) return sorted[0];
  const pos=(sorted.length-1)*q;
  const lo=Math.floor(pos), hi=Math.ceil(pos);
  if(lo===hi) return sorted[lo];
  return sorted[lo]+(sorted[hi]-sorted[lo])*(pos-lo);
}

export function describe(values, {population=false}={}){
  const data=sortedFinite(values);
  const n=data.length;
  if(!n) return null;
  const sum=data.reduce((s,v)=>s+v,0);
  const mean=sum/n;
  const min=data[0], max=data[n-1];
  // mode: most frequent value; null when every value is unique, or when 2+
  // distinct values all tie at the top frequency (multimodal). A single
  // repeated value (e.g. [5,5,5]) keeps that value as its mode.
  const counts=new Map();
  let mode=null, best=0;
  for(const v of data){
    const c=(counts.get(v)||0)+1;
    counts.set(v,c);
    if(c>best){ best=c; mode=v; }
  }
  let ties=0;
  for(const c of counts.values()) if(c===best) ties++;
  if(best<=1 || (ties===counts.size && counts.size>1)) mode=null;
  // variance / sd
  let variance=null, sd=null;
  const denom = population ? n : n-1;
  if(denom>0){
    const ss=data.reduce((s,v)=>s+(v-mean)*(v-mean),0);
    variance=ss/denom;
    sd=Math.sqrt(variance);
  }
  const q1=quantile(data,0.25), q3=quantile(data,0.75);
  return { n, sum, mean, median:quantile(data,0.5), mode, variance, sd,
           min, max, range:max-min, q1, q3, iqr:q3-q1 };
}

// Pearson correlation + least-squares line for paired data.
export function pearson(points){
  const pts=(points||[]).filter(p=>p&&Number.isFinite(p.x)&&Number.isFinite(p.y));
  const n=pts.length;
  if(n<2) return null;
  const mx=pts.reduce((s,p)=>s+p.x,0)/n;
  const my=pts.reduce((s,p)=>s+p.y,0)/n;
  let sxy=0, sxx=0, syy=0;
  for(const p of pts){
    const dx=p.x-mx, dy=p.y-my;
    sxy+=dx*dy; sxx+=dx*dx; syy+=dy*dy;
  }
  if(sxx<1e-12 || syy<1e-12) return null;
  const slope=sxy/sxx;
  return { r:sxy/Math.sqrt(sxx*syy), covariance:sxy/(n-1), slope, intercept:my-slope*mx };
}
