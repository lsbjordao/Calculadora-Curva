import assert from 'node:assert/strict';
import test from 'node:test';
import { readFileSync } from 'node:fs';

import { addGeometryDefinitions, parseGeometryInput } from '../src/geometry.js';
import { toVec3, involves3d, parse3dCommand } from '../src/space3d/geometry3d.js';
import { runGeometry2dCases } from './fixtures/geometry-2d-cases.mjs';

const close=(a,b,tol=1e-9)=>assert.ok(Math.abs(a-b)<=tol,`${a} ≉ ${b}`);
const closeVec=(a,b)=>{ assert.equal(a.length,b.length); a.forEach((c,i)=>close(c,b[i])); };
const prims=(r,kind)=>(r.scene3d||[]).filter(p=>p.kind===kind);

function registryWith(...lines){
  const registry=new Map();
  for(const line of lines) addGeometryDefinitions(registry,parseGeometryInput(line,{registry}));
  return registry;
}

test('ponto: A=(1,2,3) is a 3D point with one scene point', ()=>{
  const r=parseGeometryInput('ponto: A=(1,2,3)');
  assert.equal(r.type,'point');
  assert.equal(r.dim,3);
  assert.deepEqual(r.points.map(p=>[p.x,p.y,p.z,p.label,p.dim]),[[1,2,3,'A',3]]);
  const pts=prims(r,'point');
  assert.equal(pts.length,1);
  assert.deepEqual(pts[0].p,[1,2,3]);
  assert.equal(pts[0].label,'A');
  assert.equal(r.definitions[0].name,'A');
  assert.equal(r.definitions[0].value.dim,3);
  assert.ok(r.info.includes('A = (1, 2, 3)'));
});

test('A = (1,2,3) and A = ponto(1,2,3) define the same 3D point', ()=>{
  for(const text of ['A = (1,2,3)','A = ponto(1,2,3)']){
    const r=parseGeometryInput(text);
    assert.equal(r.type,'point',text);
    assert.equal(r.dim,3);
    assert.equal(r.definitionName,'A');
    assert.deepEqual(prims(r,'point')[0].p,[1,2,3]);
    assert.ok(r.definitions.every(d=>d.name==='A'&&d.kind==='point'&&d.value.dim===3));
  }
  const several=parseGeometryInput('ponto: A=(1,2,3), B=(0,1,-1)');
  assert.deepEqual(prims(several,'point').map(p=>[p.label,...p.p]),[['A',1,2,3],['B',0,1,-1]]);
});

test('vetor: u=(1,2,3) draws an arrow from the origin and reports the norm', ()=>{
  const r=parseGeometryInput('vetor: u=(1,2,3)');
  assert.equal(r.type,'vector');
  assert.equal(r.dim,3);
  const arrows=prims(r,'arrow');
  assert.equal(arrows.length,1);
  assert.deepEqual(arrows[0].from,[0,0,0]);
  assert.deepEqual(arrows[0].to,[1,2,3]);
  assert.equal(arrows[0].label,'u');
  assert.ok(r.info.includes('vetor u = (1, 2, 3)'));
  assert.ok(r.info.includes('|u| = 3.74166'));
  // A named 3D vector is registered so later lines can refer to it.
  const u=r.definitions.find(d=>d.name==='u');
  assert.equal(u.kind,'vector');
  assert.equal(u.value.dim,3);

  const two=parseGeometryInput('vetor: (0,0,0),(1,2,3)');
  assert.deepEqual(prims(two,'arrow').map(a=>[a.from,a.to]),[[[0,0,0],[1,2,3]]]);
  const def=parseGeometryInput('v = vetor((1,1,1),(2,3,4))');
  assert.equal(def.definitions.at(-1).name,'v');
  assert.deepEqual(prims(def,'arrow')[0].to,[2,3,4]);
  assert.ok(def.info.includes('vetor v = (1, 2, 3)'));
});

test('vetor: A, B mixes a 3D and a 2D point by promoting the 2D one to z = 0', ()=>{
  const registry=registryWith('ponto: A=(1,0,0)','ponto: B=(0,1)');
  assert.equal(registry.get('A').value.dim,3);
  assert.equal(registry.get('B').value.dim,2);
  const r=parseGeometryInput('vetor: A, B',{registry});
  assert.equal(r.type,'vector');
  assert.equal(r.dim,3);
  const arrow=prims(r,'arrow')[0];
  assert.deepEqual(arrow.from,[1,0,0]);
  assert.deepEqual(arrow.to,[0,1,0]);
  assert.equal(arrow.label,'AB');
  assert.ok(r.info.some(line=>line.includes('B')&&line.includes('z = 0')),r.info.join(' | '));
  assert.deepEqual(prims(r,'point').map(p=>p.label),['A','B']);
});

test('mixed literal lengths are promoted with a warning', ()=>{
  const r=parseGeometryInput('ponto: A=(1,2), B=(3,4,5)');
  assert.equal(r.dim,3);
  assert.deepEqual(prims(r,'point').map(p=>p.p),[[1,2,0],[3,4,5]]);
  assert.ok(r.info.some(line=>line.startsWith('aviso')&&line.includes('A')&&line.includes('z = 0')));
});

test('a line referring to a 3D name becomes 3D', ()=>{
  const registry=registryWith('A = (1,2,3)');
  const r=parseGeometryInput('ponto: C=A',{registry});
  assert.equal(r.dim,3);
  assert.deepEqual(prims(r,'point')[0].p,[1,2,3]);
  assert.equal(prims(r,'point')[0].label,'C');
  assert.equal(involves3d('A',{registry}),true);
  assert.equal(involves3d('(1,2)',{registry}),false);
  assert.equal(involves3d('(max(1,2,3), 0)',{}),false,'a three-argument call is not a 3D literal');
  assert.equal(involves3d('B=(a,b,c)',{}),true);
});

test('parameters work in 3D coordinates', ()=>{
  const r=parseGeometryInput('ponto: A=(k,0,1)',{params:{k:2}});
  assert.deepEqual(prims(r,'point')[0].p,[2,0,1]);
  const zero=parseGeometryInput('vetor: u=(k,0,0)',{params:{k:0}});
  assert.notEqual(zero.type,'error');
  assert.equal(prims(zero,'arrow').length,0,'a null vector is not drawn');
  assert.ok(zero.info.some(line=>line.includes('vetor nulo')));
});

test('bad coordinate counts and unsupported 3D commands report Portuguese errors', ()=>{
  const four=parseGeometryInput('ponto: A=(1,2,3,4)');
  assert.equal(four.type,'error');
  assert.ok(four.error.includes('ponto precisa de duas ou três coordenadas'));
  const one=parseGeometryInput('ponto: A=(1)');
  assert.equal(one.type,'error');
  const notYet=parseGeometryInput('triangulo: (0,0,0),(1,0,0),(0,1,0)');
  assert.equal(notYet.type,'error');
  assert.ok(/3D/.test(notYet.error),notYet.error);
  assert.equal(parse3dCommand('triangle','(0,0,0),(1,0,0),(0,1,0)',{},''),null);
});

test('toVec3 promotes 2D points to z = 0', ()=>{
  assert.deepEqual(toVec3({x:1,y:2}),[1,2,0]);
  assert.deepEqual(toVec3({x:1,y:2,z:3,dim:3}),[1,2,3]);
  assert.deepEqual(toVec3([4,5]),[4,5,0]);
  assert.deepEqual(toVec3([4,5,6]),[4,5,6]);
});

test('ponto: A=(1,2) stays 2D: dim 2, no scene3d, same points and info', ()=>{
  const r=parseGeometryInput('ponto: A=(1,2)');
  assert.equal(r.type,'point');
  assert.equal('scene3d' in r,false);
  assert.equal('dim' in r,false);
  assert.deepEqual(r.points,[{x:1,y:2,label:'A',dim:2}]);
  assert.deepEqual(r.info,['A = (1, 2)']);
});

// The only change allowed on 2D lines is the `dim: 2` tag on their points.
test('2D geometry results match the snapshot taken before ℝ³ support', ()=>{
  const expected=JSON.parse(readFileSync(new URL('./fixtures/geometry-2d-snapshot.json',import.meta.url),'utf8'));
  let tagged=0;
  const strip=(key,value)=>{
    if(key==='dim'){ assert.equal(value,2,'2D points are tagged dim 2'); tagged++; return undefined; }
    return value;
  };
  const actual=JSON.parse(JSON.stringify(runGeometry2dCases(),strip));
  assert.equal(actual.length,expected.length);
  actual.forEach((item,i)=>{
    if(item.text==='conica: x*y = 1'){
      // The rotated conic was deliberately enriched with foci and principal
      // axes; keep the pre-3D snapshot strict for all unchanged geometries.
      assert.equal(item.result.type,'conic');
      assert.ok(item.result.conics[0].analysis.info.includes('cônica rotacionada'));
      assert.ok(item.result.conics[0].analysis.foci===undefined);
      assert.ok(item.result.points.some(p=>p.label==='F1'));
    }else assert.deepEqual(item,expected[i],item.text);
  });
  assert.ok(tagged>0);
});
