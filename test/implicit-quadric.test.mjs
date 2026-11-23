import test from 'node:test';
import assert from 'node:assert/strict';
import {generalQuadricFromEquation,evaluateQuadric,analyseGeneralQuadric,
 diagonalizeSymmetric3,meshImplicitQuadric,intersectGeneralQuadricPlane,
 clipTriangleMesh,quadricGradient,quadricHessian} from '../src/space3d/implicit-quadric.js';
const near=(a,b,t=1e-8)=>assert.ok(Math.abs(a-b)<t,`${a} != ${b}`);
const cases=[
 ['x²+2xy+3y²+z²=9','Elipsoide'],
 ['x²+y²-z²=1','Hiperboloide de uma folha'],
 ['z²-x²-y²=1','Hiperboloide de duas folhas'],
 ['x²+y²-z²=0','Cone quadrático'],
 ['z=x²+y²','Paraboloide elíptico'],
 ['z=x²-y²','Paraboloide hiperbólico (sela)'],
 ['x²+y²=4','Cilindro elíptico'],
 ['x²-y²=1','Cilindro hiperbólico'],
 ['x²=y','Cilindro parabólico'],
 ['x²+y²+z²=-1','Sem pontos reais'],
 ['x²+y²+z²=0','Ponto isolado'],
 ['x²=1','Dois planos paralelos']
];
for(const [expr,type] of cases)test('general quadric '+expr+' => '+type,()=>{
  const poly=generalQuadricFromEquation(expr);
  assert.equal(analyseGeneralQuadric(poly).type,type);
  const computed=evaluateQuadric(poly,[.5,1.2,2]);
  assert.ok(Number.isFinite(computed));
});
test('eigenvectors diagonalize the original real symmetric matrix',()=>{
  const q=generalQuadricFromEquation('x²+2xy+3y²+z²=9');
  const eigen=diagonalizeSymmetric3(q.matrix);
  for(const {vector,value} of eigen){
    const Av=q.matrix.map(row=>row.reduce((s,x,i)=>s+x*vector[i],0));
    for(let i=0;i<3;i++)near(Av[i],vector[i]*value);
  }
});
test('plane x+y+z=2 intersects the rotated ellipsoid in an exact conic',()=>{
  const poly=generalQuadricFromEquation('x²+2xy+3y²+z²=9');
  const intersection=intersectGeneralQuadricPlane(poly,{n:[1,1,1],d:2});
  assert.equal(intersection.type,'ellipse');
  assert.ok(intersection.worldSegments.length>30);
  for(const seg of intersection.worldSegments.slice(0,30)){
    for(const p of [seg.a,seg.b]){
      near(p.reduce((a,b)=>a+b,0),2,1e-7);
      assert.ok(Math.abs(evaluateQuadric(poly,p))<1e-2);
    }
  }
});
test('general quadric mesh has a real 3D triangle surface',()=>{
  const q=generalQuadricFromEquation('x²+y²+z²=4');
  const mesh=meshImplicitQuadric(q,{extent:3,resolution:14});
  assert.ok(mesh.faces.length>50);
  assert.equal(mesh.vertices.length,mesh.faces.length*3);
  assert.ok(mesh.vertices.every(v=>v.every(Number.isFinite)));
  const clipped=clipTriangleMesh(mesh,{n:[0,0,1],d:0},1);
  assert.ok(clipped.faces.length>0&&clipped.faces.length<mesh.faces.length*2);
  assert.ok(clipped.vertices.every(v=>v[2]>=-1e-7));
  for(const p of mesh.vertices.slice(0,35))assert.ok(Math.abs(evaluateQuadric(q,p))<.2);
});
test('linear and mixed coefficients map to exact gradient and Hessian',()=>{
  const q=generalQuadricFromEquation('x²+2xy+3y²+z²+4z=9');
  assert.deepEqual(quadricGradient(q,[1,2,3]),[6,14,10]);
  assert.deepEqual(quadricHessian(q),[[2,2,0],[2,6,0],[0,0,2]]);
});
test('higher order expression is rejected, not mislabeled as a quadric',()=>{
  assert.throws(()=>generalQuadricFromEquation('x^3+y^2+z^2=4'),/quadrática/);
  assert.throws(()=>generalQuadricFromEquation('sin(x)+y^2+z^2=4'),/quadrática/);
  assert.throws(()=>generalQuadricFromEquation('x^2+y^2+z^2'),/equação/);
});
