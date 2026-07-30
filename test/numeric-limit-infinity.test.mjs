import assert from 'node:assert/strict';
import test from 'node:test';

import { configureNumeric, limitAtInfinity } from '../src/numeric.js';
import { compile } from '../src/parser.js';

configureNumeric(()=>({scale:100,W:1000,H:700,px2wx:px=>(px-500)/100}));

function close(a,b,tol=1e-3){ assert.ok(Math.abs(a-b)<=tol, `${a} not within ${tol} of ${b}`); }

test('limitAtInfinity finds finite limits',()=>{
  close(limitAtInfinity(compile('1/x'),1).value,0);
  close(limitAtInfinity(compile('1/x'),-1).value,0);
  close(limitAtInfinity(compile('(2*x+1)/(x+1)'),1).value,2);
  close(limitAtInfinity(compile('exp(-x)'),1).value,0);
});

test('limitAtInfinity detects divergence to infinity',()=>{
  const r=limitAtInfinity(compile('x^2'),1);
  assert.equal(r.exists,true);
  assert.equal(r.value,Infinity);
});

test('limitAtInfinity reports no limit for oscillation',()=>{
  assert.equal(limitAtInfinity(compile('sin(x)'),1).exists,false);
});
