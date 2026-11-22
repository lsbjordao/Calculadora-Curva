"use strict";

import { derivAt, limitAt, secondDeriv } from './numeric.js';
import { polyFit, expFit, powFit, logFit, sigmoidFit } from './regress.js';
import { algebraFunctions, algebraArities, callAlgebra, AlgebraError, validateMatrix, validateVector, algebraLimits } from './linear-algebra.js';

const FUNCS = {
  sin:Math.sin, cos:Math.cos, tan:Math.tan,
  asin:Math.asin, acos:Math.acos, atan:Math.atan,
  sec:v=>1/Math.cos(v), csc:v=>1/Math.sin(v), cot:v=>1/Math.tan(v),
  sinh:Math.sinh, cosh:Math.cosh, tanh:Math.tanh,
  asinh:Math.asinh, acosh:Math.acosh, atanh:Math.atanh,
  ln:Math.log, log:v=>Math.log10(v), log2:Math.log2,
  sqrt:Math.sqrt, cbrt:Math.cbrt, abs:Math.abs, exp:Math.exp,
  floor:Math.floor, ceil:Math.ceil, round:Math.round, sign:Math.sign
};

const FUNC_ALIASES = {
  sen:'sin', seno:'sin', tg:'tan',
  arcsin:'asin', arcsen:'asin', asin:'asin',
  arccos:'acos', acos:'acos',
  arctan:'atan', arctg:'atan', atan:'atan',
  log10:'log'
};

const CONSTS = { pi:Math.PI, "\u03c0":Math.PI, e:Math.E, tau:2*Math.PI, phi:(1+Math.sqrt(5))/2 };
const SPECIAL_CALLS = new Set(['piecewise','if','root','raiz','lim','sum','det','cross','linsolve','seq','deriv', ...Object.keys(algebraFunctions)]);
const STAT_FIT_NAMES = new Set(['fitexp','fitpow','fitlog','fitsig']);

function isFitName(name){
  return /^fit\d*$/.test(name) || STAT_FIT_NAMES.has(name);
}

// Real n-th root. Unlike v**(1/n), this returns the real negative root for an
// odd integer index (e.g. root(3,-8) = -2); even/non-integer indices of a
// negative radicand have no real value and yield NaN.
function realRoot(n, v){
  if(!Number.isFinite(n)||!Number.isFinite(v)) return NaN;
  if(v<0){
    const k=Math.round(n);
    if(Math.abs(n-k)<1e-9 && k%2!==0) return -Math.pow(-v, 1/n);
    return NaN;
  }
  return Math.pow(v, 1/n);
}
const PARAM_NAMES = new Set(['a','b','c','d','h','i','j','k','m','n','p','q','r']);

// Second variable for implicit relations f(x,y)=0. The compiled function takes x
// as its argument; the 'y' token reads this module state, which the implicit
// sampler sets before each evaluation.
let implicitY=0;
export function setImplicitY(v){ implicitY=v; }

// Registry of user-defined functions (name -> fn). Calls are late-bound: a
// compiled expression reads this map at evaluation time, so a function used
// before it is defined simply yields NaN until the definition appears.
let userFunctions={};
export function setUserFunctions(m){ userFunctions=m||{}; }
const COMPARISONS = new Set(['<','>','<=','>=','==','!=']);
const SUP={'\u2070':'0','\u00b9':'1','\u00b2':'2','\u00b3':'3','\u2074':'4',
           '\u2075':'5','\u2076':'6','\u2077':'7','\u2078':'8','\u2079':'9','\u207b':'-'};
const SUP_RE=/[\u2070\u00b9\u00b2\u00b3\u2074-\u2079\u207b]+/g;

function canonicalName(name){
  const raw=String(name||'').toLowerCase();
  return FUNC_ALIASES[raw] || raw;
}

function isKnownCall(name){
  const n=canonicalName(name);
  return !!FUNCS[n] || SPECIAL_CALLS.has(n) || isFitName(n);
}

export function isDefinitionLhs(lhs){
  const s=String(lhs==null?'':lhs).trim();
  const call=s.match(/^([a-zA-Z][a-zA-Z0-9]*)\s*\(\s*[a-zA-Z][a-zA-Z0-9]*\s*\)$/);
  if(call) return !isKnownCall(call[1]);
  return /^[a-zA-Z]+$/.test(s);
}

function countPeerCommas(str, commaIndex){
  let start=0, end=str.length, depth=0;
  for(let i=commaIndex-1;i>=0;i--){
    const c=str[i];
    if(c===')') depth++;
    else if(c==='('){
      if(depth===0){ start=i+1; break; }
      depth--;
    }
  }
  depth=0;
  for(let i=commaIndex+1;i<str.length;i++){
    const c=str[i];
    if(c==='(') depth++;
    else if(c===')'){
      if(depth===0){ end=i; break; }
      depth--;
    }
  }
  let count=0, paren=0, bracket=0;
  for(let i=start;i<end;i++){
    const c=str[i];
    if(c==='(') paren++;
    else if(c===')') paren--;
    else if(c==='[') bracket++;
    else if(c===']') bracket--;
    else if(c===',' && paren===0 && bracket===0) count++;
  }
  return count;
}

function enclosingCallName(str, commaIndex){
  let depth=0;
  for(let i=commaIndex-1;i>=0;i--){
    const c=str[i];
    if(c===')'||c===']') depth++;
    else if(c==='('||c==='['){
      if(depth>0){ depth--; continue; }
      if(c!=='(') return '';
      let j=i-1;
      while(j>=0 && /\s/.test(str[j])) j--;
      let end=j+1;
      while(j>=0 && /[a-zA-Z0-9\u03c0]/.test(str[j])) j--;
      return str.slice(j+1,end).toLowerCase();
    }
  }
  return '';
}

function normalizeDecimalCommas(str){
  const multiArgCalls=new Set(['root','raiz','lim','sum','seq','cross','linsolve','piecewise','if', ...Object.keys(algebraFunctions)]);
  let out='';
  let squareDepth=0;
  for(let i=0;i<str.length;i++){
    const c=str[i];
    if(c==='[') squareDepth++;
    else if(c===']') squareDepth=Math.max(0,squareDepth-1);
    const decimalComma=c===',' && squareDepth===0 && /\d/.test(str[i-1]||'') && /\d/.test(str[i+1]||'');
    const callName=decimalComma ? enclosingCallName(str,i) : '';
    if(decimalComma && !multiArgCalls.has(callName) && countPeerCommas(str,i)<=1){
      out+='.';
    } else {
      out+=c;
    }
  }
  return out;
}

export function normalizeInput(str){
  let s=normalizeDecimalCommas(str);
  s=s.replace(/[−–—]/g,'-');
  s=s.replace(/θ/g,'theta');
  s=s.replace(/\|([^|]+)\|/g,'abs($1)');
  s=s.replace(/\u221a\s*\(/g,'sqrt(');
  s=s.replace(/\u221a\s*([a-zA-Z\u03c0][a-zA-Z0-9\u03c0]*|\d+(?:\.\d+)?)/g,'sqrt($1)');
  s=s.replace(SUP_RE,run=>{
    let d=''; for(const ch of run) d+=SUP[ch]||'';
    return '^('+d+')';
  });
  s=s.replace(/\u00f7/g,'/').replace(/\u00d7/g,'*').replace(/\u2215/g,'/');
  s=s.replace(/\u2032/g,"'");
  s=s.replace(/d\s*\/\s*dx\s*\(/gi,'deriv(');
  const eq=s.indexOf('=');
  if(eq>=0 && s[eq+1]!=='=' && !'<>!='.includes(s[eq-1])){
    const lhs=s.slice(0,eq).trim();
    if(isDefinitionLhs(lhs)) s=s.slice(eq+1);
  }
  return s;
}

function splitTopLevel(str, sep){
  const out=[]; let paren=0, bracket=0, brace=0, last=0;
  for(let i=0;i<str.length;i++){
    const c=str[i];
    if(c==='(') paren++;
    else if(c===')') paren--;
    else if(c==='[') bracket++;
    else if(c===']') bracket--;
    else if(c==='{') brace++;
    else if(c==='}') brace--;
    else if(c===sep && paren===0 && bracket===0 && brace===0){ out.push(str.slice(last,i)); last=i+1; }
  }
  out.push(str.slice(last));
  return out;
}

function isBracketed(str){
  const s=String(str||'').trim();
  return s.startsWith('[') && s.endsWith(']');
}

function stripBrackets(str){
  const s=String(str||'').trim();
  return isBracketed(s) ? s.slice(1,-1) : s;
}

function compileMatrixLiteral(inner, params, locals, symbols){
  const text=String(inner||'').trim();
  if(!text) return ()=>[];
  const semicolonRows=splitTopLevel(text, ';');
  let rows=null;
  if(semicolonRows.length>1){
    rows=semicolonRows;
  } else {
    const commaParts=splitTopLevel(text, ',').map(part=>part.trim());
    if(commaParts.length && commaParts.every(isBracketed)) rows=commaParts.map(stripBrackets);
  }
  if(rows){
    if(rows.length>algebraLimits().maxSize) throw new AlgebraError('SIZE', 'Matriz excede o limite de tamanho.');
    const compiledRows=rows.map(row=>{
      const cells=splitTopLevel(stripBrackets(row), ',').map(cell=>cell.trim());
      if(!cells.length || cells.some(cell=>!cell)) throw new Error("matriz inválida");
      if(cells.length>algebraLimits().maxSize) throw new AlgebraError('SIZE', 'Matriz excede o limite de tamanho.');
      return cells.map(cell=>compile(cell, params, locals, symbols));
    });
    const width=compiledRows[0]?.length ?? 0;
    if(!width || compiledRows.some(row=>row.length!==width)) throw new Error("linhas de tamanhos diferentes");
    return x=>validateMatrix(compiledRows.map(row=>row.map(fn=>fn(x))));
  }
  const cells=splitTopLevel(text, ',').map(cell=>cell.trim());
  if(!cells.length || cells.some(cell=>!cell)) throw new Error("vetor inválido");
  if(cells.length>algebraLimits().maxSize) throw new AlgebraError('SIZE', 'Vetor excede o limite de tamanho.');
  const compiled=cells.map(cell=>compile(cell, params, locals, symbols));
  return x=>validateVector(compiled.map(fn=>fn(x)));
}

function isPointArray(value){
  return Array.isArray(value) && value.length>0 && value.every(p=>p && Number.isFinite(p.x) && Number.isFinite(p.y));
}

function fitFromPoints(name, points){
  if(!isPointArray(points)) return null;
  if(name==='fitexp') return expFit(points);
  if(name==='fitpow') return powFit(points);
  if(name==='fitlog') return logFit(points);
  if(name==='fitsig') return sigmoidFit(points);
  const degree=name==='fit' ? 1 : (Number(name.slice(3))||1);
  return polyFit(points, degree);
}

function tokenize(str){
  const t=[]; let i=0;
  const isDigit=c=>c>='0'&&c<='9';
  const isAlpha=c=>/[a-zA-Z\u03c0]/.test(c);
  const NUM_RE=/^(?:\d+(?:\.\d*)?|\.\d+)(?:[eE][+-]?\d+)?/;
  while(i<str.length){
    const c=str[i];
    if(/\s/.test(c)){i++;continue;}
    if(isDigit(c)||c==='.'){
      const m=str.slice(i).match(NUM_RE);
      if(!m) throw new Error("número inválido em "+(i+1));
      const value=Number(m[0]);
      if(!Number.isFinite(value)) throw new Error("número fora do alcance");
      t.push({type:'num',value}); i+=m[0].length; continue;
    }
    if(c==='@'){
      const match=str.slice(i+1).match(/^[a-zA-Z][a-zA-Z0-9]*/);
      if(!match) throw new AlgebraError('UNKNOWN_SYMBOL', 'Nome esperado após @.');
      t.push({type:'symbol',name:match[0].toLowerCase()}); i+=match[0].length+1; continue;
    }
    if(c==='['){
      let depth=1, j=i+1, start=j;
      while(j<str.length && depth>0){
        if(str[j]==='[') depth++;
        else if(str[j]===']') depth--;
        j++;
      }
      if(depth!==0) throw new Error("colchete não fechado");
      const inner=str.slice(start, j-1);
      t.push({type:'mat_lit', value: inner});
      i=j; continue;
    }
    if(isAlpha(c)){
      let j=i+1; while(j<str.length&&(isAlpha(str[j])||(str[j]>='0'&&str[j]<='9')))j++;
      const raw=str.slice(i,j).toLowerCase();
      const name=FUNC_ALIASES[raw] || raw;
      i=j;
      // f'(x) / f''(x): derivative of a user-defined function. Only unknown
      // names can carry primes; the call parens are required.
      let primes=0;
      while(str[i+primes]==="'") primes++;
      if(primes>0){
        if(isKnownCall(name)||CONSTS[name]!==undefined||PARAM_NAMES.has(name)||['x','t','theta','y'].includes(name)){
          throw new Error("' só deriva funções definidas pelo usuário");
        }
        if(primes>2) throw new Error("no máximo f''");
        i+=primes;
        let k=i; while(k<str.length && /\s/.test(str[k])) k++;
        if(str[k]!=='(') throw new Error("esperava ( após '");
        t.push({type:'userderiv',name,order:primes});
        continue;
      }
      if(name==='piecewise'||name==='if') t.push({type:'piecewise',name});
      else if(name==='root'||name==='raiz') t.push({type:'root',name});
      else if(FUNCS[name]) t.push({type:'func',name});
      else if(CONSTS[name]!==undefined) t.push({type:'const',name});
      else if(name==='x'||name==='t'||name==='theta') t.push({type:'var',name});
      else if(name==='y') t.push({type:'vary'});
      else if(name==='lim') t.push({type:'limfn'});
      else if(PARAM_NAMES.has(name)) t.push({type:'param',name});
      else if(SPECIAL_CALLS.has(name)||isFitName(name)) t.push({type:'special',name});
      else {
        // Unknown identifier followed by '(' is a user-defined function call.
        let k=i; while(k<str.length && /\s/.test(str[k])) k++;
        if(str[k]==='(') t.push({type:'userfunc', name});
        else throw new Error("nome desconhecido: "+raw);
      }
      continue;
    }
    if('<>!='.includes(c)){
      const two=str.slice(i,i+2);
      if(COMPARISONS.has(two)){ t.push({type:'op',value:two}); i+=2; continue; }
      if(c==='<'||c==='>'){ t.push({type:'op',value:c}); i++; continue; }
    }
    if('+-*/^(),'.indexOf(c)>=0){ t.push({type:'op',value:c}); i++; continue; }
    throw new Error("caractere inválido: "+c);
  }
  const out=[];
  for(let k=0;k<t.length;k++){
    out.push(t[k]);
    const a=t[k], b=t[k+1];
    if(!b) continue;
    const aEnd = a.type==='num'||a.type==='const'||a.type==='var'||a.type==='vary'||a.type==='param'||a.type==='mat_lit'||a.type==='symbol'||(a.type==='op'&&a.value===')');
    const bStart = b.type==='num'||b.type==='const'||b.type==='var'||b.type==='vary'||b.type==='param'||b.type==='func'||b.type==='piecewise'||b.type==='root'||b.type==='userfunc'||b.type==='userderiv'||b.type==='limfn'||b.type==='special'||b.type==='mat_lit'||b.type==='symbol'||(b.type==='op'&&b.value==='(');
    if(aEnd&&bStart) out.push({type:'op',value:'*'});
  }
  return out;
}

export function extractParams(str){
  const tokens=tokenize(normalizeInput(str));
  const matches=new Map();
  const stack=[];
  tokens.forEach((token,index)=>{
    if(token.type==='op'&&token.value==='(') stack.push(index);
    else if(token.type==='op'&&token.value===')'){
      const open=stack.pop();
      if(open!==undefined){ matches.set(open,index); matches.set(index,open); }
    }
  });
  const names=[];
  const scopes=[];
  for(let i=0;i<tokens.length;i++){
    while(scopes.length && i>scopes[scopes.length-1].end) scopes.pop();
    const tk=tokens[i];
    if(tk.type==='special' && (tk.name==='sum'||tk.name==='seq') && tokens[i+1]?.type==='op' && tokens[i+1].value==='('){
      const varTk=tokens[i+2];
      const end=matches.get(i+1);
      if(end!==undefined && (varTk?.type==='var'||varTk?.type==='param') && varTk.name){
        scopes.push({name:varTk.name,end});
      }
    }
    if(tk.type==='mat_lit'){
      for(const name of extractParams(tk.value.replace(/;/g,','))){
        if(!scopes.some(scope=>scope.name===name) && !names.includes(name)) names.push(name);
      }
    }
    if(tk.type==='param' && !scopes.some(scope=>scope.name===tk.name) && !names.includes(tk.name)) names.push(tk.name);
  }
  return names;
}

function scalar(value){
  if(typeof value!=='number') throw new AlgebraError('TYPE', 'Operadores e funções escalares exigem números. Use matadd, matsub, matmul, vadd, vsub ou scale para arrays.');
  return value;
}

export function compile(str, params={}, locals={}, symbols=null){
  let inputShapes=[], inputValues=[];
  const tokens=tokenize(normalizeInput(str));
  if(tokens.length===0) return null;
  let p=0;
  const peek=()=>tokens[p];
  const eat=()=>tokens[p++];
  const isOp=v=>peek()&&peek().type==='op'&&peek().value===v;
  const isComparison=()=>peek()&&peek().type==='op'&&COMPARISONS.has(peek().value);

  function compare(a,b,op){
    a=scalar(a); b=scalar(b);
    if(op==='<') return a<b;
    if(op==='>') return a>b;
    if(op==='<=') return a<=b;
    if(op==='>=') return a>=b;
    if(op==='==') return Math.abs(a-b)<=1e-12;
    if(op==='!=') return Math.abs(a-b)>1e-12;
    return false;
  }

  function condition(){
    const left=expr();
    if(isComparison()){
      const op=eat().value;
      const right=expr();
      return x=>compare(left(x),right(x),op);
    }
    return x=>scalar(left(x))!==0;
  }

  function expr(){
    let f=term();
    while(peek()&&peek().type==='op'&&(peek().value==='+'||peek().value==='-')){
      const op=eat().value, g=term(), ff=f;
      f = op==='+' ? x=>scalar(ff(x))+scalar(g(x)) : x=>scalar(ff(x))-scalar(g(x));
    }
    return f;
  }
  function term(){
    let f=unary();
    while(peek()&&peek().type==='op'&&(peek().value==='*'||peek().value==='/')){
      const op=eat().value, g=unary(), ff=f;
      f = op==='*' ? x=>scalar(ff(x))*scalar(g(x)) : x=>scalar(ff(x))/scalar(g(x));
    }
    return f;
  }
  function unary(){
    if(isOp('-')){ eat(); const u=unary(); return x=>-scalar(u(x)); }
    if(isOp('+')){ eat(); const u=unary(); return x=>scalar(u(x)); }
    return power();
  }
  function power(){
    const base=primary();
    if(isOp('^')){ eat(); const ex=unary(); return x=>Math.pow(scalar(base(x)),scalar(ex(x))); }
    return base;
  }
  function primary(){
    const tk=peek();
    if(!tk) throw new Error("expressão incompleta");
    if(tk.type==='symbol'){
      eat(); return ()=>{ if(!symbols) throw new AlgebraError('UNKNOWN_SYMBOL','Variável @'+tk.name+' não declarada.'); return symbols(tk.name); };
    }
    if(tk.type==='num'){ eat(); const v=tk.value; return ()=>v; }
    if(tk.type==='const'){ eat(); const v=CONSTS[tk.name]; return ()=>v; }
    if(tk.type==='var'){
      eat();
      const name=tk.name;
      const cell=Object.prototype.hasOwnProperty.call(locals,name) ? locals[name] : null;
      if(cell) return ()=>Number(cell.value);
      return x=>x;
    }
    if(tk.type==='vary'){ eat(); return ()=>implicitY; }
    if(tk.type==='param'){
      eat();
      const name=tk.name;
      const cell=Object.prototype.hasOwnProperty.call(locals,name) ? locals[name] : null;
      if(cell) return ()=>Number(cell.value);
      return ()=>Number(params[name] ?? 1);
    }
    if(tk.type==='piecewise'){
      eat();
      if(!isOp('(')) throw new Error("esperava (");
      eat();
      const test=condition();
      if(!isOp(',')) throw new Error("esperava ,");
      eat();
      const yes=expr();
      if(!isOp(',')) throw new Error("esperava ,");
      eat();
      const no=expr();
      if(!isOp(')')) throw new Error("esperava )");
      eat();
      return x=>test(x)?yes(x):no(x);
    }
    if(tk.type==='root'){
      eat();
      if(!isOp('(')) throw new Error("esperava (");
      eat();
      const index=expr();
      if(!isOp(',')) throw new Error("esperava ,");
      eat();
      const value=expr();
      if(!isOp(')')) throw new Error("esperava )");
      eat();
      return x=>realRoot(index(x), value(x));
    }
    if(tk.type==='func'){
      eat();
      const fn=FUNCS[tk.name];
      if(!isOp('(')){
        const arg=unary();
        return x=>fn(scalar(arg(x)));
      }
      eat();
      const arg=expr();
      if(!isOp(')')) throw new Error("esperava )");
      eat();
      return x=>fn(scalar(arg(x)));
    }
    if(tk.type==='limfn'){
      eat();
      if(!isOp('(')) throw new Error("esperava (");
      eat();
      const inner=expr();
      if(!isOp(',')) throw new Error("esperava ,");
      eat();
      const at=expr();
      if(!isOp(')')) throw new Error("esperava )");
      eat();
      return x=>{ const lim=limitAt(inner, at(x)); return lim.exists ? lim.value : NaN; };
    }
    if(tk.type==='special'){
      eat();
      const sname=tk.name;
      if(!isOp('(')){ throw new Error("esperava ("); }
      eat();
      if(isFitName(sname)){
        const dataFn=expr();
        let atFn=null;
        if(isOp(',')){ eat(); atFn=expr(); }
        if(!isOp(')')) throw new Error("esperava )"); eat();
        return x=>{
          const fit=fitFromPoints(sname, dataFn(x));
          if(!fit) return NaN;
          const at=atFn ? atFn(x) : x;
          return fit.predict(at);
        };
      }
      if(sname==='seq'){
        const varTk=peek();
        if(!varTk||(varTk.type!=='var' && varTk.type!=='param')||!varTk.name) throw new Error("variável esperada");
        eat(); const idxName=varTk.name;
        if(!isOp(',')) throw new Error("esperava ,"); eat();
        const fromFn=expr(); if(!isOp(',')) throw new Error("esperava ,"); eat();
        const toFn=expr(); if(!isOp(',')) throw new Error("esperava ,"); eat();
        const previous=Object.prototype.hasOwnProperty.call(locals,idxName) ? locals[idxName] : null;
        const cell={value:NaN};
        locals[idxName]=cell;
        const bodyFn=expr();
        if(previous) locals[idxName]=previous; else delete locals[idxName];
        if(!isOp(')')) throw new Error("esperava )"); eat();
        return x=>{
          const from=Math.ceil(fromFn(x)), to=Math.floor(toFn(x));
          if(!Number.isFinite(from)||!Number.isFinite(to)) return [];
          const out=[];
          for(let n=from;n<=to;n++){
            cell.value=n;
            out.push({x:n, y:bodyFn(x)});
          }
          return out;
        };
      }
      if(sname==='sum'){
        const varTk=peek();
        if(!varTk||(varTk.type!=='var' && varTk.type!=='param')||!varTk.name) throw new Error("variável esperada");
        eat(); const idxName=varTk.name;
        if(!isOp(',')) throw new Error("esperava ,"); eat();
        const fromFn=expr(); if(!isOp(',')) throw new Error("esperava ,"); eat();
        const toFn=expr(); if(!isOp(',')) throw new Error("esperava ,"); eat();
        const previous=Object.prototype.hasOwnProperty.call(locals,idxName) ? locals[idxName] : null;
        const cell={value:NaN};
        locals[idxName]=cell;
        const bodyFn=expr();
        if(previous) locals[idxName]=previous; else delete locals[idxName];
        if(!isOp(')')) throw new Error("esperava )"); eat();
        return x=>{
          const from=Math.ceil(fromFn(x)), to=Math.floor(toFn(x));
          if(!Number.isFinite(from)||!Number.isFinite(to)) return 0;
          let s=0;
          for(let n=from;n<=to;n++){
            cell.value=n;
            s+=scalar(bodyFn(x));
          }
          return s;
        };
      }
      if(sname==='deriv'){
        const inner=expr();
        if(!isOp(')')) throw new Error("esperava )"); eat();
        return x=>derivAt(inner,x);
      }
      if(Object.hasOwn(algebraFunctions,sname)){
        const args=[];
        if(!isOp(')')){
          args.push(expr());
          while(isOp(',')){ eat(); args.push(expr()); }
        }
        if(!isOp(')')) throw new Error("esperava )"); eat();
        if(args.length!==algebraArities[sname]) throw new AlgebraError('ARGUMENTS', sname+': esperados '+algebraArities[sname]+' argumentos.');
        return x=>{
          const values=args.map(fn=>fn(x));
          const result=callAlgebra(sname,values);
          inputValues=values;
          inputShapes=values.map(v=>Array.isArray(v)?(Array.isArray(v[0])?[v.length,v[0].length]:[v.length]):[]);
          return result;
        };
      }
      throw new Error("função especial não suportada: "+sname);
    }
    if(tk.type==='mat_lit'){
      eat();
      const inner=tk.value;
      return compileMatrixLiteral(inner, params, locals, symbols);
    }
    if(tk.type==='userfunc'||tk.type==='userderiv'){
      eat();
      if(!isOp('(')) throw new Error("esperava (");
      eat();
      const arg=expr();
      if(!isOp(')')) throw new Error("esperava )");
      eat();
      const name=tk.name;
      if(tk.type==='userderiv'){
        const order=tk.order;
        return x=>{
          const g=userFunctions[name];
          if(!g) return NaN;
          const at=arg(x);
          return order===2 ? secondDeriv(g,at) : derivAt(g,at);
        };
      }
      return x=>{ const g=userFunctions[name]; return g ? g(arg(x)) : NaN; };
    }
    if(isOp('(')){
      eat();
      const e=expr();
      if(!isOp(')')) throw new Error("esperava )");
      eat();
      return e;
    }
    throw new Error("token inesperado");
  }
  const fn=expr();
  if(p<tokens.length) throw new Error("sobrou expressão");
  Object.defineProperty(fn,'inputShapes',{get:()=>inputShapes});
  Object.defineProperty(fn,'inputValues',{get:()=>inputValues});
  return fn;
}

// Split an equation input into an optional inequality prefix (y <op> ...) and an
// optional trailing domain restriction {cond}. Pure string parsing.
export function parseEquationInput(raw){
  let s=String(raw==null?'':raw).trim();
  let domainSrc=null, ineqOp=null;
  const dm=s.match(/^(.*?)\s*\{([^{}]*)\}\s*$/);
  if(dm){ s=dm[1].trim(); domainSrc=dm[2].trim(); }
  const im=s.match(/^y\s*(<=|>=|<|>)\s*(.*)$/i);
  if(im){ ineqOp=im[1]; s=im[2].trim(); }
  return { ineqOp, body:s, domainSrc };
}

// Compile a domain condition into a predicate x=>boolean. Supports a single
// comparison (A op B) or a chained one (A op1 B op2 C, e.g. 0 < x < 5).
export function compileCondition(str, params={}){
  const norm=normalizeInput(str);
  const parts=[], ops=[];
  let depth=0, last=0;
  for(let i=0;i<norm.length;i++){
    const c=norm[i];
    if(c==='(') depth++;
    else if(c===')') depth--;
    else if(depth===0 && (c==='<'||c==='>'||c==='='||c==='!')){
      const two=norm.slice(i,i+2);
      let op=null;
      if(two==='<='||two==='>='||two==='=='||two==='!=') op=two;
      else if(c==='<'||c==='>') op=c;
      if(!op) continue;
      parts.push(norm.slice(last,i));
      ops.push(op);
      i+=op.length-1;
      last=i+1;
    }
  }
  parts.push(norm.slice(last));
  if(ops.length<1||ops.length>2) throw new Error("condição inválida");
  const fns=parts.map(part=>compile(part, params));
  if(fns.some(f=>f===null)) throw new Error("condição incompleta");
  const cmp=(a,b,op)=>{
    a=scalar(a); b=scalar(b);
    return op==='<'?a<b : op==='>'?a>b : op==='<='?a<=b
      : op==='>='?a>=b : op==='=='?Math.abs(a-b)<=1e-12 : Math.abs(a-b)>1e-12;
  };
  if(ops.length===1){
    const [A,B]=fns, op=ops[0];
    return x=>cmp(A(x),B(x),op);
  }
  const [A,B,C]=fns, [o1,o2]=ops;
  return x=>{ const b=B(x); return cmp(A(x),b,o1)&&cmp(b,C(x),o2); };
}

// Split on a separator that sits at the top level (outside parentheses), so
// commas/colons inside calls like root(3,x) are preserved.
export function splitTop(str, sep){
  return splitTopLevel(str, sep);
}

// Compile Desmos-style brace piecewise: "cond: value, cond: value, [default]".
// Returns x=>value (NaN where nothing matches and no default is given).
export function compilePiecewise(str, params={}){
  const clauses=[]; let fallback=null;
  for(const piece of splitTop(str, ',')){
    if(!piece.trim()) continue;
    const parts=splitTop(piece, ':');
    if(parts.length===1){
      const val=compile(parts[0], params);
      if(val) fallback=val;
    } else if(parts.length===2){
      const cond=compileCondition(parts[0], params);
      const val=compile(parts[1], params);
      if(val) clauses.push({cond, val});
    } else {
      throw new Error("piecewise inválido");
    }
  }
  if(!clauses.length && !fallback) throw new Error("piecewise vazio");
  return x=>{
    for(const c of clauses){ if(c.cond(x)) return c.val(x); }
    return fallback ? fallback(x) : NaN;
  };
}

// Parse a list of "(x,y)" points. Coordinates use '.' for decimals (the comma
// separates x from y). Returns an array of {x,y}, or null if anything is off.
export function parsePoints(str){
  const pts=[];
  for(const piece of splitTop(String(str==null?'':str), ',')){
    const m=piece.trim().match(/^\(([^()]+),([^()]+)\)$/);
    if(!m) return null;
    const x=Number(m[1]), y=Number(m[2]);
    if(!Number.isFinite(x)||!Number.isFinite(y)) return null;
    pts.push({x,y});
  }
  return pts.length ? pts : null;
}
