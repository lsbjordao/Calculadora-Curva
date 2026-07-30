import assert from 'node:assert/strict';
import test from 'node:test';

import { configureNumeric, derivAt, derivSides, derivInfo } from '../src/numeric.js';

test('derivAt no longer depends on the viewport zoom',()=>{
  // Absurdly zoomed-out viewport: with the old pixel-based step this made
  // h huge and destroyed accuracy; the step must now be point-relative.
  configureNumeric(()=>({scale:0.05, W:1000, H:800, px2wx:px=>(px-500)/0.05}));
  const d=derivAt(Math.sin, 0);
  assert.ok(Math.abs(d-1)<1e-9, 'sin\'(0)=1, got '+d);
  configureNumeric(()=>({scale:38, W:0, H:0, px2wx:px=>px}));
  const d2=derivAt(Math.sin, 0);
  assert.ok(Math.abs(d-d2)<1e-12, 'derivative value must not change with zoom');
});

test('derivSides returns one-sided derivatives',()=>{
  const {left,right}=derivSides(Math.abs, 0);
  assert.ok(Math.abs(left-(-1))<1e-6, 'left deriv of |x| at 0 is -1, got '+left);
  assert.ok(Math.abs(right-1)<1e-6, 'right deriv of |x| at 0 is +1, got '+right);
});

test('derivInfo flags a corner (|x| at 0)',()=>{
  const info=derivInfo(Math.abs, 0);
  assert.equal(info.differentiable, false);
  assert.equal(info.reason, 'corner');
});

test('derivInfo flags a point outside the domain',()=>{
  const f=x=>(x*x-1)/(x-1);       // hole at x=1
  const info=derivInfo(f, 1);
  assert.equal(info.differentiable, false);
  assert.equal(info.reason, 'undefined-point');
});

test('derivInfo flags a one-sided/vertical tangent (sqrt at 0)',()=>{
  const info=derivInfo(Math.sqrt, 0);
  assert.equal(info.differentiable, false);
});

test('derivInfo does not flag smooth functions',()=>{
  for(const [f,x] of [[Math.sin,0.7],[x=>x*x*x,0],[Math.exp,-2],[x=>1/x,0.5],[x=>Math.sin(30*x),0.3]]){
    const info=derivInfo(f,x);
    assert.equal(info.differentiable, true, 'should be differentiable at '+x);
    assert.ok(Number.isFinite(info.value));
  }
});
