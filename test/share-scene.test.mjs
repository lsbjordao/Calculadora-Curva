import test from 'node:test';
import assert from 'node:assert/strict';
import {encodeSharedScene,decodeSharedScene} from '../src/share-scene.js';
const state={
  equations:[{text:'corte: elipsoide,a,b,c,d,q,p,h',params:{a:2,b:1.5,c:1.7,d:0,q:20,p:0,h:0},
    visible:true,name:'Elipsóide — seção',style:'dashed',unknown:'ignored',
    surfacePoint:[1.2,-.3],surfaceDirection:55,clipSide:-1}],
  view:{cx:1,cy:2,scale:48}, dualSection:true,
  view3d:{mode:'3d',camera:{azimuth:-20,elevation:40,target:[1,2,3],scale:50,projection:'perspective'}}
};
test('share link retains math, geometry, viewport and Unicode but strips extraneous metadata',()=>{
  const encoded=encodeSharedScene(state);
  assert.match(encoded,/^[A-Za-z0-9_-]+$/);
  const result=decodeSharedScene(encoded);
  assert.deepEqual(result.view3d,state.view3d);
  assert.deepEqual(result.view,state.view);
  assert.equal(result.dualSection,true);
  assert.equal(result.equations[0].name,'Elipsóide — seção');
  assert.deepEqual(result.equations[0].params,state.equations[0].params);
  assert.equal('unknown' in result.equations[0],false);
  assert.deepEqual(result.equations[0].surfacePoint,[1.2,-.3]);
  assert.equal(result.equations[0].surfaceDirection,55);
  assert.equal(result.equations[0].clipSide,-1);
});
test('shared scene rejects invalid and oversized payloads',()=>{
  assert.throws(()=>decodeSharedScene('%2E'),/inválido|ler/);
  assert.throws(()=>decodeSharedScene('a'.repeat(25000)),/longo|inválido/);
  assert.throws(()=>encodeSharedScene({equations:[]}),/500 linhas|entre 1 e 500/);
});
