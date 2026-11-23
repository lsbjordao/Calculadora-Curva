import test from 'node:test';
import assert from 'node:assert/strict';
import {quadricTangent,quadricSurfacePoint,tangentScene} from '../src/space3d/surface-calculus.js';
import {quadricPolynomial} from '../src/space3d/quadric-sections.js';

const TYPES=['esfera','elipsoide','paraboloide','hiperboloide1','hiperboloide2','sela','cilindro'];
const params={a:1.8,b:1.2,c:1.5,d:.4};
const dot=(a,b)=>a.reduce((s,x,i)=>s+x*b[i],0);
for(const type of TYPES)test('tangent gradient is normal to '+type,()=>{
  const {point,normal,gradient,distance,residual}=quadricTangent(type,params,.64,.23);
  assert.ok(Math.abs(residual)<1e-10,'point should satisfy analytic quadric');
  assert.ok(Math.abs(dot(normal,point)-distance)<1e-10);
  assert.ok(Math.abs(Math.hypot(...normal)-1)<1e-10);
  assert.ok(dot(gradient,normal)>0);
  const {scene}=tangentScene(type,params,.64,.23);
  assert.ok(scene.some(x=>x.kind==='plane'));
  assert.ok(scene.some(x=>x.kind==='arrow'));
  const poly=quadricPolynomial(type,params);
  const delta=1e-5;
  for(let i=0;i<3;i++){
    const plus=[...point],minus=[...point];
    plus[i]+=delta;minus[i]-=delta;
    const f=v=>v.reduce((s,x,j)=>s+poly.diag[j]*x*x+poly.linear[j]*x,poly.constant);
    const numerical=(f(plus)-f(minus))/(2*delta);
    assert.ok(Math.abs(numerical-gradient[i])<1e-6);
  }
});
test('saddle and elliptic paraboloid expose correct partial derivatives',()=>{
  for(const type of ['sela','paraboloide']){
    const p=quadricTangent(type,params,.76,.38);
    const sign=type==='sela'?-1:1;
    assert.ok(Math.abs(p.derivatives.dx-2*params.c*p.point[0]/(params.a**2))<1e-10);
    assert.ok(Math.abs(p.derivatives.dy-sign*2*params.c*p.point[1]/(params.b**2))<1e-10);
  }
});
test('two-sheeted hyperboloid changes height for opposite sheet',()=>{
  const upper=quadricSurfacePoint('hiperboloide2',params,.6,.2,1);
  const lower=quadricSurfacePoint('hiperboloide2',params,.6,.2,-1);
  assert.ok(upper[2]>params.d&&lower[2]<params.d);
  assert.deepEqual(upper.slice(0,2),lower.slice(0,2));
});
test('singular and invalid surface coordinates are not silently accepted',()=>{
  assert.throws(()=>quadricTangent('sela',params,2,.5),/entre 0 e 1/);
  assert.throws(()=>quadricTangent('incorreta',params,.5,.5),/desconhecido|não suportado/);
});
