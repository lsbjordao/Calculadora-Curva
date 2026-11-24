"use strict";

import { normalizeInput } from './parser.js';

// Symbolic differentiation over a small AST covering the differentiable subset
// of the calculator language. Anything outside it (piecewise, lim, sum, fits,
// matrices, user functions, y) makes parseExpr/differentiate return null and
// callers fall back to the numeric derivative.
//
// AST nodes: {t:'num',v} {t:'sym',name} {t:'konst',name} {t:'param',name}
//            {t:'call',name,args} {t:'bin',op,l,r} {t:'neg',u}
// x, t and theta are all "the variable" (they all read the compiled function's
// single argument, mirroring parser.compile).

const KNOWN_FUNCS=new Set(['sin','cos','tan','asin','acos','atan','sec','csc','cot',
  'sinh','cosh','tanh','asinh','acosh','atanh','ln','log','log2','sqrt','cbrt','abs',
  'exp','floor','ceil','round','sign']);
const ALIASES={ sen:'sin', seno:'sin', tg:'tan', arcsin:'asin', arcsen:'asin',
  arccos:'acos', arctan:'atan', arctg:'atan', log10:'log', raiz:'root' };
const CONST_NAMES=new Set(['pi','e','tau','phi']);
const PARAM_NAMES=new Set(['a','b','c','d','i','j','k','m','n','p','q','r']);
const VAR_NAMES=new Set(['x','y','z','t','theta']);

const EVAL={ sin:Math.sin, cos:Math.cos, tan:Math.tan, asin:Math.asin, acos:Math.acos,
  atan:Math.atan, sec:v=>1/Math.cos(v), csc:v=>1/Math.sin(v), cot:v=>1/Math.tan(v),
  sinh:Math.sinh, cosh:Math.cosh, tanh:Math.tanh, asinh:Math.asinh, acosh:Math.acosh,
  atanh:Math.atanh, ln:Math.log, log:v=>Math.log10(v), log2:Math.log2, sqrt:Math.sqrt,
  cbrt:Math.cbrt, abs:Math.abs, exp:Math.exp, floor:Math.floor, ceil:Math.ceil,
  round:Math.round, sign:Math.sign };

const num=v=>({t:'num',v});
const sym=name=>({t:'sym',name});
const kon=name=>({t:'konst',name});
const par=name=>({t:'param',name});
const call=(name,args)=>({t:'call',name,args});
const bin=(op,l,r)=>({t:'bin',op,l,r});
const neg=u=>({t:'neg',u});
const mul=(a,b)=>bin('*',a,b);
const div=(a,b)=>bin('/',a,b);
const powN=(u,n)=>bin('^',u,num(n));
const mulN=fs=>fs.reduce((acc,f)=>acc===null?f:mul(acc,f), null);

function tokenizeExpr(str){
  const t=[]; let i=0;
  const NUM_RE=/^(?:\d+(?:\.\d*)?|\.\d+)(?:[eE][+-]?\d+)?/;
  while(i<str.length){
    const c=str[i];
    if(/\s/.test(c)){ i++; continue; }
    if(/[0-9.]/.test(c)){
      const m=str.slice(i).match(NUM_RE);
      if(!m||!Number.isFinite(Number(m[0]))) throw new Error("num");
      t.push({type:'num',value:Number(m[0])}); i+=m[0].length; continue;
    }
    if(/[a-zA-Zπ]/.test(c)){
      let j=i+1; while(j<str.length&&/[a-zA-Z0-9π]/.test(str[j])) j++;
      let raw=str.slice(i,j).toLowerCase();
      if(raw==='π') raw='pi';
      const name=ALIASES[raw]||raw;
      i=j;
      if(KNOWN_FUNCS.has(name)) t.push({type:'func',name});
      else if(name==='root') t.push({type:'root'});
      else if(name==='deriv') t.push({type:'deriv'});
      else if(CONST_NAMES.has(name)) t.push({type:'konst',name});
      else if(VAR_NAMES.has(name)) t.push({type:'sym',name});
      else if(PARAM_NAMES.has(name)) t.push({type:'param',name});
      else throw new Error("nome");
      continue;
    }
    if('+-*/^(),'.includes(c)){ t.push({type:'op',value:c}); i++; continue; }
    throw new Error("char");
  }
  const out=[];
  for(let k=0;k<t.length;k++){
    out.push(t[k]);
    const a=t[k], b=t[k+1];
    if(!b) continue;
    const aEnd=a.type==='num'||a.type==='konst'||a.type==='sym'||a.type==='param'||(a.type==='op'&&a.value===')');
    const bStart=b.type==='num'||b.type==='konst'||b.type==='sym'||b.type==='param'||b.type==='func'||b.type==='root'||b.type==='deriv'||(b.type==='op'&&b.value==='(');
    if(aEnd&&bStart) out.push({type:'op',value:'*'});
  }
  return out;
}

export function parseExpr(text){
  let tokens;
  try{ tokens=tokenizeExpr(normalizeInput(String(text==null?'':text))); }
  catch(_){ return null; }
  if(!tokens.length) return null;
  let p=0;
  const peek=()=>tokens[p];
  const eat=()=>tokens[p++];
  const isOp=v=>peek()&&peek().type==='op'&&peek().value===v;
  const expect=v=>{ if(!isOp(v)) throw new Error("esperava "+v); eat(); };
  function expr(){ let n=term(); while(isOp('+')||isOp('-')){ const op=eat().value; n=bin(op,n,term()); } return n; }
  function term(){ let n=unary(); while(isOp('*')||isOp('/')){ const op=eat().value; n=bin(op,n,unary()); } return n; }
  function unary(){ if(isOp('-')){ eat(); return neg(unary()); } if(isOp('+')){ eat(); return unary(); } return power(); }
  function power(){ const b=primary(); if(isOp('^')){ eat(); return bin('^',b,unary()); } return b; }
  function primary(){
    const tk=peek();
    if(!tk) throw new Error("fim");
    if(tk.type==='num'){ eat(); return num(tk.value); }
    if(tk.type==='konst'){ eat(); return kon(tk.name); }
    if(tk.type==='sym'){ eat(); return sym(tk.name); }
    if(tk.type==='param'){ eat(); return par(tk.name); }
    if(tk.type==='func'){
      eat();
      if(isOp('(')){ eat(); const a=expr(); expect(')'); return call(tk.name,[a]); }
      return call(tk.name,[unary()]);
    }
    if(tk.type==='root'){ eat(); expect('('); const n1=expr(); expect(','); const u=expr(); expect(')'); return call('root',[n1,u]); }
    if(tk.type==='deriv'){
      // Resolved at parse time: deriv(u) becomes d/dx of u.
      eat(); expect('('); const u=expr(); expect(')');
      const d=differentiate(u);
      if(!d) throw new Error("deriv");
      return d;
    }
    if(isOp('(')){ eat(); const e=expr(); expect(')'); return e; }
    throw new Error("token");
  }
  try{
    const ast=expr();
    return p<tokens.length ? null : ast;
  }catch(_){ return null; }
}

export function containsVar(node){
  if(!node) return false;
  if(node.t==='sym') return true;
  if(node.t==='neg') return containsVar(node.u);
  if(node.t==='bin') return containsVar(node.l)||containsVar(node.r);
  if(node.t==='call') return node.args.some(containsVar);
  return false;
}

// name -> (u, du) -> derivative AST (chain rule applied by the caller passing du).
const CHAIN={
  sin:(u,du)=>mul(call('cos',[u]),du),
  cos:(u,du)=>neg(mul(call('sin',[u]),du)),
  tan:(u,du)=>div(du,powN(call('cos',[u]),2)),
  sec:(u,du)=>mulN([call('sec',[u]),call('tan',[u]),du]),
  csc:(u,du)=>neg(mulN([call('csc',[u]),call('cot',[u]),du])),
  cot:(u,du)=>neg(div(du,powN(call('sin',[u]),2))),
  asin:(u,du)=>div(du,call('sqrt',[bin('-',num(1),powN(u,2))])),
  acos:(u,du)=>neg(div(du,call('sqrt',[bin('-',num(1),powN(u,2))]))),
  atan:(u,du)=>div(du,bin('+',num(1),powN(u,2))),
  sinh:(u,du)=>mul(call('cosh',[u]),du),
  cosh:(u,du)=>mul(call('sinh',[u]),du),
  tanh:(u,du)=>div(du,powN(call('cosh',[u]),2)),
  asinh:(u,du)=>div(du,call('sqrt',[bin('+',powN(u,2),num(1))])),
  acosh:(u,du)=>div(du,call('sqrt',[bin('-',powN(u,2),num(1))])),
  atanh:(u,du)=>div(du,bin('-',num(1),powN(u,2))),
  ln:(u,du)=>div(du,u),
  log:(u,du)=>div(du,mul(u,call('ln',[num(10)]))),
  log2:(u,du)=>div(du,mul(u,call('ln',[num(2)]))),
  sqrt:(u,du)=>div(du,mul(num(2),call('sqrt',[u]))),
  cbrt:(u,du)=>div(du,mul(num(3),powN(call('cbrt',[u]),2))),
  exp:(u,du)=>mul(call('exp',[u]),du),
  abs:(u,du)=>mul(call('sign',[u]),du),
};
// Zero almost everywhere; jumps/corners are reported numerically by derivInfo.
const STEP_FUNCS=new Set(['floor','ceil','round','sign']);

// Shared with the step-by-step engines (steps.js / integrate.js).
export { CHAIN, STEP_FUNCS };

export function differentiate(node){
  if(!node) return null;
  switch(node.t){
    case 'num': case 'konst': case 'param': return num(0);
    case 'sym': return num(1);
    case 'neg': { const d=differentiate(node.u); return d&&neg(d); }
    case 'bin': {
      const {op,l,r}=node;
      if(op==='+'||op==='-'){
        const dl=differentiate(l), dr=differentiate(r);
        return dl&&dr ? bin(op,dl,dr) : null;
      }
      if(op==='*'){
        const dl=differentiate(l), dr=differentiate(r);
        return dl&&dr ? bin('+',mul(dl,r),mul(l,dr)) : null;
      }
      if(op==='/'){
        const dl=differentiate(l);
        if(!dl) return null;
        if(!containsVar(r)) return div(dl,r);
        const dr=differentiate(r);
        if(!dr) return null;
        return div(bin('-',mul(dl,r),mul(l,dr)), powN(r,2));
      }
      if(op==='^'){
        const du=differentiate(l);
        if(!du) return null;
        if(!containsVar(r)) return mulN([r, bin('^',l,bin('-',r,num(1))), du]);
        const dv=differentiate(r);
        if(!dv) return null;
        if(!containsVar(l)) return mulN([bin('^',l,r), call('ln',[l]), dv]);
        return mul(bin('^',l,r), bin('+', mul(dv,call('ln',[l])), div(mul(r,du),l)));
      }
      return null;
    }
    case 'call': {
      const name=node.name;
      if(STEP_FUNCS.has(name)) return num(0);
      if(name==='root'){
        const [n,u]=node.args;
        if(containsVar(n)) return null;
        const du=differentiate(u);
        if(!du) return null;
        return div(du, mul(n, bin('^',call('root',[n,u]),bin('-',n,num(1)))));
      }
      const rule=CHAIN[name];
      if(!rule||node.args.length!==1) return null;
      const du=differentiate(node.args[0]);
      return du ? rule(node.args[0],du) : null;
    }
  }
  return null;
}

function realRootNum(n,v){
  if(!Number.isFinite(n)||!Number.isFinite(v)) return NaN;
  if(v<0){
    const k=Math.round(n);
    if(Math.abs(n-k)<1e-9&&k%2!==0) return -Math.pow(-v,1/n);
    return NaN;
  }
  return Math.pow(v,1/n);
}

function simpCall(name,args){
  if(name==='ln'&&args[0].t==='konst'&&args[0].name==='e') return num(1);
  if(args.length===1&&args[0].t==='num'&&EVAL[name]){
    const v=EVAL[name](args[0].v);
    if(Number.isFinite(v)&&Math.abs(v-Math.round(v))<1e-12) return num(Math.round(v));
  }
  if(name==='root'&&args.length===2&&args[0].t==='num'&&args[1].t==='num'){
    const v=realRootNum(args[0].v,args[1].v);
    if(Number.isFinite(v)&&Math.abs(v-Math.round(v))<1e-12) return num(Math.round(v));
  }
  return call(name,args);
}

function simpPow(l,r){
  if(r.t==='num'){
    if(r.v===0) return num(1);
    if(r.v===1) return l;
    if(l.t==='num'&&Number.isInteger(l.v)&&Number.isInteger(r.v)){
      const v=Math.pow(l.v,r.v);
      if(Number.isFinite(v)&&Math.abs(v)<=1e9) return num(v);
    }
    if(l.t==='bin'&&l.op==='^'&&l.r.t==='num'){
      // (u^a)^b = u^(a·b) só vale sempre com b inteiro (ou a ímpar, que
      // preserva o domínio/sinal); (x^2)^0.5 é |x|, não x.
      const a=l.r.v;
      if(Number.isInteger(r.v) || (Number.isInteger(a)&&a%2!==0)) return simpPow(l.l,num(a*r.v));
    }
  }
  if(l.t==='num'&&l.v===1) return num(1);
  return bin('^',l,r);
}

// Multiplication AND division share one canonicalizer: factors travel as
// {base, exp} pairs (divisions enter with negated exponent, numeric
// denominators divide the coefficient), equal bases merge by summing
// exponents, and factors are ordered constants → variable → calls → rest,
// tie-broken by text, for a stable canonical form. Negative exponents are
// rebuilt as a denominator. Division by literal zero bails out untouched.
function pushFactor(s,acc,inv){
  const isPow=s.t==='bin'&&s.op==='^'&&s.r.t==='num';
  acc.factors.push({ base:isPow?s.l:s, exp:(isPow?s.r.v:1)*(inv?-1:1) });
}

function flattenMul(node,acc,inv=false){
  if(node.t==='bin'&&node.op==='*'){ flattenMul(node.l,acc,inv); flattenMul(node.r,acc,inv); return; }
  if(node.t==='bin'&&node.op==='/'){ flattenMul(node.l,acc,inv); flattenMul(node.r,acc,!inv); return; }
  if(node.t==='neg'){ acc.coeff*=-1; flattenMul(node.u,acc,inv); return; }
  const s=simp(node);
  if(s.t==='num'){
    if(inv){ if(s.v===0) acc.bail=true; else acc.coeff/=s.v; }
    else acc.coeff*=s.v;
    return;
  }
  if((s.t==='bin'&&(s.op==='*'||s.op==='/'))||s.t==='neg'){ flattenMul(s,acc,inv); return; }
  pushFactor(s,acc,inv);
}

function factorClass(base){
  if(base.t==='num'||base.t==='konst'||base.t==='param') return 0;
  if(base.t==='sym') return 1;
  if(base.t==='call') return 2;
  return 3;
}

function canonFactors(pairs){
  const groups=[]; const index=new Map();
  for(const {base,exp} of pairs){
    const key=toText(base);
    if(index.has(key)) index.get(key).exp+=exp;
    else { const g={base,exp,key}; index.set(key,g); groups.push(g); }
  }
  const out=groups.filter(g=>g.exp!==0);
  out.sort((p,q)=>(factorClass(p.base)-factorClass(q.base)) || (p.key<q.key?-1:p.key>q.key?1:0));
  return out;
}

function factorsKey(items){ return items.map(g=>g.key+'^'+g.exp).join('*'); }

function sideChain(items){ return mulN(items.map(g=>g.exp===1?g.base:powN(g.base,g.exp))); }

// Fractional coefficients that are small rationals render as a fraction
// (x/3 e 2x/5, não 0.3333333333333333x e 0.4x).
function coeffParts(mag){
  if(Number.isInteger(mag)) return {top:mag,bottom:1};
  for(let q=2;q<=64;q++){
    const p=mag*q, r=Math.round(p);
    if(r!==0&&Math.abs(p-r)<=1e-9*Math.max(1,Math.abs(r))) return {top:r,bottom:q};
  }
  return {top:mag,bottom:1};
}

function buildFrac(coeff,items){
  if(coeff===0||!Number.isFinite(coeff)) return num(coeff||0);
  const pos=items.filter(g=>g.exp>0);
  const negs=items.filter(g=>g.exp<0).map(g=>({base:g.base,exp:-g.exp,key:g.key}));
  const {top,bottom}=coeffParts(Math.abs(coeff));
  const numerChain=sideChain(pos);
  const denomChain=sideChain(negs);
  const numer=numerChain===null ? num(top) : (top===1?numerChain:mul(num(top),numerChain));
  let denom=null;
  if(denomChain!==null) denom = bottom===1?denomChain:mul(num(bottom),denomChain);
  else if(bottom!==1) denom=num(bottom);
  const core=denom===null ? numer : div(numer,denom);
  if(coeff>=0) return core;
  return core.t==='num' ? num(-core.v) : neg(core);
}

function simpMul(node){
  const acc={coeff:1,factors:[],bail:false};
  flattenMul(node,acc);
  if(acc.bail) return node;
  return buildFrac(acc.coeff,canonFactors(acc.factors));
}

function flattenSum(node,sign,out){
  if(node.t==='bin'&&(node.op==='+'||node.op==='-')){
    flattenSum(node.l,sign,out);
    flattenSum(node.r,node.op==='-'?-sign:sign,out);
    return;
  }
  if(node.t==='neg'){ flattenSum(node.u,-sign,out); return; }
  const s=simp(node);
  if((s.t==='bin'&&(s.op==='+'||s.op==='-'))||s.t==='neg'){ flattenSum(s,sign,out); return; }
  out.push({sign,ast:s});
}

// Sums are flattened, like terms combined by their canonical factor key and
// the pure numeric part folded into a trailing constant. Terms that bailed
// (division by literal zero) stay atomic, keyed by their own text.
function simpSum(node){
  const raw=[];
  flattenSum(node,1,raw);
  const groups=[]; const index=new Map();
  let constant=0;
  const addGroup=(key,coeff,items,atom)=>{
    if(index.has(key)) index.get(key).coeff+=coeff;
    else { const g={coeff,items,atom}; index.set(key,g); groups.push(g); }
  };
  for(const {sign,ast} of raw){
    const acc={coeff:sign,factors:[],bail:false};
    flattenMul(ast,acc);
    if(acc.bail){ addGroup('atom:'+toText(ast),sign,null,ast); continue; }
    if(!Number.isFinite(acc.coeff)){ constant+=acc.coeff; continue; }
    const items=canonFactors(acc.factors);
    if(!items.length){ constant+=acc.coeff; continue; }
    addGroup(factorsKey(items),acc.coeff,items,null);
  }
  const build=(coeff,g)=>g.atom ? (coeff===1?g.atom:mul(num(coeff),g.atom)) : buildFrac(coeff,g.items);
  let out=null;
  for(const g of groups){
    if(g.coeff===0) continue;
    if(out===null){ out=build(g.coeff,g); continue; }
    out = g.coeff<0 ? bin('-',out,build(-g.coeff,g))
                    : bin('+',out,build(g.coeff,g));
  }
  if(out===null) return num(constant);
  if(constant!==0) out = constant<0 ? bin('-',out,num(-constant)) : bin('+',out,num(constant));
  return out;
}

function simp(node){
  switch(node.t){
    case 'bin':
      if(node.op==='+'||node.op==='-') return simpSum(node);
      if(node.op==='*'||node.op==='/') return simpMul(node);
      if(node.op==='^') return simpPow(simp(node.l),simp(node.r));
      return node;
    case 'neg': {
      const u=simp(node.u);
      if(u.t==='num') return num(-u.v);
      if(u.t==='neg') return u.u;
      return neg(u);
    }
    case 'call':
      return simpCall(node.name,node.args.map(simp));
    default:
      return node;
  }
}

export function simplify(node){
  let cur=node, prev=null;
  for(let i=0;i<8;i++){
    cur=simp(cur);
    const key=toText(cur);
    if(key===prev) break;
    prev=key;
  }
  return cur;
}

function prec(node){
  if(node.t==='bin') return node.op==='^'?3:(node.op==='*'||node.op==='/')?2:1;
  if(node.t==='neg') return 1;
  return 4;
}

function fmtNum(v){
  return String(Object.is(v,-0)?0:v);
}

export function toText(node){
  switch(node.t){
    case 'num': return fmtNum(node.v);
    case 'sym': case 'param': case 'konst': return node.name;
    // Pseudo-nós dos motores de passos: derivada/integral ainda não resolvidas.
    case 'dop': return 'd/dx['+toText(node.u)+']';
    case 'iop': return '∫['+toText(node.u)+']dx';
    case 'neg': {
      const s=toText(node.u);
      return '-'+(prec(node.u)<2?'('+s+')':s);
    }
    case 'call': return node.name+'('+node.args.map(toText).join(',')+')';
    case 'bin': {
      const {op,l,r}=node;
      let ls=toText(l), rs=toText(r);
      if(op==='+'||op==='-'){
        if(prec(r)<=1) rs='('+rs+')';
        return ls+op+rs;
      }
      if(op==='*'){
        if(prec(l)<2) ls='('+ls+')';
        if(prec(r)<2) rs='('+rs+')';
        if(l.t==='num'&&/^[a-zA-Zπ]/.test(rs)) return ls+rs;
        return ls+'*'+rs;
      }
      if(op==='/'){
        if(prec(l)<2) ls='('+ls+')';
        if(prec(r)<=2) rs='('+rs+')';
        return ls+'/'+rs;
      }
      if(prec(l)<4||(l.t==='num'&&l.v<0)) ls='('+ls+')';
      // Expoente racional pequeno vira fração legível: x^(1/3), não x^0.333….
      if(r.t==='num'&&!Number.isInteger(r.v)){
        const mag=Math.abs(r.v), {top,bottom}=coeffParts(mag);
        if(bottom!==1) rs=(r.v<0?'-':'')+top+'/'+bottom;
      }
      if(prec(r)<3||rs.startsWith('-')||rs.includes('/')) rs='('+rs+')';
      return ls+'^'+rs;
    }
  }
  return '';
}

// text → simplified derivative text, or null when the expression is outside
// the symbolically differentiable subset.
export function derivativeText(text){
  const ast=parseExpr(text);
  if(!ast) return null;
  const d=differentiate(ast);
  if(!d) return null;
  return toText(simplify(d));
}


// Diferenciação parcial: reutiliza as regras e o simplificador existentes sem
// mudar o contrato de differentiate() para curvas de uma variável.
// Os símbolos diferentes do eixo escolhido tornam-se constantes formais.
function freezeOtherAxes(node,axis){
  if(node.t==='sym'&&node.name!==axis) return par(node.name);
  if(node.t==='bin') return bin(node.op,freezeOtherAxes(node.l,axis),freezeOtherAxes(node.r,axis));
  if(node.t==='neg') return neg(freezeOtherAxes(node.u,axis));
  if(node.t==='call') return call(node.name,node.args.map(arg=>freezeOtherAxes(arg,axis)));
  return node;
}
export function partialDerivativeText(expression,axis='x'){
  if(!['x','y','z'].includes(axis)) throw new Error('Eixo de derivação inválido: '+axis);
  const ast=parseExpr(expression);
  if(!ast)return null;
  const derivative=differentiate(freezeOtherAxes(ast,axis));
  return derivative?toText(simplify(derivative)):null;
}
export function multivariateDerivativeTexts(expression){
  const fx=partialDerivativeText(expression,'x');
  const fy=partialDerivativeText(expression,'y');
  if(fx===null||fy===null)return null;
  const fxx=partialDerivativeText(fx,'x');
  const fxy=partialDerivativeText(fx,'y');
  const fyy=partialDerivativeText(fy,'y');
  return [fxx,fxy,fyy].some(value=>value===null)?null:{fx,fy,fxx,fxy,fyy};
}
