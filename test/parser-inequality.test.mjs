import assert from 'node:assert/strict';
import test from 'node:test';

import { parseEquationInput, compileCondition, compilePiecewise } from '../src/parser.js';

test('parseEquationInput splits inequality prefix and domain suffix',()=>{
  assert.deepEqual(parseEquationInput('x^2'), {ineqOp:null, body:'x^2', domainSrc:null});
  assert.deepEqual(parseEquationInput('y < x^2'), {ineqOp:'<', body:'x^2', domainSrc:null});
  assert.deepEqual(parseEquationInput('y >= sin(x)'), {ineqOp:'>=', body:'sin(x)', domainSrc:null});
  assert.deepEqual(parseEquationInput('x^2 {0 < x < 5}'), {ineqOp:null, body:'x^2', domainSrc:'0 < x < 5'});
  assert.deepEqual(parseEquationInput('y < x^2 {x > 0}'), {ineqOp:'<', body:'x^2', domainSrc:'x > 0'});
});

test('compileCondition handles single comparisons',()=>{
  const p=compileCondition('x > 0');
  assert.equal(p(1), true);
  assert.equal(p(-1), false);
  assert.equal(compileCondition('x <= 2')(2), true);
  assert.equal(compileCondition('x <= 2')(3), false);
});

test('compileCondition handles chained comparisons',()=>{
  const p=compileCondition('0 < x < 5');
  assert.equal(p(3), true);
  assert.equal(p(6), false);
  assert.equal(p(-1), false);
  assert.equal(p(0), false);
});

test('compileCondition resolves parameters',()=>{
  const params={a:1};
  const p=compileCondition('x > a', params);
  assert.equal(p(2), true);
  assert.equal(p(0), false);
  params.a=5;
  assert.equal(p(2), false);
});

test('compilePiecewise builds a brace-notation piecewise (Heaviside step)',()=>{
  const f=compilePiecewise('x < 0: 0, x >= 0: 1');
  assert.equal(f(-1), 0);
  assert.equal(f(0), 1);
  assert.equal(f(2), 1);
});

test('compilePiecewise supports a bare default value and chained conditions',()=>{
  const g=compilePiecewise('x < 0: -1, 1');
  assert.equal(g(-2), -1);
  assert.equal(g(5), 1);
  const h=compilePiecewise('0 < x < 5: 1, 0');
  assert.equal(h(3), 1);
  assert.equal(h(10), 0);
  assert.equal(h(-1), 0);
});
