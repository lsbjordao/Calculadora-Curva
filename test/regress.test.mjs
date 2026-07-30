import assert from 'node:assert/strict';
import test from 'node:test';

import { polyFit, expFit, powFit, logFit, sigmoidFit } from '../src/regress.js';

const close=(a,b,tol=1e-6)=>assert.ok(Math.abs(a-b)<=tol, `${a} not within ${tol} of ${b}`);

test('polyFit fits a perfect line',()=>{
  const r=polyFit([{x:0,y:1},{x:1,y:3},{x:2,y:5}], 1);
  close(r.coeffs[0], 1);   // intercept
  close(r.coeffs[1], 2);   // slope
  close(r.r2, 1);
  close(r.predict(3), 7);
});

test('polyFit fits a parabola',()=>{
  const r=polyFit([{x:-1,y:1},{x:0,y:0},{x:1,y:1},{x:2,y:4}], 2);
  close(r.predict(3), 9, 1e-6);
  close(r.r2, 1, 1e-9);
});

test('polyFit caps degree at points-1',()=>{
  const r=polyFit([{x:0,y:0},{x:1,y:1}], 5);
  assert.equal(r.degree, 1);
});

test('expFit fits y = e^x',()=>{
  const r=expFit([{x:0,y:1},{x:1,y:Math.E},{x:2,y:Math.E**2}]);
  close(r.a, 1, 1e-6);
  close(r.b, 1, 1e-6);
  close(r.predict(3), Math.E**3, 1e-3);
});

test('powFit fits y = 2 x^2',()=>{
  const r=powFit([{x:1,y:2},{x:2,y:8},{x:4,y:32}]);
  close(r.a, 2, 1e-6);
  close(r.b, 2, 1e-6);
  close(r.predict(3), 18, 1e-3);
});

test('logFit fits y = 2 + 3 ln(x)',()=>{
  const r=logFit([{x:1,y:2},{x:Math.E,y:5},{x:Math.E**2,y:8}]);
  close(r.a, 2, 1e-6);
  close(r.b, 3, 1e-6);
  close(r.predict(Math.E**3), 11, 1e-6);
});

test('sigmoidFit approximates a logistic curve',()=>{
  const points=[-4,-2,0,2,4].map(x=>({x,y:1/(1+Math.exp(-x))}));
  const r=sigmoidFit(points);
  assert.ok(r);
  close(r.predict(0), 0.5, 0.03);
  close(r.predict(4), 1/(1+Math.exp(-4)), 0.04);
  assert.ok(r.r2>0.995);
});
