"use strict";

import { derivAt, derivativeStep, integralAt, limitAt, safeEval, secondDeriv } from './numeric.js';

function bisect(g,a,b){
  let ga=safeEval(g,a), gb=safeEval(g,b);
  if(!Number.isFinite(ga)||!Number.isFinite(gb)||ga*gb>0) return null;
  for(let k=0;k<60;k++){
    const m=(a+b)/2, gm=safeEval(g,m);
    if(!Number.isFinite(gm)) return null;
    if(ga*gm<=0){ b=m; gb=gm; } else { a=m; ga=gm; }
  }
  return (a+b)/2;
}

function minimizeAbs(g,a,b){
  let lo=a, hi=b;
  for(let k=0;k<44;k++){
    const m1=lo+(hi-lo)/3, m2=hi-(hi-lo)/3;
    const y1=Math.abs(safeEval(g,m1)), y2=Math.abs(safeEval(g,m2));
    if(!Number.isFinite(y1)&&!Number.isFinite(y2)) return null;
    if(y1<=y2) hi=m2; else lo=m1;
  }
  return (lo+hi)/2;
}

function refineNearZero(g,a,b,tol){
  const x=minimizeAbs(g,a,b);
  if(x===null) return null;
  const y=safeEval(g,x);
  return Number.isFinite(y)&&Math.abs(y)<=tol ? x : null;
}

function dedup(xs,tol){
  xs.sort((p,q)=>p-q);
  const out=[];
  for(const x of xs) if(!out.length||Math.abs(x-out[out.length-1])>tol) out.push(x);
  return out;
}

function dedupZeros(f,xs,tol){
  xs.sort((p,q)=>p-q);
  const out=[];
  for(const x of xs){
    if(!out.length||Math.abs(x-out[out.length-1])>tol){
      out.push(x);
      continue;
    }
    const prev=out[out.length-1];
    if(Math.abs(safeEval(f,x))<Math.abs(safeEval(f,prev))) out[out.length-1]=x;
  }
  return out;
}

function dedupPoints(arr,tol){
  const out=[];
  arr.sort((a,b)=>a.x-b.x);
  for(const p of arr) if(!out.length||Math.abs(p.x-out[out.length-1].x)>tol) out.push(p);
  return out;
}

function formatInterval(a,b,fmt){
  if(!Number.isFinite(a)||!Number.isFinite(b)) return '—';
  return '['+fmt(a)+', '+fmt(b)+']';
}

export function formatIntervalList(intervals,fmt,limit=3){
  if(!intervals.length) return '—';
  return intervals.slice(0,limit).map(([a,b])=>formatInterval(a,b,fmt)).join(' ∪ ')+(intervals.length>limit?' …':'');
}

function finiteIntervals(samples){
  const intervals=[];
  let start=null, last=null;
  for(const p of samples){
    if(Number.isFinite(p.y)){
      if(start===null) start=p.x;
      last=p.x;
    } else if(start!==null){
      intervals.push([start,last]); start=null; last=null;
    }
  }
  if(start!==null) intervals.push([start,last]);
  return intervals;
}

function signIntervals(samples,key,sign,eps){
  const intervals=[];
  let start=null, last=null;
  for(const p of samples){
    const v=p[key];
    const active=Number.isFinite(v) && (sign>0 ? v>eps : v<-eps);
    if(active){
      if(start===null) start=p.x;
      last=p.x;
    } else if(start!==null){
      intervals.push([start,last]); start=null; last=null;
    }
  }
  if(start!==null) intervals.push([start,last]);
  return intervals;
}

function classifyCritical(f,dfn,x,dx){
  const h=Math.max(dx*3,derivativeStep(x)*5);
  const dl=safeEval(dfn,x-h), dr=safeEval(dfn,x+h);
  const y=safeEval(f,x);
  if(!Number.isFinite(y)) return null;
  if(Number.isFinite(dl)&&Number.isFinite(dr)){
    if(dl>0&&dr<0) return {kind:'max',x,y};
    if(dl<0&&dr>0) return {kind:'min',x,y};
  }
  return {kind:'flat',x,y};
}

function endAsymptote(f,dir){
  const vals=[1e3,1e4,1e5].map(n=>safeEval(f,dir*n));
  if(vals.some(v=>!Number.isFinite(v))) return null;
  const a=vals[1], b=vals[2];
  return Math.abs(a-b)<=1e-3*Math.max(1,Math.abs(b)) ? b : null;
}

export function htmlEscape(s){
  return String(s).replace(/[&<>"']/g,ch=>({ '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#39;' }[ch]));
}

export function analyzeEq(eq,ctx){
  const {W,H,view,px2wx,fmt}=ctx;
  const key=[eq.text,W,H,view.cx.toPrecision(8),view.cy.toPrecision(8),view.scale.toPrecision(8)].join('|');
  if(eq.analysisCache&&eq.analysisCache.key===key) return eq.analysisCache.value;

  const f=eq.fn;
  const xmin=px2wx(0), xmax=px2wx(W);
  const span=xmax-xmin;
  const N=Math.min(2600,Math.max(700,Math.round(W*1.25)));
  const dx=span/N || 1;
  const tol=Math.max(Math.abs(span)*0.003,1e-7);
  const yVisible=Math.max(1,H/Math.max(view.scale,1e-9));
  const zeroTol=Math.max(1e-7,yVisible*1e-5);
  const slopeTol=1e-4;
  const curvatureTol=1e-4;
  // Exact symbolic derivatives (attached by recompileEq) beat finite
  // differences here: less float noise in critical points and inflections.
  const dfn=eq.deriv1 ? x=>safeEval(eq.deriv1.fn,x) : x=>derivAt(f,x);
  const d2fn=eq.deriv2 ? x=>safeEval(eq.deriv2.fn,x) : x=>secondDeriv(f,x);
  const samples=[];
  let zeros=[], maxs=[], mins=[], flats=[], inflex=[], vAsym=[], holes=[];
  let yLo=Infinity, yHi=-Infinity, hasGap=false, finiteCount=0;

  for(let i=0;i<=N;i++){
    const x=xmin+i*dx;
    const y=safeEval(f,x);
    const d=Number.isFinite(y) ? safeEval(dfn,x) : NaN;
    const s=Number.isFinite(y) ? safeEval(d2fn,x) : NaN;
    samples.push({x,y,d,s});
    if(Number.isFinite(y)){ finiteCount++; if(y<yLo)yLo=y; if(y>yHi)yHi=y; } else hasGap=true;
  }

  const huge=Math.max(1e6,yVisible*200);
  for(let i=1;i<samples.length;i++){
    const a=samples[i-1], b=samples[i];
    if(Number.isFinite(a.y)&&Number.isFinite(b.y)){
      if(Math.abs(a.y)<=zeroTol) zeros.push(a.x);
      if(a.y*b.y<0){
        if(Math.max(Math.abs(a.y),Math.abs(b.y))<huge){
          const r=bisect(f,a.x,b.x); if(r!==null) zeros.push(r);
        } else vAsym.push((a.x+b.x)/2);
      }
      if(Math.max(Math.abs(a.y),Math.abs(b.y))>huge && Math.abs(a.y-b.y)>huge) vAsym.push((a.x+b.x)/2);
    } else if(Number.isFinite(a.y)!==Number.isFinite(b.y)){
      hasGap=true;
      const xc=Number.isFinite(a.y) ? b.x : a.x;
      const lim=limitAt(f,xc);
      if(lim.exists&&Number.isFinite(lim.value)) holes.push({x:xc,y:lim.value});
      else vAsym.push((a.x+b.x)/2);
    }
    if(Number.isFinite(a.d)&&Number.isFinite(b.d)&&a.d*b.d<0){
      const xc=bisect(dfn,a.x,b.x);
      if(xc!==null){
        const crit=classifyCritical(f,dfn,xc,dx);
        if(crit){ if(crit.kind==='max') maxs.push(crit); else if(crit.kind==='min') mins.push(crit); else flats.push(crit); }
      }
    }
  }

  // Inflections: flag a sign change of f'' only between samples whose curvature
  // is meaningfully non-zero. This skips the near-zero sample(s) at the
  // inflection itself and, crucially, ignores floating-point noise on functions
  // whose second derivative is ~0 (e.g. a straight line would otherwise produce
  // hundreds of spurious points).
  let lastCurv=null;
  for(let i=0;i<samples.length;i++){
    const s=samples[i].s;
    if(!Number.isFinite(s)||Math.abs(s)<=curvatureTol) continue;
    const sign=Math.sign(s);
    if(lastCurv&&lastCurv.sign!==sign){
      const xi=bisect(d2fn,lastCurv.x,samples[i].x);
      if(xi!==null){ const yi=safeEval(f,xi); if(Number.isFinite(yi)) inflex.push({x:xi,y:yi}); }
    }
    lastCurv={x:samples[i].x, sign};
  }

  for(let i=1;i<samples.length-1;i++){
    const p=samples[i], l=samples[i-1], r=samples[i+1];
    if(Number.isFinite(p.y) && Math.abs(p.y)<=zeroTol && Math.abs(p.y)<=Math.abs(l.y) && Math.abs(p.y)<=Math.abs(r.y)){
      const z=refineNearZero(f,l.x,r.x,zeroTol*2); if(z!==null) zeros.push(z);
    }
    if(Number.isFinite(p.d) && Math.abs(p.d)<=slopeTol && Math.abs(p.d)<=Math.abs(l.d) && Math.abs(p.d)<=Math.abs(r.d)){
      const xc=refineNearZero(dfn,l.x,r.x,slopeTol*2);
      if(xc!==null){
        const crit=classifyCritical(f,dfn,xc,dx);
        if(crit){ if(crit.kind==='max') maxs.push(crit); else if(crit.kind==='min') mins.push(crit); else flats.push(crit); }
      }
    }
  }

  zeros=dedupZeros(f,zeros,tol); vAsym=dedup(vAsym,tol);
  maxs=dedupPoints(maxs,tol); mins=dedupPoints(mins,tol); flats=dedupPoints(flats,tol); inflex=dedupPoints(inflex,tol); holes=dedupPoints(holes,tol);

  const intervals=finiteIntervals(samples);
  const fullWindow=intervals.length===1 && intervals[0][0]<=xmin+dx*2 && intervals[0][1]>=xmax-dx*2;
  const domain=fullWindow ? 'contínuo na janela' : formatIntervalList(intervals,fmt,4)+' (domínio na janela)';
  const range=finiteCount? '['+fmt(yLo)+', '+fmt(yHi)+'] (na janela)' : '—';
  let yInt=null;
  if(0>=xmin&&0<=xmax){ const v=safeEval(f,0); if(Number.isFinite(v)) yInt=v; }

  let even=true, odd=true, par=0;
  for(let k=1;k<=24;k++){
    const x=k*0.37+0.13, a=safeEval(f,x), b=safeEval(f,-x);
    if(!Number.isFinite(a)||!Number.isFinite(b)) continue;
    par++; const sc=Math.max(1,Math.abs(a),Math.abs(b));
    if(Math.abs(a-b)>1e-6*sc) even=false;
    if(Math.abs(a+b)>1e-6*sc) odd=false;
  }
  const parity = par<4 ? '—' : even?'par (eixo y)' : odd?'ímpar (origem)' : 'nenhuma';
  const inc=signIntervals(samples,'d',1,slopeTol);
  const dec=signIntervals(samples,'d',-1,slopeTol);
  const concUp=signIntervals(samples,'s',1,curvatureTol);
  const concDown=signIntervals(samples,'s',-1,curvatureTol);
  const hr=endAsymptote(f,1), hl=endAsymptote(f,-1);
  let hAsym='—';
  if(hr!==null&&hl!==null&&Math.abs(hr-hl)<=1e-3*Math.max(1,Math.abs(hr))) hAsym='y ≈ '+fmt((hr+hl)/2);
  else if(hr!==null||hl!==null){
    const parts=[];
    if(hl!==null) parts.push('esq y≈'+fmt(hl));
    if(hr!==null) parts.push('dir y≈'+fmt(hr));
    hAsym=parts.join(' · ');
  }
  const dAt0=safeEval(dfn,0);
  const iAt1=integralAt(f,1);
  const result={zeros,maxs,mins,flats,inflex,vAsym,holes,yInt,parity,hAsym,domain,range,hasGap,
                inc,dec,concUp,concDown,dAt0,iAt1};
  eq.analysisCache={key,value:result};
  return result;
}
