import assert from 'node:assert/strict';
import test from 'node:test';

import { fmt, fmtLimitNumber, formatLimitInfo, formatLimitInfinity, niceStep, snapToStep } from '../src/coords.js';

test('fmt formats numbers compactly with exponentials at the extremes',()=>{
  assert.equal(fmt(0),'0');
  assert.equal(fmt(1.5),'1.5');
  assert.equal(fmt(1/3),'0.333333');
  assert.equal(fmt(0.00001),'1e-5');
  assert.equal(fmt(1234567),'1e+6');
  assert.equal(fmt(-2),'-2');
});

test('fmtLimitNumber renders infinities and non-finite values',()=>{
  assert.equal(fmtLimitNumber(Infinity),'+∞');
  assert.equal(fmtLimitNumber(-Infinity),'-∞');
  assert.equal(fmtLimitNumber(NaN),'—');
  assert.equal(fmtLimitNumber(2),'2');
});

test('formatLimitInfo describes existing and split limits',()=>{
  assert.equal(formatLimitInfo({exists:true,value:1},0),'lim x→0 ≈ 1');
  assert.equal(
    formatLimitInfo({exists:false,left:{exists:true,value:-1},right:{exists:true,value:1}},0),
    'lim x→0 não existe; esq -1, dir 1'
  );
  assert.equal(
    formatLimitInfo({exists:false,left:null,right:{exists:true,value:3}},2),
    'lim x→2 não existe; esq —, dir 3'
  );
});

test('formatLimitInfinity describes limits at infinity',()=>{
  assert.equal(formatLimitInfinity({exists:true,value:2},'+'),'lim x→+∞ ≈ 2');
  assert.equal(formatLimitInfinity({exists:true,value:Infinity},'+'),'lim x→+∞ ≈ +∞');
  assert.equal(formatLimitInfinity({exists:false,value:NaN},'-'),'lim x→-∞ não existe');
});

test('niceStep rounds spacing to 1/2/5 × 10^n given a scale',()=>{
  assert.equal(niceStep(80,38),2);
  assert.equal(niceStep(80,100),1);
  assert.equal(niceStep(80,20),5);
  assert.equal(niceStep(80,10),10);
});

test('snapToStep rounds coordinates to clean grid multiples',()=>{
  assert.equal(snapToStep(1.37,0.2),1.4);
  assert.equal(snapToStep(1.24,0.5),1);
  assert.equal(snapToStep(0.6000000000001,0.2),0.6);
  assert.equal(snapToStep(-1.26,0.5),-1.5);
});
