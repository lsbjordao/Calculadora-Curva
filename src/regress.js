"use strict";

import { fmt } from './coords.js';

// Least-squares fitting. Pure: takes arrays of {x,y} points, returns the model
// coefficients, a predict(x) function and the coefficient of determination R².

// Gaussian elimination with partial pivoting. Mutates A (n×n) and b (length n);
// returns the solution vector, or null if the system is singular.
function solve(A, b){
  const n=b.length;
  for(let col=0;col<n;col++){
    let piv=col;
    for(let r=col+1;r<n;r++) if(Math.abs(A[r][col])>Math.abs(A[piv][col])) piv=r;
    if(Math.abs(A[piv][col])<1e-12) return null;
    [A[col],A[piv]]=[A[piv],A[col]];
    [b[col],b[piv]]=[b[piv],b[col]];
    for(let r=0;r<n;r++){
      if(r===col) continue;
      const f=A[r][col]/A[col][col];
      for(let c=col;c<n;c++) A[r][c]-=f*A[col][c];
      b[r]-=f*b[col];
    }
  }
  return b.map((v,i)=>v/A[i][i]);
}

function rSquared(points, predict){
  const mean=points.reduce((s,p)=>s+p.y,0)/points.length;
  let ssRes=0, ssTot=0;
  for(const p of points){
    const e=p.y-predict(p.x);
    ssRes+=e*e;
    ssTot+=(p.y-mean)*(p.y-mean);
  }
  return ssTot===0 ? 1 : 1-ssRes/ssTot;
}

// Polynomial of the given degree (clamped to points.length-1).
export function polyFit(points, degree){
  if(!points || points.length<2) return null;
  const d=Math.max(0, Math.min(degree, points.length-1));
  const size=d+1;
  const A=Array.from({length:size},()=>new Array(size).fill(0));
  const b=new Array(size).fill(0);
  for(const p of points){
    const pows=[]; let xp=1;
    for(let j=0;j<2*d+1;j++){ pows.push(xp); xp*=p.x; }
    for(let i=0;i<size;i++){
      b[i]+=pows[i]*p.y;
      for(let j=0;j<size;j++) A[i][j]+=pows[i+j];
    }
  }
  const coeffs=solve(A,b);
  if(!coeffs) return null;
  const predict=x=>{ let s=0,xp=1; for(const c of coeffs){ s+=c*xp; xp*=x; } return s; };
  return {coeffs, predict, r2:rSquared(points,predict), degree:d};
}

// y = a · e^(b·x), via the linear fit ln y = ln a + b·x (needs y > 0).
export function expFit(points){
  const pts=(points||[]).filter(p=>p.y>0);
  if(pts.length<2) return null;
  const lin=polyFit(pts.map(p=>({x:p.x,y:Math.log(p.y)})), 1);
  if(!lin) return null;
  const a=Math.exp(lin.coeffs[0]), b=lin.coeffs[1];
  const predict=x=>a*Math.exp(b*x);
  return {a, b, predict, r2:rSquared(points,predict)};
}

// y = a · x^b, via the linear fit ln y = ln a + b·ln x (needs x > 0, y > 0).
export function powFit(points){
  const pts=(points||[]).filter(p=>p.x>0&&p.y>0);
  if(pts.length<2) return null;
  const lin=polyFit(pts.map(p=>({x:Math.log(p.x),y:Math.log(p.y)})), 1);
  if(!lin) return null;
  const a=Math.exp(lin.coeffs[0]), b=lin.coeffs[1];
  const predict=x=>a*Math.pow(x,b);
  return {a, b, predict, r2:rSquared(points,predict)};
}

// y = a + b·ln(x), needs x > 0.
export function logFit(points){
  const pts=(points||[]).filter(p=>p.x>0);
  if(pts.length<2) return null;
  const lin=polyFit(pts.map(p=>({x:Math.log(p.x),y:p.y})), 1);
  if(!lin) return null;
  const a=lin.coeffs[0], b=lin.coeffs[1];
  const predict=x=>a+b*Math.log(x);
  return {a, b, predict, r2:rSquared(points,predict)};
}

// Sigmoid / logistic: y = y0 + L / (1 + exp(-(b0 + k·x))).
// The asymptotes are estimated from the observed range, then a linear fit is
// applied to the logit-transformed y values.
export function sigmoidFit(points){
  const pts=(points||[]).filter(p=>Number.isFinite(p.x)&&Number.isFinite(p.y));
  if(pts.length<3) return null;
  const ys=pts.map(p=>p.y);
  const yMin=Math.min(...ys), yMax=Math.max(...ys);
  const observedSpan=yMax-yMin;
  if(Math.abs(observedSpan)<1e-12) return null;
  let best=null;
  for(const margin of [0.02,0.05,0.1,0.2,0.35]){
    const y0=yMin-observedSpan*margin;
    const upper=yMax+observedSpan*margin;
    const L=upper-y0;
    const transformed=[];
    for(const p of pts){
      const ratio=(p.y-y0)/(upper-p.y);
      if(ratio>0 && Number.isFinite(ratio)) transformed.push({x:p.x,y:Math.log(ratio)});
    }
    if(transformed.length<2) continue;
    const lin=polyFit(transformed,1);
    if(!lin) continue;
    const b0=lin.coeffs[0], k=lin.coeffs[1];
    if(Math.abs(k)<1e-12) continue;
    const x0=-b0/k;
    const predict=x=>{
      const z=b0+k*x;
      if(z>700) return y0+L;
      if(z<-700) return y0;
      return y0+L/(1+Math.exp(-z));
    };
    const r2=rSquared(pts,predict);
    const fit={y0, L, k, x0, predict, r2};
    if(!best || fit.r2>best.r2) best=fit;
  }
  return best;
}

// Values this close to zero are floating-point noise from the fit (e.g. a
// sigmoid centre of -6e-17), not information worth printing.
export const cleanNoise=v=>Math.abs(v)<1e-9 ? 0 : v;
const clean=cleanNoise;
const plus=v=>(v<0 ? ' - ' : ' + ')+fmt(Math.abs(v));

// Display label for the non-polynomial models; null for polynomial specs.
export function modelLabel(spec, fit){
  if(spec==='fitexp') return 'y ≈ '+fmt(fit.a)+'·e^('+fmt(clean(fit.b))+'x)';
  if(spec==='fitpow') return 'y ≈ '+fmt(fit.a)+'·x^'+fmt(clean(fit.b));
  if(spec==='fitlog') return 'y ≈ '+fmt(clean(fit.a))+plus(clean(fit.b))+'·ln(x)';
  if(spec==='fitsig'){
    const y0=clean(fit.y0), k=clean(fit.k), x0=clean(fit.x0);
    const shift=x0===0 ? 'x' : '(x'+plus(-x0)+')';
    const exponent=(k>0 ? '-' : '')+fmt(Math.abs(k))+shift;
    return 'y ≈ '+(y0===0 ? '' : fmt(y0)+' + ')+fmt(fit.L)+'/(1+e^('+exponent+'))';
  }
  return null;
}

// Free parameters of each model, for information criteria.
export function modelParamCount(spec){
  if(spec==='fitsig') return 4;                       // y0, L, k, x0
  if(['fitexp','fitpow','fitlog'].includes(spec)) return 2;
  const degree=spec==='fit' ? 1 : Number(String(spec).slice(3));
  return Number.isFinite(degree) && degree>0 ? degree+1 : null;
}

// Corrected Akaike criterion: lower is better. Unlike RMSE or R², it charges
// for every extra parameter, so a degree-4 polynomial only wins when it fits
// clearly better. Undefined (null) when n ≤ k+1.
export function aicc(sse, n, k){
  if(!(n>k+1) || !(sse>=0)) return null;
  return n*Math.log(Math.max(sse, 1e-300)/n) + 2*k + 2*k*(k+1)/(n-k-1);
}
