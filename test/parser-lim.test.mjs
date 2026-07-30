import assert from 'node:assert/strict';
import test from 'node:test';

import { compile } from '../src/parser.js';
import { configureNumeric } from '../src/numeric.js';

configureNumeric(()=>({scale:100,W:1000,H:700,px2wx:px=>(px-500)/100}));
const close=(a,b,tol=1e-3)=>assert.ok(Math.abs(a-b)<=tol, `${a} not within ${tol} of ${b}`);

test('lim(expr, a) evaluates the two-sided limit as a constant',()=>{
  const f=compile('lim(sin(x)/x, 0)');
  close(f(0), 1);
  close(f(5), 1);          // constant: a horizontal line at the limit value
  close(compile('lim(x^2, 3)')(0), 9, 1e-6);
});

test('lim yields NaN when the limit does not exist',()=>{
  assert.ok(Number.isNaN(compile('lim(sign(x), 0)')(0)));
});
