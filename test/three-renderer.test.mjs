import test from 'node:test';
import assert from 'node:assert/strict';
import {prepareThreePrimitives,THREE_MODULE_URL} from '../src/space3d/three-renderer.js';
import {buildSystemScene3D} from '../src/linear-transform-view.js';
import {scenePrimitives} from '../src/space3d/view3d.js';
import {readFileSync} from 'node:fs';

const box={min:[-5,-5,-5],max:[5,5,5]};
test('Three.js: módulo remoto com versão fixada, carregado apenas sob demanda',()=>{
  assert.match(THREE_MODULE_URL,/^https:\/\/cdn\.jsdelivr\.net\/npm\/three@0\.187\.0\/build\/three\.module\.js$/);
  const source=readFileSync(new URL('../src/space3d/three-renderer.js',import.meta.url),'utf8');
  assert.match(source,/import\(THREE_MODULE_URL\)/);
  assert.doesNotMatch(source,/^import .*https:\/\/cdn/m);
});
test('Three.js: os três planos de solveinfo ficam distintos e são recortados',()=>{
  const system=buildSystemScene3D([[1,1,1],[2,-1,1],[1,2,-1]],[6,3,2],[1,2,3]);
  const eq={kind:'result',visible:true,error:false,showAlgebraSystem:true,systemScene3d:system};
  const data=scenePrimitives([eq],{colorOf:()=> '#000000',box});
  const prepared=prepareThreePrimitives(data,box);
  const polygons=prepared.filter(item=>item.kind==='polygon'&&item.plane);
  assert.equal(polygons.length,3);
  assert.equal(new Set(polygons.map(item=>item.color)).size,3);
  for(const poly of polygons){
    assert.ok(poly.points.length>=3);
    assert.ok(poly.points.every(p=>p.every((v,i)=>v>=box.min[i]-1e-9&&v<=box.max[i]+1e-9)));
    assert.ok(poly.alpha>0&&poly.alpha<1);
  }
  const point=prepared.find(item=>item.kind==='point'&&item.systemSolution);
  assert.deepEqual(point.p,[1,2,3]);
  assert.notEqual(point.color,polygons[0].color);
});
test('Three.js: linhas infinitas são recortadas e a grade não mostra rótulos de ticks',()=>{
  const data=[
    {kind:'line',p:[0,0,0],v:[1,0,0],label:'reta'},
    {kind:'plane',n:[0,0,1],d:0,color:'#f00'},
    {kind:'label',p:[1,0,0],text:'1',role:'tick'},
    {kind:'segment',a:[0,0,0],b:[1,0,0],role:'tick'},
    {kind:'label',p:[5,0,0],text:'x',role:'axis'},
    {kind:'point',p:[0,0,0],label:'O'}
  ];
  const out=prepareThreePrimitives(data,box);
  assert.equal(out.filter(x=>x.kind==='polygon').length,1);
  const line=out.find(x=>x.kind==='segment');
  assert.ok(line);
  assert.deepEqual(line.a,[-5,0,0]);
  assert.deepEqual(line.b,[5,0,0]);
  assert.equal(out.filter(x=>x.kind==='label').length,1);
  assert.equal(out.find(x=>x.kind==='label').text,'x');
  assert.deepEqual(out.find(x=>x.kind==='point').p,[0,0,0]);
});
test('Three.js: seletor e controles coexistem com Plotly e Canvas',()=>{
  const html=readFileSync(new URL('../index.html',import.meta.url),'utf8');
  const manager=readFileSync(new URL('../src/space3d/library-manager.js',import.meta.url),'utf8');
  assert.match(html,/<option value="threejs">Three\.js \(WebGL\)<\/option>/);
  assert.match(html,/id="three-3d-container"/);
  assert.match(html,/id="plotly-3d-container"/);
  assert.match(manager,/if \(currentLibrary === 'threejs'\) return renderThree3D/);
  assert.match(manager,/if \(currentLibrary === 'threejs'\) resizeThree3D/);
});
