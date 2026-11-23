import test from 'node:test';
import assert from 'node:assert/strict';
import {dragPlaneParameters,dragConeParameters,PLANE_DRAG_CONFIG} from '../src/space3d/plane-interaction.js';

test('arrasto horizontal move o plano para ambos os lados e atravessa zero',()=>{
  const start={q:90,b:.9};
  const b=dragPlaneParameters(start,{dx:50,dy:0});
  assert.equal(b.q,90);
  assert.equal(b.b,0);
  const c=dragPlaneParameters(start,{dx:100,dy:0});
  assert.ok(c.b<0);
  assert.deepEqual(start,{q:90,b:.9});
});
test('arrasto vertical inclina e respeita os extremos verticais',()=>{
  assert.equal(dragPlaneParameters({q:0,b:.5},{dx:0,dy:-500}).q,90);
  assert.equal(dragPlaneParameters({q:0,b:.5},{dx:0,dy:500}).q,-90);
  assert.equal(dragPlaneParameters({q:20,b:.5},{dx:0,dy:50}).q,20-50*PLANE_DRAG_CONFIG.degreesPerPixel);
});
test('arrasto limita b a [-4,4] e rejeita valores inválidos',()=>{
  assert.equal(dragPlaneParameters({q:0,b:0},{dx:10000,dy:0}).b,-4);
  assert.equal(dragPlaneParameters({q:0,b:0},{dx:-10000,dy:0}).b,4);
  assert.throws(()=>dragPlaneParameters({q:0,b:NaN},{dx:1,dy:2}),/inválida/);
});

test('arrasto do cone abre a superfície e eleva seu vértice',()=>{
  const start={a:1,d:0};
  assert.deepEqual(dragConeParameters(start,{dx:40,dy:-80}),{a:1.4,d:2});
  assert.deepEqual(dragConeParameters(start,{dx:40,dy:-80},{kind:'vertex'}),{a:1,d:2});
  assert.equal(dragConeParameters(start,{dx:-1000,dy:0}).a,.4);
  assert.equal(dragConeParameters(start,{dx:1000,dy:0}).a,2.5);
  assert.deepEqual(start,{a:1,d:0});
});
