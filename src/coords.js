"use strict";

// Pure formatting and grid helpers. Coordinate projectors (w2px etc.) stay in
// app.js because they run per-pixel in the render loop and must avoid the extra
// indirection/allocation a factory would add.

export function fmt(v){
  if(v===0) return '0';
  const a=Math.abs(v);
  if(a<1e-4||a>=1e6) return v.toExponential(0);
  return parseFloat(v.toPrecision(6)).toString();
}

export function fmtLimitNumber(v){
  if(v===Infinity) return '+∞';
  if(v===-Infinity) return '-∞';
  return Number.isFinite(v) ? fmt(v) : '—';
}

export function formatLimitInfo(lim,x){
  const target=fmt(x);
  if(lim.exists) return "lim x→"+target+" ≈ "+fmtLimitNumber(lim.value);
  const left=lim.left?.exists ? fmtLimitNumber(lim.left.value) : '—';
  const right=lim.right?.exists ? fmtLimitNumber(lim.right.value) : '—';
  return "lim x→"+target+" não existe; esq "+left+", dir "+right;
}

export function formatLimitInfinity(lim, sign){
  const target = sign==='-' ? '-∞' : '+∞';
  if(lim.exists) return "lim x→"+target+" ≈ "+fmtLimitNumber(lim.value);
  return "lim x→"+target+" não existe";
}

// Round a target pixel spacing to a "nice" world-step (1/2/5 × 10^n).
export function niceStep(targetPx, scale){
  const raw=targetPx/scale;
  const mag=Math.pow(10,Math.floor(Math.log10(raw)));
  const n=raw/mag;
  let step;
  if(n<1.5) step=1; else if(n<3.5) step=2; else if(n<7.5) step=5; else step=10;
  return step*mag;
}

export function snapToStep(value, step){
  if(!Number.isFinite(value)||!Number.isFinite(step)||step<=0) return value;
  return Number((Math.round(value/step)*step).toPrecision(12));
}
