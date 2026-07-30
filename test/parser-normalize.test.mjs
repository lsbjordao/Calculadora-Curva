import assert from 'node:assert/strict';
import test from 'node:test';

import { normalizeInput, extractParams, isDefinitionLhs } from '../src/parser.js';

test('normalizeInput rewrites calculator notation into parseable text',()=>{
  assert.equal(normalizeInput('|x|'),'abs(x)');
  assert.equal(normalizeInput('√(9)'),'sqrt(9)');
  assert.equal(normalizeInput('√9'),'sqrt(9)');
  assert.equal(normalizeInput('2³'),'2^(3)');
  assert.equal(normalizeInput('1,5'),'1.5');
  assert.equal(normalizeInput('3×4÷2'),'3*4/2');
  assert.equal(normalizeInput('−5'),'-5');
});

test('normalizeInput strips a function definition left-hand side',()=>{
  assert.equal(normalizeInput('f(x) = x^2'),' x^2');
  assert.equal(normalizeInput('g(t)=t'),'t');
  assert.equal(normalizeInput('sin(x)=cos(y)'),'sin(x)=cos(y)');
  assert.equal(normalizeInput('sen(x)=cos(y)'),'sen(x)=cos(y)');
  // A bare comparison is not a definition and must be preserved.
  assert.equal(normalizeInput('x == 2'),'x == 2');
});

test('isDefinitionLhs distinguishes user definitions from known function calls',()=>{
  assert.equal(isDefinitionLhs('f(x)'),true);
  assert.equal(isDefinitionLhs('g(t)'),true);
  assert.equal(isDefinitionLhs('y'),true);
  assert.equal(isDefinitionLhs('sin(x)'),false);
  assert.equal(isDefinitionLhs('sen(x)'),false);
  assert.equal(isDefinitionLhs('log2(x)'),false);
  assert.equal(isDefinitionLhs('root(3,x)'),false);
});

test('extractParams collects parameter names, deduped, ignoring x and functions',()=>{
  assert.deepEqual(extractParams('a*x+b'),['a','b']);
  assert.deepEqual(extractParams('sin(x)'),[]);
  assert.deepEqual(extractParams('a*x+a'),['a']);
  assert.deepEqual(extractParams('k*x^2'),['k']);
});
