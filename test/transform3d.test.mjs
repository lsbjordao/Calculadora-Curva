import test from 'node:test';
import assert from 'node:assert/strict';
import {matmul,eye,svd,det} from '../src/linear-algebra.js';
import {transformMatrix3D,buildTransform3DScene} from '../src/space3d/transform3d.js';
import {scenePrimitives,has3dObjects} from '../src/space3d/view3d.js';
import {prepareThreePrimitives} from '../src/space3d/three-renderer.js';
const near=(x,y,eps=1e-8)=>{
  if(Array.isArray(x)){assert.equal(x.length,y.length);x.forEach((v,i)=>near(v,y[i],eps));}
  else assert.ok(Math.abs(x-y)<eps,String(x)+' != '+y);
};
test('matriz 3x3 interpola do cubo identidade à matriz A sem mutar entrada',()=>{
  const A=[[2,0,0],[0,1,0],[0,0,.5]],copy=JSON.parse(JSON.stringify(A));
  near(transformMatrix3D(A,0),eye(3));
  near(transformMatrix3D(A,.5),[[1.5,0,0],[0,1,0],[0,0,.75]]);
  near(transformMatrix3D(A,1),A);
  assert.deepEqual(A,copy);
  assert.throws(()=>transformMatrix3D([[1,2],[3,4]]),/3×3/);
});
test('cubo 3D possui malha, doze arestas e três vetores de base',()=>{
  const A=[[2,0,0],[0,1,0],[0,0,.5]];
  const {scene,matrix,det:volume}=buildTransform3DScene(A);
  assert.equal(scene.filter(x=>x.kind==='mesh').length,1);
  assert.equal(scene.filter(x=>x.kind==='segment'&&!x.dash).length,12);
  assert.equal(scene.filter(x=>x.kind==='segment'&&x.dash).length,12);
  assert.equal(scene.filter(x=>x.kind==='arrow').length,3);
  assert.ok(Math.abs(volume-1)<1e-9);
  const eq={kind:'result',visible:true,error:false,showAlgebraTransform3d:true,transformScene3d:scene};
  assert.equal(has3dObjects([eq]),true);
  const prims=scenePrimitives([eq],{colorOf:()=>'#000'});
  assert.equal(prims.filter(x=>x.kind==='mesh').length,1);
  assert.equal(prepareThreePrimitives(prims).filter(x=>x.kind==='mesh').length,1);
  const mesh=prims.find(x=>x.kind==='mesh');
  assert.deepEqual(mesh.vertices[7],[2,1,.5]);
});
test('SVD em 3D termina na matriz A e preserva a decomposição',()=>{
  const A=[[2,.3,0],[0,1.2,0],[0,0,-.5]];
  const decomposition=svd(A);
  near(transformMatrix3D(A,0,{decomposition}),eye(3));
  near(transformMatrix3D(A,1,{decomposition}),A,1e-6);
  const C=matmul(decomposition.U,matmul(
    decomposition.S.map((s,i)=>decomposition.S.map((_,j)=>i===j?s:0)),decomposition.Vt));
  near(C,A,1e-6);
});
