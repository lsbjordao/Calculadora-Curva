"use strict";

import { parseExpr, simplify, toText, CHAIN, STEP_FUNCS, containsVar } from './symbolic.js';

// Derivação passo a passo. Cada iteração resolve o pseudo-nó {t:'dop',u}
// ("derivada pendente", exibido d/dx[u]) mais à esquerda aplicando UMA regra,
// e re-renderiza a expressão inteira — cada linha é uma igualdade válida.
// deriveOnce produz as formas de AST de differentiate (com dop(u) no lugar
// da recursão), a menos de limpeza de exibição que preserva valor (dobra de
// n−1 numérico, remoção de fatores ·1 e de expoente ^1) — o resultado final
// simplificado é idêntico ao derivativeText; steps.test.mjs garante por
// comparação direta.

const num=v=>({t:'num',v});
const call=(name,args)=>({t:'call',name,args});
const bin=(op,l,r)=>({t:'bin',op,l,r});
const neg=u=>({t:'neg',u});
const mul=(a,b)=>bin('*',a,b);
const div=(a,b)=>bin('/',a,b);
const powN=(u,n)=>bin('^',u,num(n));
const dop=u=>({t:'dop',u});
const mulN=fs=>fs.reduce((acc,f)=>acc===null?f:mul(acc,f),null);
const R=(title,formula,note=null)=>({title,formula,note});
// A derivada pendente de x é resolvida na própria linha (evita o ruído de
// uma linha "d/dx[x] = 1" em cada regra da cadeia degenerada).
const duOf=u=>u.t==='sym'?num(1):dop(u);
// Expoente n−1 dobrado quando n é literal: x^(2-1) vira x^1 (e strip1 tira o ^1).
const n1=r=>r.t==='num'?num(r.v-1):bin('-',r,num(1));

// Limpeza de exibição, preservando valor: remove fatores 1 e expoente 1.
function strip1(node){
  if(node.t==='bin'&&node.op==='*'){
    const l=strip1(node.l), r=strip1(node.r);
    if(l.t==='num'&&l.v===1) return r;
    if(r.t==='num'&&r.v===1) return l;
    return bin('*',l,r);
  }
  if(node.t==='bin'&&node.op==='^'){
    const l=strip1(node.l), r=strip1(node.r);
    if(r.t==='num'&&r.v===1) return l;
    return bin('^',l,r);
  }
  if(node.t==='bin') return bin(node.op,strip1(node.l),strip1(node.r));
  if(node.t==='neg') return neg(strip1(node.u));
  if(node.t==='call') return call(node.name,node.args.map(strip1));
  if(node.t==='dop'||node.t==='iop') return {...node, u:strip1(node.u)};
  return node;
}

function deriveOnce(u){
  if(u.t==='num'||u.t==='konst') return {ast:num(0), rule:R('Derivada de constante','(c)′ = 0')};
  if(u.t==='param') return {ast:num(0), rule:R('Derivada de constante','(c)′ = 0', u.name+' é um parâmetro (constante)')};
  if(u.t==='sym') return {ast:num(1), rule:R('Derivada da variável','(x)′ = 1')};
  if(u.t==='neg') return {ast:neg(dop(u.u)), rule:R('Linearidade','(−u)′ = −u′')};
  if(u.t==='bin'&&(u.op==='+'||u.op==='-'))
    return {ast:bin(u.op,dop(u.l),dop(u.r)), rule:R('Linearidade','(u ± v)′ = u′ ± v′')};
  if(u.t==='bin'&&u.op==='*'){
    if(!containsVar(u.l)) return {ast:mul(u.l,dop(u.r)), rule:R('Constante multiplicativa','(c·u)′ = c·u′','c = '+toText(u.l))};
    if(!containsVar(u.r)) return {ast:mul(dop(u.l),u.r), rule:R('Constante multiplicativa','(u·c)′ = u′·c','c = '+toText(u.r))};
    return {ast:bin('+',mul(dop(u.l),u.r),mul(u.l,dop(u.r))),
            rule:R('Regra do produto','(u·v)′ = u′·v + u·v′','u = '+toText(u.l)+', v = '+toText(u.r))};
  }
  if(u.t==='bin'&&u.op==='/'){
    if(!containsVar(u.r)) return {ast:div(dop(u.l),u.r), rule:R('Constante no denominador','(u/c)′ = u′/c','c = '+toText(u.r))};
    return {ast:div(bin('-',mul(dop(u.l),u.r),mul(u.l,dop(u.r))),powN(u.r,2)),
            rule:R('Regra do quociente','(u/v)′ = (u′·v − u·v′)/v²','u = '+toText(u.l)+', v = '+toText(u.r))};
  }
  if(u.t==='bin'&&u.op==='^'){
    const {l,r}=u;
    if(!containsVar(r)){
      const shape=mulN([r,bin('^',l,n1(r)),duOf(l)]);
      return l.t==='sym'
        ? {ast:shape, rule:R('Regra da potência','(xⁿ)′ = n·xⁿ⁻¹','n = '+toText(r))}
        : {ast:shape, rule:R('Potência + cadeia','(uⁿ)′ = n·uⁿ⁻¹·u′','u = '+toText(l)+', n = '+toText(r))};
    }
    if(!containsVar(l)){
      const isE=l.t==='konst'&&l.name==='e';
      return {ast:mulN([bin('^',l,r),call('ln',[l]),duOf(r)]),
              rule:R('Exponencial','(aᵘ)′ = aᵘ·ln(a)·u′', isE?'aqui a = e e ln(e) = 1':'a = '+toText(l))};
    }
    return {ast:mul(bin('^',l,r),bin('+',mul(duOf(r),call('ln',[l])),div(mul(r,duOf(l)),l))),
            rule:R('Derivação logarítmica','(uᵛ)′ = uᵛ·(v′·ln(u) + v·u′/u)','u = '+toText(l)+', v = '+toText(r))};
  }
  if(u.t==='call'){
    if(STEP_FUNCS.has(u.name)) return {ast:num(0), rule:R('Função escada','derivada 0 em quase todo ponto')};
    if(u.name==='root'){
      const [n,b]=u.args;
      if(containsVar(n)) return null;
      return {ast:div(duOf(b),mul(n,bin('^',call('root',[n,b]),bin('-',n,num(1))))),
              rule:R('Raiz como potência','ⁿ√u = u^(1/n) ⇒ (ⁿ√u)′ = u′/(n·(ⁿ√u)ⁿ⁻¹)','n = '+toText(n))};
    }
    const rule=CHAIN[u.name];
    if(!rule||u.args.length!==1) return null;
    const arg=u.args[0];
    const ast=rule(arg,duOf(arg));
    if(u.name==='abs') return {ast, rule:R('Módulo','(|u|)′ = sign(u)·u′ (vale fora do bico)')};
    return arg.t==='sym'
      ? {ast, rule:R('Derivada tabelada','('+u.name+'(x))′ = '+toText(strip1(rule(arg,num(1)))))}
      : {ast, rule:R('Regra da cadeia','(f(g(x)))′ = f′(g(x))·g′(x)','f = '+u.name+', g = '+toText(arg))};
  }
  return null;
}

// Substitui o pseudo-nó mais à esquerda do tipo dado aplicando applyOnce;
// st registra a regra usada (ou a falha). A árvore é reconstruída por cópia.
function replaceFirst(node,type,applyOnce,st){
  if(st.done||st.fail) return node;
  if(node.t===type){
    const r=applyOnce(node.u);
    if(!r){ st.fail=true; return node; }
    st.done=true; st.rule=r.rule;
    return r.ast;
  }
  if(node.t==='neg') return {...node, u:replaceFirst(node.u,type,applyOnce,st)};
  if(node.t==='bin'){
    const l=replaceFirst(node.l,type,applyOnce,st);
    return {...node, l, r:replaceFirst(node.r,type,applyOnce,st)};
  }
  if(node.t==='call') return {...node, args:node.args.map(a=>replaceFirst(a,type,applyOnce,st))};
  return node;
}

function hasPseudo(n,type){
  if(n.t===type) return true;
  if(n.t==='neg') return hasPseudo(n.u,type);
  if(n.t==='bin') return hasPseudo(n.l,type)||hasPseudo(n.r,type);
  if(n.t==='call') return n.args.some(a=>hasPseudo(a,type));
  return false;
}

// Motor genérico: também usado por integrate.js com pseudo-nós 'iop'.
export function runPseudoSteps(root,type,applyOnce,cap=40){
  let cur=root;
  const lines=[];
  for(let i=0;i<cap;i++){
    const st={done:false,fail:false,rule:null};
    cur=replaceFirst(cur,type,applyOnce,st);
    if(st.fail) return null;
    if(!st.done) break;
    cur=strip1(cur);   // ·1 e ^1 some da linha inteira, não só do trecho novo
    lines.push({...st.rule, expr:toText(cur), ast:cur});
  }
  if(hasPseudo(cur,type)) return null;
  return {node:cur, lines};
}

// text → {input, lines:[{title,formula,note,expr,ast}], result} | null.
// result é idêntico a derivativeText(text) por construção.
export function derivativeSteps(text){
  const ast=parseExpr(text);
  if(!ast) return null;
  const run=runPseudoSteps(dop(ast),'dop',deriveOnce);
  if(!run) return null;
  const raw=toText(run.node);
  const simped=simplify(run.node);
  const result=toText(simped);
  const lines=run.lines;
  if(result!==raw) lines.push({title:'Simplificação',formula:null,note:null,expr:result,ast:simped});
  return {input:toText(ast), lines, result};
}
