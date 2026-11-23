import test from 'node:test';
import assert from 'node:assert/strict';
import {compileScalarSurface,multivariateAt,findStationaryPoints,
  sampleLevelContours,scalarSurfaceScene} from '../src/space3d/scalar-surfaces.js';
import {parseGeometryInput} from '../src/geometry.js';
const near=(x,y,t=.01)=>assert.ok(Math.abs(x-y)<t,`${x} != ${y}`);
test('arbitrary z=f(x,y) computes consistent first and second derivatives',()=>{
  const {at}=compileScalarSurface('z = sin(x)*cos(y)');
  const q=multivariateAt(at,.3,.7);
  near(q.point[2],Math.sin(.3)*Math.cos(.7));
  near(q.gradient[0],Math.cos(.3)*Math.cos(.7));
  near(q.gradient[1],-Math.sin(.3)*Math.sin(.7));
  near(q.hessian[0][0],-Math.sin(.3)*Math.cos(.7));
  near(q.hessian[1][1],-Math.sin(.3)*Math.cos(.7));
  near(q.hessian[0][1],-Math.cos(.3)*Math.sin(.7));
  near(Math.hypot(...q.normal),1,1e-8);
});
test('Hessian classifies known minimum maximum and saddle at origin',()=>{
  for(const [expr,kind] of [['z = x^2+y^2','mínimo local'],
      ['z = -x^2-y^2','máximo local'],['z = x^2-y^2','ponto de sela']]){
    const {at}=compileScalarSurface(expr);
    const q=multivariateAt(at,0,0);
    assert.equal(q.critical,true);
    assert.equal(q.criticalType,kind);
    assert.ok(findStationaryPoints(at).some(p=>Math.hypot(...p.point.slice(0,2))<1e-5));
  }
});
test('level contours for a paraboloid lie at their sampled heights',()=>{
  const {at}=compileScalarSurface('z=x^2+y^2');
  const contour=sampleLevelContours(at,{extent:3,resolution:60,levels:[1,4]});
  assert.ok(contour.segments.length>80);
  for(const seg of contour.segments.slice(0,50)){
    for(const p of [seg.a,seg.b])near(at(...p),seg.level,.03);
  }
});
test('scalar surface includes gradient, tangent plane and level curves',()=>{
  const data=scalarSurfaceScene('z=sin(x)*cos(y)',{}, {x:.3,y:.2});
  assert.ok(data.scene.some(p=>p.kind==='mesh'&&p.faces.length>100));
  assert.ok(data.scene.some(p=>p.kind==='plane'));
  assert.ok(data.scene.some(p=>p.kind==='arrow'));
  assert.ok(data.levels.segments.length>100);
  near(data.levels.toWorld([.3,.2])[2],data.calc.point[2],1e-8);
});
test('general surface parser falls back to nonquadric explicit functions',()=>{
  const fn=parseGeometryInput('superficie: z=sin(x)*cos(y)');
  assert.equal(fn.error,undefined);
  assert.equal(fn.dim,3);
  assert.equal(fn.section.kind,'function-levels');
  const quadratic=parseGeometryInput('superficie: x^2+y^2+z^2=9');
  assert.equal(quadratic.error,undefined);
  assert.equal(quadratic.generalQuadric.classification.type,'Elipsoide');
  const forced=parseGeometryInput('funcao3d: z=x^2-y^2');
  assert.equal(forced.error,undefined);
  assert.equal(forced.section.kind,'function-levels');
});
test('non-explicit and z-dependent scalar functions are rejected',()=>{
  assert.throws(()=>compileScalarSurface('x+y+z=4'),/z = f/);
  assert.throws(()=>compileScalarSurface('z=x+z'),/depender de z/);
});
