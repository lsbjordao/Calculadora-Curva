import assert from 'node:assert/strict';
import test from 'node:test';
import { readFileSync } from 'node:fs';

import { analyzeEq } from '../src/analysis.js';
import { configureNumeric, derivAt, integralAt, integ, limitAt } from '../src/numeric.js';
import { compile, extractParams, parseEquationInput, compileCondition, compilePiecewise, splitTop, parsePoints, isDefinitionLhs } from '../src/parser.js';
import { PRESETS } from '../src/presets.js';
import { addGeometryDefinitions, parseGeometryInput } from '../src/geometry.js';
import { describe as statDescribe, pearson } from '../src/stats.js';
import { algebraDeclaration, createAlgebraSymbols } from '../src/algebra-symbols.js';
import { resultInfo } from '../src/algebra-ui.js';

// Validate any preset equation regardless of kind (function, inequality, domain,
// brace piecewise, parametric, polar, points/regression). Mirrors recompileEq.
function equationValid(text, geometryRegistry=null, params={}, symbols=null){
  const raw=String(text).trim();
  const declaration=algebraDeclaration(raw), calc=raw.match(/^calc\s*:\s*(.+)$/i);
  if(declaration) return !!resultInfo(symbols(declaration.name));
  if(calc) return !!resultInfo(compile(calc[1],params,{},symbols)(0));
  const fm=raw.match(/^(points|fit\d*|fitexp|fitpow|fitlog|fitsig|histogram|hist|boxplot|box|seq|intersec|stats|compare|comparar|resid|residual)\s*:\s*(.+)$/i);
  if(!fm){
    const geometry=parseGeometryInput(raw,{registry:geometryRegistry,params,symbols});
    if(geometry){
      if(!geometry.error) addGeometryDefinitions(geometryRegistry,geometry);
      return !geometry.error;
    }
  }
  if(fm){
    const spec=fm[1].toLowerCase();
    if(spec==='histogram' || spec==='hist' || spec==='box' || spec==='boxplot'){
      const nums=[];
      for(const piece of splitTop(fm[2], ',')){
        const v=Number(piece.trim());
        if(Number.isFinite(v)) nums.push(v);
      }
      if(nums.length>0) return true;
      try{
        const value=compile(fm[2],params)(0);
        return Array.isArray(value) ? value.length>0 : Number.isFinite(value);
      }catch(_){
        return false;
      }
    }
    if(spec==='stats'){
      const nums=splitTop(fm[2], ',').map(piece=>Number(piece.trim()));
      if(nums.length>0 && nums.every(Number.isFinite)) return true;
    }
    if(spec==='seq') return Array.isArray(compile('seq('+fm[2]+')',params)(0));
    if(spec==='intersec'){
      const parts=splitTop(fm[2], ',');
      return parts.length>=2 && typeof compile(parts[0],params)==='function' && typeof compile(parts[1],params)==='function';
    }
    if(spec==='resid'||spec==='residual'){
      const parts=splitTop(fm[2], ',');
      if(parts.length<2) return false;
      const model=parts.shift().trim().toLowerCase();
      if(!/^fit\d*$/.test(model)&&!['fitexp','fitpow','fitlog','fitsig'].includes(model)) return false;
      const source=parts.join(',');
      if(parsePoints(source)!==null) return true;
      try{
        const value=compile(source,params)(0);
        return Array.isArray(value) && value.every(p=>p && Number.isFinite(p.x) && Number.isFinite(p.y));
      }catch(_){
        return false;
      }
    }
    if(spec==='compare'||spec==='comparar'){
      if(parsePoints(fm[2])!==null) return true;
      try{
        const value=compile(fm[2],params)(0);
        return Array.isArray(value) && value.every(p=>p && Number.isFinite(p.x) && Number.isFinite(p.y));
      }catch(_){
        return false;
      }
    }
    if(parsePoints(fm[2])!==null) return true;
    try{
      const value=compile(fm[2],params)(0);
      return Array.isArray(value) && value.every(p=>p && Number.isFinite(p.x) && Number.isFinite(p.y));
    }catch(_){
      return false;
    }
  }
  const pm=raw.match(/^r\s*=\s*(.+)$/i);
  if(pm) return typeof compile(pm[1],params)==='function';
  if(raw.startsWith('(')&&raw.endsWith(')')){
    const parts=splitTop(raw.slice(1,-1),',');
    if(parts.length===2) return typeof compile(parts[0],params)==='function' && typeof compile(parts[1],params)==='function';
  }
  // implicit: a top-level single '=' (not a comparison), lhs not a definition
  let depth=0, ei=-1;
  for(let i=0;i<raw.length;i++){
    const c=raw[i];
    if(c==='(') depth++; else if(c===')') depth--;
    else if(c==='=' && depth===0){
      const pv=raw[i-1], nx=raw[i+1];
      if(pv!=='<'&&pv!=='>'&&pv!=='!'&&pv!=='='&&nx!=='='){ ei=i; break; }
    }
  }
  if(ei>=0){
    const lhs=raw.slice(0,ei).trim(), rhs=raw.slice(ei+1).trim();
    const implicitBareVar=/^[a-zA-Z]+$/ .test(lhs) && ['x','t','theta'].includes(lhs);
    if(!isDefinitionLhs(lhs) || implicitBareVar) return typeof compile(lhs,params)==='function' && typeof compile(rhs,params)==='function';
  }
  depth=0;
  for(let i=0;i<raw.length;i++){
    const c=raw[i];
    if(c==='('||c==='{') depth++;
    else if(c===')'||c==='}') depth--;
    else if(depth===0 && (c==='<'||c==='>')){
      const lhs=raw.slice(0,i).trim(), rhs=raw.slice(i+(raw[i+1]==='='?2:1)).trim();
      if(lhs!=='y'&&rhs) return typeof compile(lhs,params)==='function' && typeof compile(rhs,params)==='function';
    }
  }
  const p=parseEquationInput(raw);
  if(p.domainSrc&&!p.domainSrc.includes(':')) compileCondition(p.domainSrc,params);
  if(p.domainSrc&&p.domainSrc.includes(':')) return typeof compilePiecewise(p.domainSrc,params)==='function';
  return typeof compile(p.body,params)==='function';
}

const view={cx:0,cy:0,scale:100};
const W=1000;
const H=700;
const px2wx=px=>(px-W/2)/view.scale+view.cx;
const fmt=v=>String(Number(v.toPrecision(6)));

configureNumeric(()=>({scale:view.scale,W,H,px2wx}));

function close(actual,expected,tol=1e-6){
  assert.ok(Math.abs(actual-expected)<=tol, `${actual} not within ${tol} of ${expected}`);
}

function ensureAppDomStub(){
  if(globalThis.document) return;
  const ctx=new Proxy({},{get:(t,p)=>p in t?t[p]:()=>{},set:(t,p,v)=>{t[p]=v;return true;}});
  function makeProxy(){
    const store={dataset:{},style:{},classList:{toggle(){},add(){},remove(){},contains(){return false;}}};
    return new Proxy(store,{
      get(t,prop){
        if(prop in t) return t[prop];
        switch(prop){
          case 'getBoundingClientRect': return ()=>({left:0,top:0,right:800,bottom:600,width:800,height:600});
          case 'getContext': return ()=>ctx;
          case 'querySelector': return ()=>makeProxy();
          case 'querySelectorAll': return ()=>[];
          case 'closest': return ()=>null;
          case 'appendChild': return c=>c;
          case 'cloneNode': return ()=>makeProxy();
          case 'contains': case 'matches': return ()=>false;
          default: return ()=>{};
        }
      },
      set(t,prop,val){t[prop]=val;return true;}
    });
  }
  globalThis.document={getElementById:()=>makeProxy(),createElement:()=>makeProxy(),createTextNode:t=>({textContent:t}),querySelector:()=>makeProxy(),querySelectorAll:()=>[],addEventListener(){},removeEventListener(){},contains(){return false;},body:makeProxy()};
  globalThis.window={addEventListener(){},devicePixelRatio:1,innerWidth:1200,innerHeight:800};
  globalThis.requestAnimationFrame=()=>0;
  globalThis.getComputedStyle=()=>({getPropertyValue:()=>'#000000'});
  globalThis.Event=class Event{constructor(t){this.type=t;}};
  globalThis.localStorage={getItem:()=>null,setItem(){},removeItem(){}};
}

test('parser accepts common calculator notation',()=>{
  close(compile('sen(pi/2)')(0),1);
  close(compile('sin x')(Math.PI/2),1);
  close(compile('sin(1,5)')(0),Math.sin(1.5));
  close(compile('arctg(1)')(0),Math.PI/4);
  close(compile('√9')(0),3);
  close(compile('|-2|')(0),2);
  close(compile('1,5x')(2),3);
  close(compile('2pi')(0),2*Math.PI);
  close(compile('1e-3*x')(2),0.002);
});

test('parser supports live parameters',()=>{
  const params={a:2,b:3,c:-1};
  const fn=compile('a*x^2+b*x+c',params);
  close(fn(2),13);
  params.a=1;
  params.b=0;
  params.c=0;
  close(fn(2),4);
  assert.deepEqual(extractParams('a*x^2+b*x+c'),['a','b','c']);
});

test('parser supports piecewise functions and comparisons',()=>{
  const step=compile('piecewise(x < 0, -1, 1)');
  assert.equal(step(-0.5),-1);
  assert.equal(step(0),1);
  const absLike=compile('piecewise(x < 0, -x, x)');
  close(absLike(-2),2);
  close(absLike(3),3);
  const nested=compile('piecewise(x < -1, -1, piecewise(x < 1, x, 1))');
  close(nested(-2),-1);
  close(nested(0.25),0.25);
  close(nested(2),1);
  const alias=compile('if(x >= 2, x^2, 0)');
  close(alias(1),0);
  close(alias(3),9);
});

test('root computes real n-th roots, including odd roots of negatives',()=>{
  close(compile('root(2,x)')(9),3);
  close(compile('root(3,x)')(27),3);
  close(compile('root(3,x)')(-27),-3);
  close(compile('root(5,x)')(-32),-2);
  close(compile('root(4,x)')(16),2);
  assert.ok(Number.isNaN(compile('root(4,x)')(-16)));
  close(compile('root(3,8)')(0),2);    // comma as argument separator
  close(compile('root(3, 8)')(0),2);   // spaced literal radicand
  close(compile('raiz(3,x)')(8),2);    // Portuguese alias
});

test('parser supports sums, sequences and linear algebra values',()=>{
  close(compile('sum(n,1,10,n)')(0),55);
  const params={n:5};
  const sum=compile('sum(i,1,n,i^2)',params);
  close(sum(0),55);
  params.n=3;
  close(sum(0),14);
  assert.deepEqual(extractParams('sum(i,1,n,i^2)'),['n']);
  assert.deepEqual(extractParams('det([[a,0],[0,d]])'),['a','d']);
  assert.deepEqual(extractParams('sum(i,1,n,det([[i,0],[0,a]]))'),['n','a']);
  assert.deepEqual(compile('seq(i,1,3,i^2)')(0),[
    {x:1,y:1},
    {x:2,y:4},
    {x:3,y:9}
  ]);
  close(compile('det([[1,2],[3,4]])')(0),-2);
  close(compile('det([[1,2,3],[0,1,4],[5,6,0]])')(0),1,1e-9);
  assert.deepEqual(compile('cross([1,0,0],[0,1,0])')(0),[0,0,1]);
  assert.deepEqual(compile('linsolve([[2,1],[1,3]],[5,10])')(0),[1,3]);
});

test('parser supports statistical fits fed by sequences and sums',()=>{
  const params={n:5};
  close(compile('fit(seq(i,1,n,2i+1),4)',params)(0),9,1e-9);
  close(compile('fit2(seq(i,1,n,i^2))',params)(4),16,1e-9);
  close(compile('fit2(seq(i,1,n,i^2),4)',params)(0),16,1e-9);
  close(compile('sum(i,1,n,(i^2-fit2(seq(j,1,n,j^2),i))^2)',params)(0),0,1e-9);
  assert.deepEqual(extractParams('sum(i,1,n,(i^2-fit2(seq(j,1,n,j^2),i))^2)'),['n']);
});

test('numeric derivative and integral stay accurate on smooth functions',()=>{
  const square=compile('x^2');
  const cubic=compile('x^3');
  close(derivAt(square,3),6,1e-3);
  close(derivAt(cubic,2),12,2e-3);
  close(integralAt(square,1),1/3,1e-4);
  close(integ(compile('sin(x)'),0,Math.PI),2,1e-4);
});

test('integral refuses to bridge singularities',()=>{
  const reciprocal=compile('1/x');
  assert.ok(Number.isNaN(integ(reciprocal,-1,1)));
});

test('limit estimator handles removable, divergent, and mismatched limits',()=>{
  const square=compile('x^2');
  const removable=compile('sin(x)/x');
  const reciprocal=compile('1/x');
  const reciprocalSquared=compile('1/x^2');
  const jump=compile('sign(x)');
  close(limitAt(square,0).value,0,1e-9);
  close(limitAt(square,1).value,1,1e-9);
  close(limitAt(removable,0).value,1,1e-3);
  assert.equal(limitAt(reciprocal,0).exists,false);
  assert.equal(limitAt(reciprocalSquared,0).value,Infinity);
  assert.equal(limitAt(jump,0).exists,false);
});

test('analysis detects basic shape of a parabola',()=>{
  const eq={text:'x^2',fn:compile('x^2'),analysisCache:null};
  const result=analyzeEq(eq,{W,H,view,px2wx,fmt});
  assert.ok(result.zeros.some(x=>Math.abs(x)<1e-3));
  assert.ok(result.mins.some(p=>Math.abs(p.x)<1e-2&&Math.abs(p.y)<1e-4));
  assert.equal(result.parity,'par (eixo y)');
  assert.equal(result.hAsym,'—');
});

test('analysis does not invent inflections on a straight line',()=>{
  const eq={text:'x',fn:compile('x'),analysisCache:null};
  const result=analyzeEq(eq,{W,H,view,px2wx,fmt});
  assert.equal(result.inflex.length,0);
});

test('analysis finds the single inflection of a cubic',()=>{
  const eq={text:'x^3',fn:compile('x^3'),analysisCache:null};
  const result=analyzeEq(eq,{W,H,view,px2wx,fmt});
  assert.ok(result.inflex.some(p=>Math.abs(p.x)<0.05), 'expected an inflection near x=0');
});

test('analysis classifies removable discontinuities separately from asymptotes',()=>{
  const eq={text:'sin(x)/x',fn:compile('sin(x)/x'),analysisCache:null};
  const result=analyzeEq(eq,{W,H,view,px2wx,fmt});
  assert.ok(result.holes.some(p=>Math.abs(p.x)<1e-3&&Math.abs(p.y-1)<1e-3));
  assert.equal(result.vAsym.length,0);
});

test('stats: detects 2-var literal points vs 1-var list',()=>{
  // 2-var: literal points parse
  const pts=parsePoints('(0,1),(1,2),(2,3)');
  assert.ok(Array.isArray(pts) && pts.length===3);
  const c=pearson(pts);
  assert.ok(c && c.r>0.99);
  // 1-var: a bare number list is not points
  assert.equal(parsePoints('4,8,15,16,23'), null);
  const d=statDescribe([4,8,15,16,23]);
  assert.equal(d.n, 5);
});

test('calculator pad buttons expose syntax-oriented tooltips',()=>{
  const html=readFileSync(new URL('../index.html', import.meta.url), 'utf8');
  const match=html.match(/<div id="pad">([\s\S]*?)<\/div>\s*<section id="presets"/);
  assert.ok(match, 'pad markup not found');
  const buttons=[...match[1].matchAll(/<button\b([^>]*)>([\s\S]*?)<\/button>/g)]
    .map((m,index)=>({index:index+1, attrs:m[1], label:m[2].replace(/<[^>]+>/g,'').trim()}));
  assert.ok(buttons.length>100, 'expected keypad buttons');
  const missing=buttons.filter(button=>!/(^|\s)title=/.test(button.attrs));
  assert.deepEqual(missing.map(button=>button.label), []);

  const syntaxButtons=buttons.filter(button=>
    /\sdata-ins=|\sdata-geo-tool=|\sid="geo-build-/.test(button.attrs)
  );
  const missingSyntax=syntaxButtons.filter(button=>!/title="Sintaxe/.test(button.attrs));
  assert.deepEqual(missingSyntax.map(button=>button.label), []);
});

test('stats pad buttons load complete, plottable examples',async()=>{
  const { polyFit, expFit, powFit, logFit, sigmoidFit } = await import('../src/regress.js');
  const html=readFileSync(new URL('../index.html', import.meta.url), 'utf8');
  const grid=html.match(/<div id="grid-stats"[^>]*>([\s\S]*?)<\/div>/);
  assert.ok(grid, 'stats grid not found');
  const buttons=[...grid[1].matchAll(/<button\b([^>]*)>([\s\S]*?)<\/button>/g)]
    .map(m=>({attrs:m[1], label:m[2].trim(), ins:m[1].match(/data-ins="([^"]*)"/)?.[1]}))
    .filter(b=>b.ins!==undefined && !['n',','].includes(b.label));
  assert.ok(buttons.length>=17, 'expected stats example buttons');
  const notExample=buttons.filter(b=>!/\sdata-example=/.test(b.attrs)).map(b=>b.label);
  assert.deepEqual(notExample, [], 'stats buttons must replace the line with an example');
  const invalid=buttons.filter(b=>!equationValid(b.ins, null, {n:10})).map(b=>b.label+': '+b.ins);
  assert.deepEqual(invalid, []);
  const fitters={fitexp:expFit, fitpow:powFit, fitlog:logFit, fitsig:sigmoidFit};
  for(const b of buttons){
    const m=b.ins.match(/^(fit\d*|fitexp|fitpow|fitlog|fitsig)\s*:\s*(\(.+)$/);
    if(!m) continue;
    const pts=parsePoints(m[2]);
    const fit=fitters[m[1]] ? fitters[m[1]](pts) : polyFit(pts, m[1]==='fit' ? 1 : Number(m[1].slice(3)));
    assert.ok(fit && fit.r2>0.9, b.label+' example should produce a good fit');
  }
});

test('fit comparison and residual commands validate point sources',()=>{
  assert.ok(equationValid('compare: seq(i,1,n,i^2+sin(i)/3)', null, {n:6}));
  assert.ok(equationValid('resid: fit2, seq(i,1,n,i^2+sin(i)/3)', null, {n:6}));
  assert.ok(equationValid('compare: (0,1),(1,2),(2,5)', null, {}));
  assert.equal(equationValid('resid: nope, seq(i,1,n,i^2)', null, {n:4}), false);
});

test('residual table rows expose observed, predicted, and error columns',async()=>{
  ensureAppDomStub();
  const {residualPointsForModel, residualTableRows}=await import('../src/app.js');
  const result=residualPointsForModel([{x:0,y:1},{x:1,y:2},{x:2,y:5}], 'fit');
  assert.ok(result);
  const rows=residualTableRows(result.metrics);
  assert.equal(rows.length, 3);
  for(const row of rows){
    assert.equal(Number.isFinite(row.x), true);
    assert.equal(Number.isFinite(row.observed), true);
    assert.equal(Number.isFinite(row.predicted), true);
    assert.equal(Number.isFinite(row.residual), true);
    close(row.residual, row.observed-row.predicted);
    close(row.squared, row.residual*row.residual);
    close(row.absolute, Math.abs(row.residual));
  }
});

test('histogram table rows expose frequency, relative frequency, cumulative count, and density',async()=>{
  ensureAppDomStub();
  const {histogramTableRows}=await import('../src/app.js');
  const rows=histogramTableRows([1,2,2,3], {histBins:2});
  assert.equal(rows.length, 2);
  assert.deepEqual(rows.map(row=>row.count), [1,3]);
  assert.deepEqual(rows.map(row=>row.cumulative), [1,4]);
  close(rows[0].relative, 0.25);
  close(rows[1].relative, 0.75);
  close(rows[0].cumulativeRelative, 0.25);
  close(rows[1].cumulativeRelative, 1);
  close(rows[0].density, 0.25);
  close(rows[1].density, 0.75);
});

test('fit parameter rows expose model metrics and coefficients',async()=>{
  ensureAppDomStub();
  const {residualPointsForModel, fitParameterRows}=await import('../src/app.js');
  const poly=residualPointsForModel([{x:0,y:1},{x:1,y:4},{x:2,y:9},{x:3,y:16}], 'fit2');
  assert.ok(poly);
  const polyRows=fitParameterRows('fit2', poly.fit, poly.metrics);
  assert.ok(polyRows.some(row=>row.item==='modelo' && row.value==='polinomial grau 2'));
  assert.ok(polyRows.some(row=>row.item==='RMSE'));
  ['a0','a1','a2'].forEach(item=>assert.ok(polyRows.some(row=>row.item===item), item));

  const exp=residualPointsForModel([{x:0,y:1},{x:1,y:Math.E},{x:2,y:Math.E*Math.E}], 'fitexp');
  assert.ok(exp);
  const expRows=fitParameterRows('fitexp', exp.fit, exp.metrics);
  assert.ok(expRows.some(row=>row.item==='modelo' && row.value==='exponencial'));
  assert.ok(expRows.some(row=>row.item==='a'));
  assert.ok(expRows.some(row=>row.item==='b'));
  close(expRows.find(row=>row.item==='a').value, 1);
  close(expRows.find(row=>row.item==='b').value, 1);
});

test('fit parameter rows show floating-point noise as zero',async()=>{
  ensureAppDomStub();
  const {fitParameterRows}=await import('../src/app.js');
  const sig=fitParameterRows('fitsig', {y0:0.0008, L:0.9984, k:0.98, x0:-6e-17, label:'y'});
  assert.equal(sig.find(row=>row.item==='x0').value, 0);
  const poly=fitParameterRows('fit2', {coeffs:[3e-15, 2, 1], label:'y'});
  assert.equal(poly.find(row=>row.item==='a0').value, 0);
  assert.equal(poly.find(row=>row.item==='a1').value, 2);
});

test('linearLabel: negative intercept renders as "- abs" not "+-"', async ()=>{
  // Import the real exported linearLabel from src/app.js (not an inline copy).
  // app.js needs a DOM stub to load in Node.js — mirror the stub used in
  // the computeHistogramBins test below.
  if(!globalThis.document){
    const ctx=new Proxy({},{get:(t,p)=>p in t?t[p]:()=>{},set:(t,p,v)=>{t[p]=v;return true;}});
    function makeProxy(){
      const store={dataset:{},style:{},classList:{toggle(){},add(){},remove(){},contains(){return false;}}};
      return new Proxy(store,{
        get(t,prop){
          if(prop in t) return t[prop];
          switch(prop){
            case 'getBoundingClientRect': return ()=>({left:0,top:0,right:800,bottom:600,width:800,height:600});
            case 'getContext': return ()=>ctx;
            case 'querySelector': return ()=>makeProxy();
            case 'querySelectorAll': return ()=>[];
            case 'closest': return ()=>null;
            case 'appendChild': return c=>c;
            case 'cloneNode': return ()=>makeProxy();
            case 'contains': case 'matches': return ()=>false;
            default: return ()=>{};
          }
        },
        set(t,prop,val){t[prop]=val;return true;}
      });
    }
    globalThis.document={getElementById:()=>makeProxy(),createElement:()=>makeProxy(),createTextNode:t=>({textContent:t}),querySelector:()=>makeProxy(),querySelectorAll:()=>[],addEventListener(){},removeEventListener(){},contains(){return false;},body:makeProxy()};
    globalThis.window={addEventListener(){},devicePixelRatio:1,innerWidth:1200,innerHeight:800};
    globalThis.requestAnimationFrame=()=>0;
    globalThis.getComputedStyle=()=>({getPropertyValue:()=>'#000000'});
    globalThis.Event=class Event{constructor(t){this.type=t;}};
    globalThis.localStorage={getItem:()=>null,setItem(){},removeItem(){}};
  }
  const {linearLabel}=await import('../src/app.js');
  const negLabel=linearLabel(2, -1.1);
  assert.ok(!negLabel.includes('+-'), 'must not contain "+-": got '+negLabel);
  assert.ok(!negLabel.includes('+ -'), 'must not contain "+ -": got '+negLabel);
  assert.ok(negLabel.includes(' - '), 'must contain " - " for negative intercept: got '+negLabel);
  const posLabel=linearLabel(2, 3);
  assert.ok(posLabel.includes(' + '), 'must contain " + " for positive intercept: got '+posLabel);
  assert.ok(!posLabel.includes('+-'), 'must not contain "+-": got '+posLabel);
  // Unified with the polynomial fit label: spaced `y ≈ …` (not the old `y≈…`).
  assert.ok(negLabel.startsWith('y ≈ '), 'must use spaced "y ≈ " like fit labels: got '+negLabel);
  assert.ok(posLabel.startsWith('y ≈ '), 'must use spaced "y ≈ " like fit labels: got '+posLabel);
});

test('all presets contain valid expressions',()=>{
  assert.ok(PRESETS.length>=28);
  const ids=PRESETS.map(preset=>preset.id);
  ['riemann-methods','local-linearization','implicit-regions','data-model-choice','data-histograms','sequences-sums','curve-intersections','data-logistic-log-fits','data-residuals','data-model-comparison','linear-algebra-computation'].forEach(id=>{
    assert.ok(ids.includes(id), 'missing preset '+id);
  });
  const signatures=new Set();
  for(const preset of PRESETS){
    const geometryRegistry=new Map();
    const symbols=createAlgebraSymbols(preset.equations).resolve;
    assert.ok(preset.equations.length>=3, preset.id);
    assert.ok(preset.category, preset.id);
    assert.ok(preset.description, preset.id);
    assert.equal(/^No(?:vo)\b|No(?:vo):/.test(preset.label),false, preset.id);
    assert.notEqual(preset.category,'Novas '+'funções', preset.id);
    const signature=preset.equations.map(equation=>equation.text).sort().join('|');
    assert.equal(signatures.has(signature),false, `duplicated preset: ${preset.id}`);
    signatures.add(signature);
    for(const equation of preset.equations){
      const valid=equationValid(equation.text,geometryRegistry,equation.params||{},symbols);
      const detail=valid?'':parseGeometryInput(equation.text,{registry:geometryRegistry,params:equation.params||{},symbols})?.error;
      assert.ok(valid, `${preset.id}: ${equation.text} - ${detail||'expressão inválida'}`);
    }
  }
});

test('computeHistogramBins exact honors requested count', async ()=>{
  // app.js needs a DOM stub to load in Node.js
  if(!globalThis.document){
    const ctx=new Proxy({},{get:(t,p)=>p in t?t[p]:()=>{},set:(t,p,v)=>{t[p]=v;return true;}});
    function makeProxy(){
      const store={dataset:{},style:{},classList:{toggle(){},add(){},remove(){},contains(){return false;}}};
      return new Proxy(store,{
        get(t,prop){
          if(prop in t) return t[prop];
          switch(prop){
            case 'getBoundingClientRect': return ()=>({left:0,top:0,right:800,bottom:600,width:800,height:600});
            case 'getContext': return ()=>ctx;
            case 'querySelector': return ()=>makeProxy();
            case 'querySelectorAll': return ()=>[];
            case 'closest': return ()=>null;
            case 'appendChild': return c=>c;
            case 'cloneNode': return ()=>makeProxy();
            case 'contains': case 'matches': return ()=>false;
            default: return ()=>{};
          }
        },
        set(t,prop,val){t[prop]=val;return true;}
      });
    }
    globalThis.document={getElementById:()=>makeProxy(),createElement:()=>makeProxy(),createTextNode:t=>({textContent:t}),querySelector:()=>makeProxy(),querySelectorAll:()=>[],addEventListener(){},removeEventListener(){},contains(){return false;},body:makeProxy()};
    globalThis.window={addEventListener(){},devicePixelRatio:1,innerWidth:1200,innerHeight:800};
    globalThis.requestAnimationFrame=()=>0;
    globalThis.getComputedStyle=()=>({getPropertyValue:()=>'#000000'});
    globalThis.Event=class Event{constructor(t){this.type=t;}};
    globalThis.localStorage={getItem:()=>null,setItem(){},removeItem(){}};
  }
  const {computeHistogramBins}=await import('../src/app.js');
  const data=[1,2,3,4,5,6,7,8,9,10];
  assert.equal(computeHistogramBins(data, 5, true).length, 5);
  assert.equal(computeHistogramBins(data, 999, true).length, 50); // clamped
  // auto rule unchanged
  assert.ok(computeHistogramBins(data, 12, false).length <= 12);
});

test('compare ranks models by AICc so extra parameters must earn their place',async()=>{
  ensureAppDomStub();
  const {compareFitModels}=await import('../src/app.js');
  const noise=[0.3,-0.2,0.1,-0.4,0.25,-0.1,0.35,-0.3,0.05,-0.15];
  const noisy=noise.map((e,k)=>({x:k+1, y:(k+1)**2+e}));
  const rows=compareFitModels(noisy);
  assert.equal(rows[0].spec, 'fit2');
  assert.equal(rows[0].deltaAicc, 0);
  assert.ok(rows.every((row,i)=>i===0 || row.aicc==null || row.deltaAicc>=0));
  assert.ok(rows.find(row=>row.spec==='fit4').rmse < rows[0].rmse, 'fit4 has lower RMSE but loses');

  const exact=Array.from({length:7},(_,x)=>({x, y:x*x+1}));
  assert.equal(compareFitModels(exact)[0].spec, 'fit2');

  const tiny=compareFitModels([{x:0,y:1},{x:1,y:2},{x:2,y:5}]);
  assert.ok(tiny.length>0);
  assert.ok(tiny.every((row,i)=>i===0 || row.rmse>=tiny[i-1].rmse || row.aicc!=null), 'no AICc: falls back to RMSE');
});
