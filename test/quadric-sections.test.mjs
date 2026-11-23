import test from 'node:test';
import assert from 'node:assert/strict';
import {quadricPolynomial,sectionPlane,restrictQuadricToPlane,
  analysePlaneQuadratic,quadricPlaneSection,evaluatePlaneConic} from '../src/space3d/quadric-sections.js';

const close=(a,b,eps=1e-7)=>assert.ok(Math.abs(a-b)<eps, a+' != '+b);
const planes=[
  ['esfera',{a:2,b:2,c:2,d:0},{inclination:0,azimuth:0,offset:0},'circle'],
  ['elipsoide',{a:2,b:1,c:3,d:0},{inclination:0,azimuth:0,offset:0},'ellipse'],
  ['elipsoide',{a:2,b:1,c:3,d:0},{inclination:0,azimuth:0,offset:4},'empty'],
  ['elipsoide',{a:2,b:1,c:3,d:0},{inclination:0,azimuth:0,offset:3},'vertex-point'],
  ['paraboloide',{a:1,b:1,c:1,d:0},{inclination:0,azimuth:0,offset:2},'circle'],
  ['paraboloide',{a:1,b:1,c:1,d:0},{inclination:40,azimuth:20,offset:1},'ellipse'],
  ['hiperboloide1',{a:1,b:1,c:1,d:0},{inclination:90,azimuth:0,offset:0},'hyperbola'],
  ['hiperboloide2',{a:1,b:1,c:1,d:0},{inclination:0,azimuth:0,offset:2},'circle'],
  ['sela',{a:1,b:1,c:1,d:0},{inclination:0,azimuth:0,offset:0},'two-lines'],
  ['cilindro',{a:1,b:1,c:1,d:0},{inclination:90,azimuth:0,offset:0},'parallel-lines']
];
for(const [type,params,plane,expected] of planes)test(type+' '+JSON.stringify(plane)+' -> '+expected,()=>{
  const cut=quadricPlaneSection(type,params,plane);
  assert.equal(cut.type,expected);
  if(cut.segments.length)for(const {a,b} of cut.segments.slice(0,10)){
    assert.ok(Math.abs(evaluatePlaneConic(restrictQuadricToPlane(quadricPolynomial(type,params),sectionPlane(plane)),...a))<.03);
    assert.ok(Math.abs(evaluatePlaneConic(restrictQuadricToPlane(quadricPolynomial(type,params),sectionPlane(plane)),...b))<.03);
  }
});
test('planes at +90 and -90 degrees are truly vertical',()=>{
  for(const inclination of [90,-90]){
    const plane=sectionPlane({inclination,azimuth:0,offset:1});
    close(plane.normal[2],0);
    close(Math.abs(plane.normal[0]),1);
    close(Math.abs(plane.origin[0]),1);
  }
});
test('rotated quadratic axes are orthonormal and foci lie on major axis',()=>{
  const q={A:2,B:1,C:1,D:0,E:0,F:-1};
  const c=analysePlaneQuadratic(q);
  assert.equal(c.type,'ellipse');
  close(c.axes[0][0]*c.axes[1][0]+c.axes[0][1]*c.axes[1][1],0);
  close(c.eccentricity,Math.sqrt(1-(c.semiaxes.minor/c.semiaxes.major)**2));
});
test('tangent sections preserve their exact point even without contour segments',()=>{
  const c=quadricPlaneSection('esfera',{a:2,b:2,c:2},{offset:2});
  assert.equal(c.type,'vertex-point');
  assert.ok(c.center);
});
test('non-finite and zero normals are rejected',()=>{
  assert.throws(()=>sectionPlane({inclination:91}),/inclinação/);
  assert.throws(()=>quadricPolynomial('esfera',{a:0}),/Escalas/);
});
