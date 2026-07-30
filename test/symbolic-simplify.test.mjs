import assert from 'node:assert/strict';
import test from 'node:test';

import { derivativeText, parseExpr, simplify, toText, CHAIN, STEP_FUNCS, containsVar } from '../src/symbolic.js';
import { compile } from '../src/parser.js';
import { derivAt } from '../src/numeric.js';

// A derivada simbólica deve coincidir numericamente com a derivada de 4ª
// ordem da função original em todos os pontos válidos.
function checkAgainstNumeric(expr, xs){
  const d=derivativeText(expr);
  assert.notEqual(d, null, expr);
  const f=compile(expr), df=compile(d);
  let checked=0;
  for(const x of xs){
    const ref=derivAt(f,x), v=df(x);
    if(!Number.isFinite(ref)||!Number.isFinite(v)) continue;
    checked++;
    assert.ok(Math.abs(v-ref)<=1e-4*Math.max(1,Math.abs(ref)), `${expr} em x=${x}: simbólico=${v} numérico=${ref}`);
  }
  assert.ok(checked>=2, `${expr}: pontos válidos insuficientes`);
}

test('simpPow não funde (u^par)^fracionário — (x^2)^0.5 é |x|', ()=>{
  checkAgainstNumeric('(x^2)^0.5', [-2,-0.5,0.8,2]);
  checkAgainstNumeric('(x^2)^1.5', [-2,-0.5,0.8,2]);
});

test('simpPow ainda funde quando é seguro', ()=>{
  assert.equal(toText(simplify(parseExpr('(x^3)^2'))), 'x^6');
  assert.equal(toText(simplify(parseExpr('(x^2)^3'))), 'x^6');
  // interno ímpar: domínio de x^(3/2) já é x>=0, igual ao de (x^3)^0.5
  assert.equal(toText(simplify(parseExpr('(x^3)^0.5'))), 'x^(3/2)');
});

test('cancelamentos e canonicalização', ()=>{
  assert.equal(derivativeText('sqrt(x^2+1)'), 'x/sqrt(x^2+1)');
  assert.equal(derivativeText('x*ln(x) - x'), 'ln(x)');
  assert.equal(derivativeText('sin(x)^2 + cos(x)^2'), '0');
  assert.equal(derivativeText('pi*x^2/2'), 'pi*x');
  assert.equal(toText(simplify(parseExpr('sin(x)/sin(x)'))), '1');
  assert.equal(toText(simplify(parseExpr('x*(1/x)'))), '1');
  assert.equal(toText(simplify(parseExpr('(2*x)/(2*sqrt(x))'))), 'x/sqrt(x)');
});

test('divisão preservada quando não cancela; sem dobrar 1/0', ()=>{
  assert.equal(derivativeText('1/x'), '-1/x^2');
  const t=toText(simplify(parseExpr('x/0')));
  assert.ok(t.includes('/0'), 'divisão por zero fica simbólica: '+t);
});

test('invariante: simplificação não muda valor', ()=>{
  const exprs=['(x^2+1)/(x-2)','x/(x^2+1)^2','sin(x)/x','x^2*sin(x)/(2x)','(3x+1)^5/(x+1)','2x/(4sqrt(x^2+1))','x^2/x^5','(x+1)^2/(x+1)'];
  for(const e of exprs){
    const f=compile(e), g=compile(toText(simplify(parseExpr(e))));
    let checked=0;
    for(const x of [-2.3,-0.7,0.4,1.6,3.1]){
      const a=f(x), b=g(x);
      if(!Number.isFinite(a)||!Number.isFinite(b)) continue;
      checked++;
      assert.ok(Math.abs(a-b)<=1e-9*Math.max(1,Math.abs(a)), `${e} em x=${x}: ${a} vs ${b}`);
    }
    assert.ok(checked>=3, e);
  }
});

test('infra exportada para os motores de passos', ()=>{
  assert.equal(typeof CHAIN.sin, 'function');
  assert.ok(STEP_FUNCS.has('floor'));
  assert.equal(containsVar(parseExpr('x+1')), true);
  assert.equal(containsVar(parseExpr('a+1')), false);
  assert.equal(toText({t:'dop', u:parseExpr('x^2')}), 'd/dx[x^2]');
  assert.equal(toText({t:'iop', u:parseExpr('x^2')}), '∫[x^2]dx');
});
