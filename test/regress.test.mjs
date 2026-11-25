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

test('modelLabel writes signs once and drops numerical noise',async()=>{
  const { modelLabel } = await import('../src/regress.js');
  assert.equal(modelLabel('fitsig',{y0:0.0008,L:0.9984,k:0.986677,x0:-6e-17}),'y ≈ 0.0008 + 0.9984/(1+e^(-0.986677x))');
  assert.equal(modelLabel('fitsig',{y0:0,L:2,k:1.5,x0:-3}),'y ≈ 2/(1+e^(-1.5(x + 3)))');
  assert.equal(modelLabel('fitsig',{y0:-1,L:2,k:-0.5,x0:4}),'y ≈ -1 + 2/(1+e^(0.5(x - 4)))');
  assert.equal(modelLabel('fitlog',{a:2,b:-3}),'y ≈ 2 - 3·ln(x)');
  assert.equal(modelLabel('fitlog',{a:2,b:3}),'y ≈ 2 + 3·ln(x)');
  assert.equal(modelLabel('fitexp',{a:1.5,b:-0.2}),'y ≈ 1.5·e^(-0.2x)');
  assert.equal(modelLabel('fitpow',{a:2,b:1.5}),'y ≈ 2·x^1.5');
  assert.equal(modelLabel('fit2',{coeffs:[1,2,3]}),null);
});

test('aicc penalises extra parameters and needs n > k+1',async()=>{
  const { aicc, modelParamCount } = await import('../src/regress.js');
  assert.equal(modelParamCount('fit'), 2);
  assert.equal(modelParamCount('fit4'), 5);
  assert.equal(modelParamCount('fitexp'), 2);
  assert.equal(modelParamCount('fitsig'), 4);
  // same SSE: the model with fewer parameters scores lower (better)
  assert.ok(aicc(1, 10, 3) < aicc(1, 10, 5));
  // n ln(SSE/n) + 2k + 2k(k+1)/(n-k-1)
  assert.ok(Math.abs(aicc(2, 10, 2) - (10*Math.log(0.2)+4+12/7)) < 1e-12);
  assert.equal(aicc(1, 4, 3), null);
  // a perfect fit stays finite so ties are broken by k
  assert.ok(Number.isFinite(aicc(0, 10, 3)));
  assert.ok(aicc(0, 10, 3) < aicc(0, 10, 4));
});
