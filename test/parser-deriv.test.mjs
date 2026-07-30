import assert from 'node:assert/strict';
import test from 'node:test';

import { compile, normalizeInput, setUserFunctions } from '../src/parser.js';

function near(got, want, tol=1e-6){
  assert.ok(Math.abs(got-want)<=tol*Math.max(1,Math.abs(want)),
    `got ${got}, want ${want}`);
}

test('deriv(expr) evaluates the derivative at the current x',()=>{
  const f=compile('deriv(x^2)');
  near(f(3), 6);
  near(f(-1.5), -3);
  near(compile('deriv(sin(x))')(0), 1);
});

test('d/dx(...) is normalized to deriv(...)',()=>{
  assert.equal(normalizeInput('d/dx(x^2)'), 'deriv(x^2)');
  near(compile('d/dx(x^3)')(2), 12);
});

test("f'(x) uses the numeric derivative of the user function",()=>{
  setUserFunctions({ g:x=>x*x });
  near(compile("g'(x)")(3), 6);
  near(compile("g'(2x)")(1), 4);      // f' evaluated at g-arg, not chain rule
  setUserFunctions({});
});

test("f''(x) is the second derivative",()=>{
  setUserFunctions({ g:x=>x*x*x });
  near(compile("g''(x)")(2), 12, 1e-4);
  setUserFunctions({});
});

test("implicit multiplication works around f'",()=>{
  setUserFunctions({ g:x=>x*x });
  near(compile("2g'(x)")(3), 12);
  setUserFunctions({});
});

test("prime on an undefined user function is NaN (late-bound)",()=>{
  setUserFunctions({});
  assert.ok(Number.isNaN(compile("h'(x)")(1)));
});

test('unicode prime is accepted',()=>{
  setUserFunctions({ g:x=>x*x });
  near(compile('g′(x)')(3), 6);
  setUserFunctions({});
});

test('deriv of deriv gives a second derivative numerically',()=>{
  near(compile('deriv(deriv(x^3))')(2), 12, 1e-3);
});
