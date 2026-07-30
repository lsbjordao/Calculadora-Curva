import assert from 'node:assert/strict';
import test from 'node:test';

import { compile, setUserFunctions } from '../src/parser.js';

test('user-defined functions are callable, composable and implicit-multipliable',()=>{
  setUserFunctions({ g:x=>x+1, f:x=>x*x });
  assert.equal(compile('g(x)')(2), 3);
  assert.equal(compile('2*g(x)')(2), 6);
  assert.equal(compile('2g(x)')(2), 6);      // implicit multiplication
  assert.equal(compile('f(g(x))')(2), 9);    // composition: f(3)=9
  setUserFunctions({});
});

test('calls to undefined user functions evaluate to NaN (late-bound)',()=>{
  setUserFunctions({});
  assert.ok(Number.isNaN(compile('h(x)')(2)));
  // becomes defined later without recompiling
  const f=compile('h(x)+1');
  setUserFunctions({ h:x=>x*10 });
  assert.equal(f(2), 21);
  setUserFunctions({});
});
