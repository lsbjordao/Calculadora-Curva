import assert from 'node:assert/strict';
import test from 'node:test';

import { addGeometryDefinitions, parseGeometryInput } from '../src/geometry.js';
import { solveinfo } from '../src/linear-algebra.js';
import { buildTransform3DScene } from '../src/space3d/transform3d.js';
import { buildSystemScene3D, systemSceneSummary } from '../src/linear-transform-view.js';
import { scenePrimitives, has3dObjects } from '../src/space3d/view3d.js';

// GB: matriz: 3×3 (cube, image, basis, det as volume factor, eigen-directions of
// symmetric matrices) and solveinfo 3×3 "ver planos" for every classification.

const close=(a,b,tol=1e-9)=>assert.ok(Math.abs(a-b)<=tol,`${a} ≉ ${b}`);
const closeVec=(a,b,tol=1e-9)=>{ assert.equal(a.length,b.length); a.forEach((c,i)=>close(c,b[i],tol)); };
const info=r=>(r?.info||[]).join(' · ');
const ok=r=>{ assert.ok(r,'resultado nulo'); assert.notEqual(r.type,'error',r.error||info(r)); return r; };
const eigenLabels=scene=>scene.filter(p=>p.kind==='label'&&p.eigen).map(p=>p.text);
const cross=(a,b)=>[a[1]*b[2]-a[2]*b[1],a[2]*b[0]-a[0]*b[2],a[0]*b[1]-a[1]*b[0]];

// ── matriz: 3×3 ───────────────────────────────────────────────────────────

test('matriz: 3×3 draws the unit cube (dashed), its image, e1..e3 and their images', ()=>{
  const r=ok(parseGeometryInput('matriz: [2,0,0; 0,1,0; 0,0,1]'));
  assert.equal(r.type,'matrix');
  assert.equal(r.dim,3);
  assert.equal(r.matrix.size,3);
  assert.deepEqual(r.matrix.values,[[2,0,0],[0,1,0],[0,0,1]]);
  const s=r.scene3d;
  assert.equal(s.filter(p=>p.kind==='segment'&&p.dash&&p.role==='aux'&&!p.eigen).length,12,'cubo unitário tracejado');
  const mesh=s.find(p=>p.kind==='mesh');
  assert.ok(mesh.vertices.some(v=>v[0]===2&&v[1]===1&&v[2]===1),'(1,1,1) ↦ (2,1,1)');
  const arrows=s.filter(p=>p.kind==='arrow');
  assert.deepEqual(arrows.filter(a=>a.role==='aux').map(a=>a.label),['e1','e2','e3']);
  assert.deepEqual(arrows.filter(a=>a.role!=='aux').map(a=>a.to),[[2,0,0],[0,1,0],[0,0,1]]);
  assert.match(info(r),/det = 2 \(fator de volume\)/);
  assert.match(info(r),/A\(t\) = \(1−t\)I \+ tA/);
});

test('matriz: 3×3 notes det < 0 (orientation) and det = 0 (collapse onto plane, line, point)', ()=>{
  assert.match(info(ok(parseGeometryInput('matriz: [-1,0,0; 0,1,0; 0,0,1]'))),/orientação invertida/);
  const plane=ok(parseGeometryInput('matriz: [1,2,3; 4,5,6; 7,8,9]'));
  assert.match(info(plane),/det = 0 \(fator de volume\)/);
  assert.match(info(plane),/colapsa num plano/);
  assert.match(info(ok(parseGeometryInput('matriz: [1,2,3; 2,4,6; 3,6,9]'))),/colapsa numa reta/);
  assert.match(info(ok(parseGeometryInput('matriz: [0,0,0; 0,0,0; 0,0,0]'))),/colapsa num ponto/);
  // Singularity follows the rank (scale-aware), not an absolute det threshold.
  const big=ok(parseGeometryInput('matriz: [1000000,0,0; 0,1000000,0; 0,0,0.000001]'));
  // det = 1e6·1e6·1e-6 = 1e6 (the old absolute threshold called it 0).
  close(big.matrix.det,1e6,1e-6);
  assert.match(info(big),/det = 1e\+6 \(fator de volume\)|det = 1000000 \(fator de volume\)/);
  assert.doesNotMatch(info(big),/colapsa/);
  const tiny=ok(parseGeometryInput('matriz: [0.000000001,0,0; 0,0.000000001,0; 0,0,0.000000001]'));
  assert.equal(tiny.matrix.rank,3);
  assert.doesNotMatch(info(tiny),/colapsa/);
  close(tiny.matrix.det,1e-27,1e-40);
  // One det line only.
  assert.equal(plane.info.filter(x=>/^det/.test(x)).length,1);
  // A slider can make it singular in the middle of a drag: no exception.
  assert.match(info(ok(parseGeometryInput('matriz: [k,0,0; 0,1,0; 0,0,1]',{params:{k:0}}))),/colapsa num plano/);
});

test('symmetric 3×3: three eigen-directions (aux) labelled λ = 1, 3, 3; non-symmetric: none', ()=>{
  const r=ok(parseGeometryInput('matriz: [2,1,0; 1,2,0; 0,0,3]'));
  assert.deepEqual(eigenLabels(r.scene3d),['λ = 1','λ = 3','λ = 3']);
  const dirs=r.scene3d.filter(p=>p.kind==='segment'&&p.eigen);
  assert.equal(dirs.length,3);
  assert.ok(dirs.every(p=>p.role==='aux'));
  // Each direction is an eigenvector: A v ∥ v.
  const A=[[2,1,0],[1,2,0],[0,0,3]];
  for(const d of dirs){
    const v=d.b.map((x,i)=>x-d.a[i]);
    const Av=A.map(row=>row.reduce((s,x,i)=>s+x*v[i],0));
    closeVec(cross(Av,v),[0,0,0],1e-9);
  }
  assert.match(info(r),/autovalores = 1, 3, 3/);
  const n=ok(parseGeometryInput('matriz: [1,2,0; 0,1,0; 0,0,1]'));
  assert.deepEqual(eigenLabels(n.scene3d),[]);
  assert.match(info(n),/só para matrizes 3×3 simétricas/);
});

test('the calc: transformation view gets e1..e3 and the eigen-directions; old defaults stay', ()=>{
  const A=[[2,1,0],[1,2,0],[0,0,3]];
  const full=buildTransform3DScene(A,{showEigen:true,showUnitBasis:true}).scene;
  assert.deepEqual(eigenLabels(full),['λ = 1','λ = 3','λ = 3']);
  assert.deepEqual(full.filter(p=>p.kind==='arrow'&&p.role==='aux').map(p=>p.label),['e1','e2','e3']);
  // Eigen-directions do not move during A(t): A(t) has the same eigenvectors.
  const half=buildTransform3DScene(A,{t:.5,showEigen:true}).scene.filter(p=>p.eigen&&p.kind==='segment');
  assert.deepEqual(half.map(p=>p.b),full.filter(p=>p.eigen&&p.kind==='segment').map(p=>p.b));
  const plain=buildTransform3DScene(A).scene;
  assert.equal(plain.filter(p=>p.eigen).length,0);
  assert.equal(plain.filter(p=>p.kind==='arrow').length,3);
});

test('matriz: 2×2 is unchanged; other sizes give a Portuguese error; named 3×3 matrices register', ()=>{
  const r=ok(parseGeometryInput('matriz: [1,0.5; 0,1]'));
  assert.equal(r.dim,undefined);
  assert.equal(r.label,'matriz 2x2');
  assert.equal(parseGeometryInput('matriz: [1,2,3; 4,5,6]').error,'matriz 2x2 ou 3x3 esperada');
  const registry=new Map();
  const M=ok(parseGeometryInput('M = matriz([1,0,0; 0,2,0; 0,0,3])',{registry}));
  addGeometryDefinitions(registry,M);
  assert.equal(registry.get('M').kind,'matrix');
  assert.match(info(ok(parseGeometryInput('matriz: M',{registry}))),/det = 6/);
});

test('a matriz: 3×3 row draws its animated scene (transformScene3d) when the controls run', ()=>{
  const g=ok(parseGeometryInput('matriz: [2,0,0; 0,1,0; 0,0,1]'));
  const eq={kind:'geometry',visible:true,error:false,geometry:g,text:'matriz: [2,0,0; 0,1,0; 0,0,1]'};
  assert.ok(has3dObjects([eq]));
  const still=scenePrimitives([eq]);
  assert.equal(still.filter(p=>p.kind==='mesh').length,1);
  const moving=buildTransform3DScene(g.matrix.values,{t:0}).scene;
  const prims=scenePrimitives([{...eq,transformScene3d:moving}]);
  assert.deepEqual(prims.find(p=>p.kind==='mesh').vertices[7],[1,1,1],'t = 0: identidade');
});

// ── solveinfo 3×3: ver planos ─────────────────────────────────────────────

const sceneOf=(A,b)=>{
  const result=solveinfo(A,b);
  const solution=result.metadata.classification==='unique' ? result.value : null;
  return {scene:buildSystemScene3D(A,b,solution,result), result};
};

test('infinitely many solutions, rank 2: the solution line', ()=>{
  const {scene,result}=sceneOf([[1,1,1],[2,2,2],[1,-1,0]],[1,2,0]);
  const line=scene.find(p=>p.kind==='line'&&p.systemSolution);
  assert.ok(line,'reta solução');
  const v=line.v, n=Math.hypot(...v);
  closeVec(cross(v.map(x=>x/n),[1,1,-2].map(x=>x/Math.sqrt(6))),[0,0,0],1e-9);
  // (½, ½, 0) lies on the line.
  const w=[.5-line.p[0],.5-line.p[1],0-line.p[2]];
  closeVec(cross(w,v),[0,0,0],1e-9);
  assert.equal(scene.filter(p=>p.kind==='point').length,0);
  assert.match(systemSceneSummary(result,[[1,1,1],[2,2,2],[1,-1,0]],[1,2,0]),/infinitas soluções: reta/);
});

test('three coincident planes: one highlighted plane', ()=>{
  const {scene,result}=sceneOf([[1,1,1],[2,2,2],[3,3,3]],[1,2,3]);
  const planes=scene.filter(p=>p.kind==='plane');
  assert.equal(planes.length,1);
  assert.ok(planes[0].systemSolution,'plano destacado');
  assert.match(systemSceneSummary(result),/os três planos coincidem/);
});

test('unique solution keeps the point; inconsistent: no solution object, "sem solução"', ()=>{
  const u=sceneOf([[1,1,1],[1,-1,0],[0,0,1]],[6,0,2]);
  closeVec(u.scene.find(p=>p.kind==='point').p,[2,2,2],1e-9);
  assert.equal(u.scene.filter(p=>p.kind==='plane').length,3);
  assert.match(systemSceneSummary(u.result),/solução única/);
  const none=sceneOf([[1,1,1],[1,1,1],[1,-1,0]],[1,2,0]);
  assert.equal(none.scene.filter(p=>p.kind==='plane').length,3);
  assert.equal(none.scene.filter(p=>p.systemSolution).length,0);
  assert.match(systemSceneSummary(none.result),/sem solução/);
  // The three-argument call of main still works (no classification → planes + point).
  assert.equal(buildSystemScene3D([[1,0,0],[0,1,0],[0,0,1]],[2,3,4],[2,3,4]).filter(p=>p.kind==='point').length,1);
});
