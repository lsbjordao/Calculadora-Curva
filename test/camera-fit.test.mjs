import test from 'node:test';
import assert from 'node:assert/strict';
import {finiteSceneBounds} from '../src/space3d/camera-fit.js';
import {parseGeometryInput} from '../src/geometry.js';

test('enquadrar superfícies deslocadas usa centro da geometria e não a origem',()=>{
  const geometry=parseGeometryInput('quadrica: elipsoide,2,1,1,4');
  assert.ok(!geometry.error,String(geometry.error));
  const bounds=finiteSceneBounds([{kind:'geometry',visible:true,geometry}]);
  assert.ok(bounds);
  assert.ok(bounds.count>500);
  assert.ok(Math.abs(bounds.target[0])<1e-8);
  assert.ok(Math.abs(bounds.target[1])<1e-8);
  assert.ok(Math.abs(bounds.target[2]-4)<1e-8);
  assert.ok(bounds.min[2]<4&&bounds.max[2]>4);
});
test('objetos ocultos e planos infinitos não distorcem o enquadramento',()=>{
  const a={kind:'geometry',visible:true,geometry:{dim:3,scene3d:[
    {kind:'segment',a:[2,3,5],b:[4,7,9]},
    {kind:'plane',n:[1,0,0],d:999999}
  ]}};
  const b={kind:'geometry',visible:false,geometry:{dim:3,scene3d:[
    {kind:'point',p:[10000,0,0]}
  ]}};
  const bounds=finiteSceneBounds([a,b]);
  assert.deepEqual(bounds.target,[3,5,7]);
  assert.ok(bounds.max[0]<10);
  assert.equal(finiteSceneBounds([]),null);
});
