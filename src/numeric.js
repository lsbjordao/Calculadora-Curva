"use strict";

export const MAX_ABS_VALUE=1e12;

let viewportProvider=()=>({scale:38,W:0,H:0,px2wx:px=>px});

export function configureNumeric(provider){
  viewportProvider=provider;
}

function viewport(){
  return viewportProvider();
}

export function isUsableNumber(v){
  return Number.isFinite(v) && Math.abs(v)<MAX_ABS_VALUE;
}

export function safeEval(f,x){
  try{
    const v=f(x);
    return isUsableNumber(v) ? v : NaN;
  }catch(_){
    return NaN;
  }
}

// Point-relative step, independent of the viewport: reported derivative values
// must not change with zoom. 7e-4 ≈ eps^(1/5), optimal for the 5-point stencil.
export function derivativeStep(x){
  return 7e-4*Math.max(1,Math.abs(x));
}

export function derivAt(f,x){
  const h0=derivativeStep(x);
  for(const factor of [1,0.5,0.25,2]){
    const h=h0*factor;
    const ym2=safeEval(f,x-2*h), ym1=safeEval(f,x-h);
    const yp1=safeEval(f,x+h), yp2=safeEval(f,x+2*h);
    if([ym2,ym1,yp1,yp2].every(Number.isFinite)){
      return (ym2-8*ym1+8*yp1-yp2)/(12*h);
    }
  }
  const h=h0;
  const ym=safeEval(f,x-h), yp=safeEval(f,x+h);
  return Number.isFinite(ym)&&Number.isFinite(yp) ? (yp-ym)/(2*h) : NaN;
}

// One-sided derivatives (2nd-order stencils). At a corner like |x| in 0 the
// two sides disagree; derivInfo uses that to flag non-differentiable points.
export function derivSides(f,x){
  const h0=derivativeStep(x);
  const side=dir=>{
    for(const factor of [1,0.5,0.25,2]){
      const h=h0*factor;
      const y0=safeEval(f,x), y1=safeEval(f,x+dir*h), y2=safeEval(f,x+dir*2*h);
      if([y0,y1,y2].every(Number.isFinite)){
        return dir*(-3*y0+4*y1-y2)/(2*h);
      }
    }
    return NaN;
  };
  return {left:side(-1), right:side(1)};
}

export function derivInfo(f,x){
  const y=safeEval(f,x);
  if(!Number.isFinite(y)){
    return {value:NaN, left:NaN, right:NaN, differentiable:false, reason:'undefined-point'};
  }
  const {left,right}=derivSides(f,x);
  const value=derivAt(f,x);
  if(!Number.isFinite(left)||!Number.isFinite(right)){
    return {value, left, right, differentiable:false, reason:'singular'};
  }
  if(Math.abs(left-right)>Math.max(1e-3, 0.05*Math.max(1,Math.abs(left),Math.abs(right)))){
    return {value, left, right, differentiable:false, reason:'corner'};
  }
  return {value, left, right, differentiable:true, reason:null};
}

export function secondDeriv(f,x){
  const h0=Math.max(derivativeStep(x)*1.8,1e-5);
  for(const factor of [1,0.5,2]){
    const h=h0*factor;
    const ym2=safeEval(f,x-2*h), ym1=safeEval(f,x-h), y0=safeEval(f,x);
    const yp1=safeEval(f,x+h), yp2=safeEval(f,x+2*h);
    if([ym2,ym1,y0,yp1,yp2].every(Number.isFinite)){
      return (-yp2+16*yp1-30*y0+16*ym1-ym2)/(12*h*h);
    }
  }
  return NaN;
}

export function segmentIntegral(f,a,b){
  const fa=safeEval(f,a), fm=safeEval(f,(a+b)/2), fb=safeEval(f,b);
  const fq1=safeEval(f,a+(b-a)/4), fq3=safeEval(f,a+3*(b-a)/4);
  if([fa,fq1,fm,fq3,fb].some(v=>!Number.isFinite(v))) return NaN;
  return (fa+4*fm+fb)*(b-a)/6;
}

export function integ(f,a,b){
  if(a===b) return 0;
  const {scale}=viewport();
  const span=Math.abs(b-a);
  let n=Math.ceil(Math.max(80, Math.min(8192, span*64, span*Math.max(scale,1)/2)));
  if(n%2) n++;
  const dx=(b-a)/n;
  let odd=0, even=0;
  const first=safeEval(f,a), last=safeEval(f,b);
  if(!Number.isFinite(first)||!Number.isFinite(last)) return NaN;
  for(let i=1;i<n;i++){
    const v=safeEval(f,a+i*dx);
    if(!Number.isFinite(v)) return NaN;
    if(i%2) odd+=v; else even+=v;
  }
  return dx/3*(first+last+4*odd+2*even);
}

export function integralAt(f,x){
  return integ(f,0,x);
}

function estimateLimitSide(f,x,dir){
  const base=Math.max(derivativeStep(x)*8,1e-4*Math.max(1,Math.abs(x)));
  const values=[];
  for(const factor of [1,0.5,0.25,0.125,0.0625,0.03125,0.015625]){
    const h=Math.max(base*factor,1e-10);
    values.push(safeEval(f,x+dir*h));
  }
  const finite=values.filter(Number.isFinite);
  if(finite.length<3) return {exists:false,value:NaN,kind:'undefined'};
  const first=finite[0], last=finite[finite.length-1];
  const tail=finite.slice(-3);
  const spread=Math.max(...tail)-Math.min(...tail);
  const tol=Math.max(1e-5,1e-4*Math.max(1,Math.abs(last)));
  const center=safeEval(f,x);
  if(Number.isFinite(center)){
    const centerScale=Math.max(1,Math.abs(center),Math.abs(last));
    const centerTol=Math.max(1e-5,5e-3*centerScale);
    if(Math.abs(last-center)<=centerTol){
      return {exists:true,value:center,kind:'finite',spread};
    }
  }
  if(Math.abs(last)>1e6 && Math.abs(last)>Math.abs(first)*4){
    return {exists:true,value:last>0?Infinity:-Infinity,kind:'infinite'};
  }
  return {exists:spread<=tol,value:last,kind:spread<=tol?'finite':'unstable',spread};
}

export function limitAt(f,x){
  const left=estimateLimitSide(f,x,-1);
  const right=estimateLimitSide(f,x,1);
  const bothFinite=left.exists&&right.exists&&Number.isFinite(left.value)&&Number.isFinite(right.value);
  const bothInfinite=left.exists&&right.exists&&!Number.isFinite(left.value)&&left.value===right.value;
  if(bothFinite){
    const scale=Math.max(1,Math.abs(left.value),Math.abs(right.value));
    if(Math.abs(left.value-right.value)<=1e-3*scale){
      return {exists:true,value:(left.value+right.value)/2,left,right,kind:'finite'};
    }
  }
  if(bothInfinite) return {exists:true,value:left.value,left,right,kind:'infinite'};
  return {exists:false,value:NaN,left,right,kind:'mismatch'};
}

export function limitAtInfinity(f, dir){
  const sign = dir<0 ? -1 : 1;
  const finite=[];
  for(const mag of [10,1e2,1e3,1e4,1e5,1e6,1e7,1e8]){
    const v=safeEval(f, sign*mag);
    if(Number.isFinite(v)) finite.push(v);
  }
  if(finite.length<3) return {exists:false, value:NaN, kind:'undefined'};
  const tail=finite.slice(-3);
  const last=tail[tail.length-1];
  const spread=Math.max(...tail)-Math.min(...tail);
  const scale=Math.max(1, Math.abs(last));
  if(spread<=1e-4*scale) return {exists:true, value:last, kind:'finite'};
  const first=finite[0];
  if(Math.abs(last)>1e6 && Math.abs(last)>Math.abs(first)*4){
    return {exists:true, value: last>0?Infinity:-Infinity, kind:'infinite'};
  }
  return {exists:false, value:NaN, kind:'unstable'};
}
