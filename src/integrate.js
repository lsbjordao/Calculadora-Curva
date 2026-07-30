"use strict";

import { parseExpr, simplify, toText, containsVar } from './symbolic.js';
import { runPseudoSteps } from './steps.js';

// Primitivas simbólicas por linearidade + constante multiplicativa + regra da
// potência + tabela com substituição linear (u = a·x + b, a numérico ≠ 0; b
// pode conter parâmetros). O integrando é simplificado antes do match, então
// os padrões casam com as formas canônicas do simplificador (x^(-n) chega
// como 1/xⁿ, por exemplo). Qualquer ∫ pendente sem regra ⇒ null — o app
// continua com o valor numérico e diz isso. Sem integração por partes,
// frações parciais ou expoente-parâmetro (YAGNI, ver spec).

const num=v=>({t:'num',v});
const sym=()=>({t:'sym',name:'x'});
const call=(name,args)=>({t:'call',name,args});
const bin=(op,l,r)=>({t:'bin',op,l,r});
const neg=u=>({t:'neg',u});
const mul=(a,b)=>bin('*',a,b);
const div=(a,b)=>bin('/',a,b);
const powN=(u,n)=>bin('^',u,num(n));
const iop=u=>({t:'iop',u});
const R=(title,formula,note=null)=>({title,formula,note});
const lnAbs=u=>call('ln',[call('abs',[u])]);

const KVAL={pi:Math.PI, e:Math.E, tau:2*Math.PI, phi:(1+Math.sqrt(5))/2};
// Valor numérico de subárvore sem variável (param/call → NaN: não confiável).
function evalConst(n){
  switch(n.t){
    case 'num': return n.v;
    case 'konst': return KVAL[n.name] ?? NaN;
    case 'neg': return -evalConst(n.u);
    case 'bin': {
      const a=evalConst(n.l), b=evalConst(n.r);
      switch(n.op){ case '+':return a+b; case '-':return a-b; case '*':return a*b; case '/':return a/b; case '^':return Math.pow(a,b); }
    }
    default: return NaN;
  }
}

// u é linear em x? → {a: número ≠ 0, b: AST|null}; senão null.
function linearOf(n){
  if(n.t==='sym') return {a:1,b:null};
  if(!containsVar(n)) return null;
  if(n.t==='neg'){ const s=linearOf(n.u); return s&&{a:-s.a, b:s.b?neg(s.b):null}; }
  if(n.t==='bin'&&(n.op==='+'||n.op==='-')){
    const lv=containsVar(n.l), rv=containsVar(n.r);
    if(lv===rv) return null;
    const s=linearOf(lv?n.l:n.r); if(!s) return null;
    const c=lv?n.r:n.l;
    const sgnS=(n.op==='-'&&!lv)?-1:1, sgnC=(n.op==='-'&&lv)?-1:1;
    const b0=sgnC<0?neg(c):c;
    return {a:sgnS*s.a, b:s.b?bin('+',s.b,b0):b0};
  }
  if(n.t==='bin'&&(n.op==='*'||n.op==='/')){
    if(n.op==='/'&&containsVar(n.r)) return null;
    const kNode=containsVar(n.l)?n.r:n.l, uNode=containsVar(n.l)?n.l:n.r;
    if(containsVar(kNode)) return null;
    const k=evalConst(kNode); if(!Number.isFinite(k)||k===0) return null;
    const s=linearOf(uNode); if(!s) return null;
    const f=n.op==='/'?1/k:k;
    return {a:s.a*f, b:s.b?mul(num(f),s.b):null};
  }
  return null;
}

const isX=lin=>lin.a===1&&lin.b===null;
const scaleBy=(F,a)=>a===1?F:div(F,num(a));
const subNote=(lin,uText)=>isX(lin)?null
  :'substituição u = '+uText+', du = '+(lin.a===1?'':String(lin.a)+'·')+'dx'+(lin.a!==1?' (daí o fator 1/'+lin.a+')':'');

const TABLE={
  sin:u=>neg(call('cos',[u])), cos:u=>call('sin',[u]), tan:u=>neg(lnAbs(call('cos',[u]))),
  exp:u=>call('exp',[u]), sinh:u=>call('cosh',[u]), cosh:u=>call('sinh',[u]),
  sqrt:u=>div(mul(num(2),bin('^',u,num(1.5))),num(3)),
  cbrt:u=>div(mul(num(3),bin('^',u,bin('/',num(4),num(3)))),num(4)),
  ln:u=>bin('-',mul(u,call('ln',[u])),u),
  log:u=>div(bin('-',mul(u,call('ln',[u])),u),call('ln',[num(10)])),
  log2:u=>div(bin('-',mul(u,call('ln',[u])),u),call('ln',[num(2)])),
};
const FORMULA={
  sin:'∫sin(u)du = −cos(u)', cos:'∫cos(u)du = sin(u)', tan:'∫tan(u)du = −ln|cos(u)|',
  exp:'∫eᵘdu = eᵘ', sinh:'∫sinh(u)du = cosh(u)', cosh:'∫cosh(u)du = sinh(u)',
  sqrt:'∫√u du = (2/3)·u^(3/2)', cbrt:'∫∛u du = (3/4)·u^(4/3)',
  ln:'∫ln(u)du = u·ln(u) − u', log:'∫log(u)du = (u·ln(u) − u)/ln(10)',
  log2:'∫log2(u)du = (u·ln(u) − u)/ln(2)',
};

// Separa fatores de um produto/divisão: var-free (consts) × com variável
// (vars, com flag inv para denominadores). coeff carrega só o sinal de neg.
function splitFactors(s){
  const consts=[]; const vars=[]; let coeff=1;
  (function walk(n,inv){
    if(n.t==='bin'&&n.op==='*'){ walk(n.l,inv); walk(n.r,inv); return; }
    if(n.t==='bin'&&n.op==='/'){ walk(n.l,inv); walk(n.r,!inv); return; }
    if(n.t==='neg'){ coeff*=-1; walk(n.u,inv); return; }
    if(n.t==='num'&&n.v===1) return;                     // identidade: 1·u e u/1
    if(!containsVar(n)){ consts.push(inv?div(num(1),n):n); return; }
    vars.push({node:n, inv});
  })(s,false);
  return {coeff,consts,vars};
}

function rebuildVars(vars){
  let out=null;
  for(const {node,inv} of vars){
    const f=inv?div(num(1),node):node;
    out=out===null?f:mul(out,f);
  }
  return out;
}

// 1/(x²+1) → atan(x); 1/√(1−x²) → asin(x), nas formas canônicas do simplify.
function matchInverseTrig(den){
  const isX2=n=>n.t==='bin'&&n.op==='^'&&n.l.t==='sym'&&n.r.t==='num'&&n.r.v===2;
  const one=n=>n.t==='num'&&n.v===1;
  if(den.t==='bin'&&den.op==='+'&&((isX2(den.l)&&one(den.r))||(one(den.l)&&isX2(den.r))))
    return {F:call('atan',[sym()]), formula:'∫du/(u²+1) = atan(u)'};
  if(den.t==='call'&&den.name==='sqrt'){
    const a=den.args[0];
    const negX2=n=>n.t==='neg'&&isX2(n.u);
    if(a.t==='bin'&&((a.op==='-'&&one(a.l)&&isX2(a.r))||(a.op==='+'&&negX2(a.l)&&one(a.r))))
      return {F:call('asin',[sym()]), formula:'∫du/√(1−u²) = asin(u)'};
  }
  return null;
}

export function integrateOnce(raw){
  const s=simplify(raw);
  if(!containsVar(s)) return {ast:mul(s,sym()), rule:R('Integral de constante','∫c dx = c·x','c = '+toText(s))};
  if(s.t==='bin'&&(s.op==='+'||s.op==='-'))
    return {ast:bin(s.op,iop(s.l),iop(s.r)), rule:R('Linearidade','∫(u ± v)dx = ∫u dx ± ∫v dx')};

  const {coeff,consts,vars}=splitFactors(s);
  if(!vars.length) return {ast:mul(s,sym()), rule:R('Integral de constante','∫c dx = c·x')};
  if(coeff!==1||consts.length){
    const rest=rebuildVars(vars);
    let cAst=consts.reduce((a,f)=>a===null?f:mul(a,f),null);
    if(coeff<0) cAst=cAst===null?num(-1):neg(cAst);
    const body=iop(rest);
    return {ast:cAst===null?body:mul(cAst,body),
            rule:R('Constante multiplicativa','∫c·u dx = c·∫u dx','c = '+toText(cAst===null?num(coeff):cAst))};
  }
  if(vars.length!==1) return null;                       // ∫u·v sem regra (sem integração por partes)

  const {node:v,inv}=vars[0];
  if(inv){
    if(v.t==='bin'&&v.op==='^'&&v.r.t==='num'){
      const linB=linearOf(v.l);
      if(!linB) return null;
      const m=-v.r.v;                                     // ∫u^m com m<0
      if(m===-1) return {ast:scaleBy(lnAbs(v.l),linB.a), rule:R('ln do módulo','∫du/u = ln|u|',subNote(linB,toText(v.l)))};
      const F=div(bin('^',v.l,num(m+1)),num(m+1));
      return {ast:scaleBy(F,linB.a),
              rule:R('Regra da potência','1/uⁿ = u⁻ⁿ ⇒ ∫uᵐdu = uᵐ⁺¹/(m+1)', subNote(linB,toText(v.l))||('m = '+m))};
    }
    const lin=linearOf(v);
    if(lin) return {ast:scaleBy(lnAbs(v),lin.a), rule:R('ln do módulo','∫du/u = ln|u|',subNote(lin,toText(v)))};
    const m=matchInverseTrig(v);
    if(m) return {ast:m.F, rule:R('Tabela',m.formula)};
    return null;
  }
  if(v.t==='sym') return {ast:div(powN(v,2),num(2)), rule:R('Regra da potência','∫xⁿdx = xⁿ⁺¹/(n+1)','n = 1')};
  if(v.t==='bin'&&v.op==='^'){
    const {l,r}=v;
    if(r.t==='num'){
      const linB=linearOf(l);
      if(!linB) return null;
      if(r.v===-1) return {ast:scaleBy(lnAbs(l),linB.a), rule:R('ln do módulo','∫du/u = ln|u|',subNote(linB,toText(l)))};
      const F=div(bin('^',l,num(r.v+1)),num(r.v+1));
      return {ast:scaleBy(F,linB.a),
              rule:R('Regra da potência','∫uⁿdu = uⁿ⁺¹/(n+1)', subNote(linB,toText(l))||('n = '+r.v))};
    }
    if(!containsVar(l)){
      const linE=linearOf(r);
      if(!linE) return null;
      const F=div(bin('^',l,r),call('ln',[l]));
      const isE=l.t==='konst'&&l.name==='e';
      return {ast:scaleBy(F,linE.a),
              rule:R('Exponencial','∫aᵘdu = aᵘ/ln(a)', subNote(linE,toText(r))||(isE?'aqui a = e e ln(e) = 1':'a = '+toText(l)))};
    }
    return null;                                          // x^x, x^param…
  }
  if(v.t==='call'&&v.args.length===1&&TABLE[v.name]){
    const lin=linearOf(v.args[0]);
    if(!lin) return null;
    const F=scaleBy(TABLE[v.name](v.args[0]),lin.a);
    const note=subNote(lin,toText(v.args[0]));
    return {ast:F, rule: note?R('Substituição linear',FORMULA[v.name],note):R('Tabela',FORMULA[v.name])};
  }
  return null;
}

// AST do integrando → AST da primitiva (sem passos) | null.
export function antiderivative(ast){
  const run=runPseudoSteps(iop(ast),'iop',integrateOnce);
  return run ? simplify(run.node) : null;
}

export function antiderivativeText(text){
  const ast=parseExpr(text);
  if(!ast) return null;
  const F=antiderivative(ast);
  return F ? toText(F) : null;
}

// text → {input, lines, result} | null, no mesmo formato de derivativeSteps.
export function integralSteps(text){
  const ast=parseExpr(text);
  if(!ast) return null;
  const run=runPseudoSteps(iop(ast),'iop',integrateOnce);
  if(!run) return null;
  const raw=toText(run.node);
  const simped=simplify(run.node);
  const result=toText(simped);
  const lines=run.lines;
  if(result!==raw) lines.push({title:'Simplificação',formula:null,note:null,expr:result,ast:simped});
  return {input:toText(ast), lines, result};
}
