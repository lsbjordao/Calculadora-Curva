import assert from 'node:assert/strict';
import test from 'node:test';

import { analyzeEq } from '../src/analysis.js';

function makeCtx(){
  const W=800, H=600, scale=38;
  return {W, H, view:{cx:0, cy:0, scale}, px2wx:px=>(px-W/2)/scale, fmt:v=>String(v)};
}

test('analyzeEq prefers the symbolic derivative functions when present',()=>{
  let d1Calls=0, d2Calls=0;
  const eq={
    text:'x^2', analysisCache:null,
    fn:x=>x*x,
    deriv1:{text:'2x', fn:x=>{ d1Calls++; return 2*x; }},
    deriv2:{text:'2', fn:x=>{ d2Calls++; return 2; }},
  };
  const a=analyzeEq(eq, makeCtx());
  assert.ok(d1Calls>0, 'symbolic f′ should be used');
  assert.ok(d2Calls>0, 'symbolic f″ should be used');
  assert.equal(a.mins.length, 1);
  assert.ok(Math.abs(a.mins[0].x)<1e-6);
});

test('analyzeEq still works numerically without symbolic derivatives',()=>{
  const eq={ text:'x^2', analysisCache:null, fn:x=>x*x };
  const a=analyzeEq(eq, makeCtx());
  assert.equal(a.mins.length, 1);
  assert.ok(Math.abs(a.mins[0].x)<1e-4);
});
