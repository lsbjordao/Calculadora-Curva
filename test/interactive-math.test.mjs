import test from 'node:test';
import assert from 'node:assert/strict';
import {partialDerivativeText,multivariateDerivativeTexts} from '../src/symbolic.js';
import {compileXyz} from '../src/space3d/implicit-quadric.js';
import {compileScalarSurface,multivariateAt} from '../src/space3d/scalar-surfaces.js';
import {compileImplicitSurface,meshImplicitFunction,sampleImplicitPlane} from '../src/space3d/implicit-surfaces.js';
import {compileVectorField,fieldDifferentials,lineIntegralCircle,fluxThroughDisk} from '../src/space3d/vector-fields.js';
import {parseGeometryInput} from '../src/geometry.js';
import {compareSelectedPlanes,inspectEquation} from '../src/math-inspector.js';

const near=(actual,expected,tol=1e-7)=>
  assert.ok(Math.abs(actual-expected)<tol,`Esperado ${expected}, obtido ${actual}`);

test('derivadas parciais simbólicas distinguem x e y',()=>{
  const expr='x^2*y+sin(x*y)';
  const deriv=multivariateDerivativeTexts(expr);
  assert.ok(deriv?.fx&&deriv.fy&&deriv.fxx&&deriv.fxy&&deriv.fyy);
  const fx=compileXyz(deriv.fx),fy=compileXyz(deriv.fy);
  const x=.7,y=.8;
  near(fx(x,y,0),2*x*y+y*Math.cos(x*y));
  near(fy(x,y,0),x*x+x*Math.cos(x*y));
  assert.equal(partialDerivativeText('y^2','x'),'0');
  assert.throws(()=>partialDerivativeText('x','q'),/Eixo/);
});

test('gradiente e Hessiana usam derivação simbólica quando disponível',()=>{
  const {at,symbolic}=compileScalarSurface('z = x^2-y^2+sin(x*y)');
  assert.ok(symbolic);
  const p=multivariateAt(at,1,0);
  assert.equal(p.derivativeSource,'simbólica');
  near(p.gradient[0],2);
  near(p.gradient[1],1);
  near(p.hessian[0][0],2);
  near(p.hessian[0][1],1);
  near(p.hessian[1][1],-3);
});

test('superfície implícita cúbica gera malha finita e corte aproximado',()=>{
  const f=compileImplicitSurface('x^3+y^3+z^3=1');
  near(f(1,0,0),0);
  const mesh=meshImplicitFunction(f,{extent:2,resolution:12});
  assert.ok(mesh.faces.length>0);
  assert.ok(mesh.vertices.every(v=>v.length===3&&v.every(Number.isFinite)));
  const sphere=compileImplicitSurface('x^2+y^2+z^2=1');
  const cut=sampleImplicitPlane(sphere,{n:[0,0,1],d:0},{extent:1.5,resolution:40});
  assert.ok(cut.segments.length>12);
  for(const seg of cut.worldSegments.slice(0,20))
    for(const p of [seg.a,seg.b])near(p[2],0);
});

test('geometria: superficie nao quadrática mantém análise como aproximada',()=>{
  const result=parseGeometryInput('superficie: x^3+y^3+z^3=1');
  assert.equal(result.error,undefined);
  assert.ok(result.implicitSurface);
  assert.ok(result.scene3d.some(p=>p.kind==='mesh'));
});

test('operadores de campo, circulação e fluxo respeitam casos conhecidos',()=>{
  const rotation=compileVectorField(['-y','x']);
  const differential=fieldDifferentials(rotation,[.3,.2,0]);
  near(differential.divergence,0);
  near(differential.curl[2],2);
  near(lineIntegralCircle(rotation,{radius:1,steps:180}).value,2*Math.PI,1e-8);
  const vertical=compileVectorField(['0','0','1']);
  near(fluxThroughDisk(vertical,{radius:2}).value,4*Math.PI,1e-5);
  const parsed=parseGeometryInput('campo: -y,x');
  assert.equal(parsed.error,undefined);
  assert.ok(parsed.scene3d.some(item=>item.kind==='arrow'));
});

test('inspetor: planos secantes, paralelos e plano tangente contextual',()=>{
  const plane=(n,d)=>({geometry:{scene3d:[{kind:'plane',n,d,role:'main'}]}});
  const perpendicular=compareSelectedPlanes(plane([0,0,1],0),plane([1,0,0],0));
  near(perpendicular.angle,90);
  const parallel=compareSelectedPlanes(plane([0,0,1],0),plane([0,0,-1],-2));
  assert.equal(parallel.parallel,true);
  near(parallel.separation,2);
  const e={text:'funcao3d: z=x^2-y^2',kind:'geometry',geometry:{
    multivar:{calc:{point:[1,0,1],gradient:[2,0]}},info:['P=(1,0,1)']
  }};
  assert.match(inspectEquation(e).actions[0].command,/^plano: z =/);
});
