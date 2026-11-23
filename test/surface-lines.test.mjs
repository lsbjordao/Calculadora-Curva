import test from 'node:test';
import assert from 'node:assert/strict';
import {buildMeshSurfaceLines} from '../src/space3d/surface-lines.js';
import {quadricScene} from '../src/space3d/quadrics.js';
import {coneSurface} from '../src/space3d/conic-sections.js';
import {generalQuadricFromEquation,meshImplicitQuadric,clipTriangleMesh} from '../src/space3d/implicit-quadric.js';
import {scalarSurfaceScene} from '../src/space3d/scalar-surfaces.js';

function check(mesh,expected){
  assert.equal(mesh.strategy,expected);
  assert.ok(mesh.segmentCount>20,`expected lines, received ${mesh.segmentCount}`);
  assert.equal(mesh.positions.length,mesh.segmentCount*6);
  assert.ok([...mesh.positions].every(Number.isFinite),'3D line coordinates must be finite');
  for(let i=0;i<mesh.positions.length;i+=6){
    const dx=mesh.positions[i]-mesh.positions[i+3],
      dy=mesh.positions[i+1]-mesh.positions[i+4],
      dz=mesh.positions[i+2]-mesh.positions[i+5];
    assert.ok(dx*dx+dy*dy+dz*dz>1e-13,'zero-length guides should be discarded');
  }
}

test('standard parametric quadrics get readable meridians and parallels, not triangle diagonals',()=>{
  for(const type of ['esfera','elipsoide','paraboloide','hiperboloide1','hiperboloide2','sela','cilindro']){
    for(const primitive of quadricScene(type).scene){
      const normal=buildMeshSurfaceLines(primitive);
      check(normal,'grid');
      assert.ok(normal.segmentCount<1300);
      const dense=buildMeshSurfaceLines(primitive,'detailed');
      assert.ok(dense.segmentCount>normal.segmentCount,`more lines expected for ${type}`);
      assert.equal(buildMeshSurfaceLines(primitive,'off').segmentCount,0);
    }
  }
});
test('double-cone generates closed rings and generators for both nappes',()=>{
  const cone=coneSurface();
  const normal=buildMeshSurfaceLines(cone);
  check(normal,'cone');
  const verticesPerSheet=cone.vertices.length/2;
  const lower=normal.positions.filter((_,index)=>index%3===2&&index%6<3).some(z=>z<0);
  const upper=normal.positions.filter((_,index)=>index%3===2&&index%6<3).some(z=>z>0);
  assert.ok(lower&&upper);
  assert.ok(verticesPerSheet>0);
  assert.ok(buildMeshSurfaceLines(cone,'detailed').segmentCount>normal.segmentCount);
});
test('implicit rotated quadric uses sectional guide curves without triangulation noise',()=>{
  const polynomial=generalQuadricFromEquation('x^2+2xy+3y^2+z^2=9');
  const mesh=meshImplicitQuadric(polynomial,{resolution:12,extent:4});
  const shape={kind:'mesh',vertices:mesh.vertices,faces:mesh.faces};
  const guides=buildMeshSurfaceLines(shape,'normal');
  check(guides,'slices');
  assert.ok(guides.segmentCount<20000);
  const detailed=buildMeshSurfaceLines(shape,'detailed');
  assert.ok(detailed.segmentCount>guides.segmentCount);
  const clipped=clipTriangleMesh(mesh,{n:[0,0,1],d:0},1);
  const cut=buildMeshSurfaceLines({kind:'mesh',vertices:clipped.vertices,faces:clipped.faces},'normal');
  check(cut,'slices');
  for(let i=2;i<cut.positions.length;i+=3)assert.ok(cut.positions[i]>=-1e-4);
});
test('nonquadratic scalar surfaces display orthogonal curved guide families',()=>{
  const graph=scalarSurfaceScene('z=sin(x)*cos(y)');
  const guide=buildMeshSurfaceLines(graph.scene.find(x=>x.kind==='mesh'));
  check(guide,'slices');
  assert.ok(guide.segmentCount<20000);
});
test('missing mesh and hidden guide mode are harmless',()=>{
  for(const value of [null,{}, {kind:'segment'},{kind:'mesh',vertices:[],faces:[]}]){
    assert.equal(buildMeshSurfaceLines(value).segmentCount,0);
  }
  assert.equal(buildMeshSurfaceLines(quadricScene('esfera').scene[0],'invalid').segmentCount,0);
});
