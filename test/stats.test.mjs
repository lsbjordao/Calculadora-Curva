import assert from 'node:assert/strict';
import test from 'node:test';

import { describe, pearson } from '../src/stats.js';

const close=(a,b,tol=1e-6)=>assert.ok(Math.abs(a-b)<=tol, `${a} not within ${tol} of ${b}`);

test('describe computes center and spread (sample)',()=>{
  const d=describe([2,4,4,4,5,5,7,9]);
  assert.equal(d.n, 8);
  assert.equal(d.sum, 40);
  close(d.mean, 5);
  close(d.median, 4.5);
  assert.equal(d.mode, 4);
  close(d.variance, 32/7);   // sample: divide by n-1
  close(d.sd, Math.sqrt(32/7));
  assert.equal(d.min, 2);
  assert.equal(d.max, 9);
  assert.equal(d.range, 7);
});

test('describe population variance divides by n',()=>{
  const d=describe([2,4,4,4,5,5,7,9], {population:true});
  close(d.variance, 4);
  close(d.sd, 2);
});

test('describe quartiles via linear interpolation',()=>{
  const d=describe([1,2,3,4]);
  close(d.median, 2.5);
  close(d.q1, 1.75);
  close(d.q3, 3.25);
  close(d.iqr, 1.5);
});

test('describe has no mode when all unique',()=>{
  assert.equal(describe([1,2,3]).mode, null);
});

test('describe single value: sd/variance null',()=>{
  const d=describe([5]);
  assert.equal(d.n, 1);
  close(d.mean, 5);
  assert.equal(d.variance, null);
  assert.equal(d.sd, null);
});

test('describe returns null for empty input',()=>{
  assert.equal(describe([]), null);
  assert.equal(describe([NaN, Infinity]), null);
});

test('pearson perfect positive correlation',()=>{
  const c=pearson([{x:0,y:0},{x:1,y:1},{x:2,y:2}]);
  close(c.r, 1);
  close(c.slope, 1);
  close(c.intercept, 0);
});

test('pearson perfect negative correlation',()=>{
  const c=pearson([{x:0,y:2},{x:1,y:1},{x:2,y:0}]);
  close(c.r, -1);
  close(c.slope, -1);
});

test('pearson null on degenerate input',()=>{
  assert.equal(pearson([{x:1,y:1}]), null);          // <2 points
  assert.equal(pearson([{x:3,y:0},{x:3,y:5}]), null); // zero x variance
});

test('describe mode is null when all values tie at the same frequency',()=>{
  assert.equal(describe([1,1,2,2]).mode, null);      // bimodal -> no single mode
  assert.equal(describe([1,1,2]).mode, 1);           // clear single mode
  assert.equal(describe([5,5,5]).mode, 5);           // single repeated value IS the mode
});

test('describe population variance is defined for n=1',()=>{
  const d=describe([5], {population:true});
  assert.equal(d.variance, 0);                       // /n with n=1 -> 0, not null
  assert.equal(d.sd, 0);
});

test('pearson returns null for nullish input',()=>{
  assert.equal(pearson(null), null);
  assert.equal(pearson(undefined), null);
  assert.equal(pearson([]), null);
});

test('boxplot: whiskers stop at the last value inside the 1.5·IQR fences',async()=>{
  const { boxplot } = await import('../src/stats.js');
  const b=boxplot([1,2,3,4,5,6,7,8,30]);
  assert.equal(b.n, 9);
  assert.equal(b.q1, 3); assert.equal(b.median, 5); assert.equal(b.q3, 7);
  assert.equal(b.lowerFence, -3); assert.equal(b.upperFence, 13);
  assert.equal(b.whiskerLow, 1); assert.equal(b.whiskerHigh, 8);
  assert.deepEqual(b.outliers, [30]);
});

test('boxplot: no outliers, single value and empty input',async()=>{
  const { boxplot } = await import('../src/stats.js');
  const b=boxplot([2,3,3,4,4,4,5,5,5,5,6,6,6,7,7,8]);
  assert.deepEqual(b.outliers, []);
  assert.equal(b.whiskerLow, 2); assert.equal(b.whiskerHigh, 8);
  const one=boxplot([5]);
  assert.equal(one.median, 5); assert.equal(one.whiskerLow, 5); assert.equal(one.whiskerHigh, 5);
  assert.equal(boxplot([]), null);
  assert.deepEqual(boxplot([-50,1,2,3,4]).outliers, [-50]);
});
