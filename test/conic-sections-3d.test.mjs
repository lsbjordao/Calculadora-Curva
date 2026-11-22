import test from 'node:test';
import assert from 'node:assert/strict';
import {classifyConicSection,coneSurface,conePlaneIntersection,makeConicSectionScene} from '../src/space3d/conic-sections.js';
import {parseGeometryInput} from '../src/geometry.js';
import {PRESETS} from '../src/presets.js';
import {scenePrimitives,has3dObjects,autoAxisLimit} from '../src/space3d/view3d.js';
import {prepareThreePrimitives} from '../src/space3d/three-renderer.js';
import {primitivesToPlotlyData} from '../src/space3d/plotly-renderer.js';

const close=(x,y,tol=1e-7)=>assert.ok(Math.abs(x-y)<tol,String(x)+' ≉ '+String(y));
test('a inclinação do plano determina círculo, elipse, parábola e hipérbole',()=>{
  assert.equal(classifyConicSection(0),'circle');
  assert.equal(classifyConicSection(.5),'ellipse');
  assert.equal(classifyConicSection(-.5),'ellipse');
  assert.equal(classifyConicSection(1),'parabola');
  assert.equal(classifyConicSection(-1),'parabola');
  assert.equal(classifyConicSection(1.6),'hyperbola');
  assert.equal(classifyConicSection(-2),'hyperbola');
});
test('interseções são pontos exatos tanto do cone quanto do plano',()=>{
  for(const k of [0,.5,1,1.6,-1.6]){
    const segments=conePlaneIntersection(2,k,{samples:360});
    assert.ok(segments.length>20,'seção k='+k+' deveria aparecer');
    for(const line of segments)for(const [x,y,z] of [line.a,line.b]){
      close(x*x+y*y,z*z);
      close(z,2+k*x);
      assert.ok(Math.abs(z)<=5+1e-9);
    }
    if(Math.abs(k)>1){
      assert.ok(segments.some(s=>s.a[2]>0),'hipérbole inclui ramo superior');
      assert.ok(segments.some(s=>s.a[2]<0),'hipérbole inclui ramo inferior');
    }
  }
});
test('cone usa superfície finita, planos transparentes e curva destacada',()=>{
  const cone=coneSurface();
  assert.equal(cone.kind,'mesh');
  assert.ok(cone.vertices.length>400);
  assert.ok(cone.faces.length>400);
  for(const k of [0,.5,1,1.6]){
    const result=makeConicSectionScene(2,k);
    assert.equal(result.scene[0].kind,'mesh');
    assert.equal(result.scene.filter(p=>p.sectionPlane).length,1);
    assert.ok(result.scene.filter(p=>p.sectionCurve).length>15);
    assert.ok(result.scene.some(p=>p.kind==='label'));
    assert.ok(result.info.join(' ').includes('Interseção:'));
  }
});
test('comandos secao: 2,k integram os três renderizadores via cena 3D',()=>{
  for(const k of [0,.5,1,1.6]){
    const result=parseGeometryInput('secao: 2,k',{params:{k}});
    assert.ok(!result.error,result.error);
    assert.equal(result.dim,3);
    assert.equal(result.type,'section');
    assert.equal(result.section.k,k);
    const eq={kind:'geometry',visible:true,error:false,geometry:result};
    assert.equal(has3dObjects([eq]),true);
    const objects=scenePrimitives([eq],{colorOf:()=> '#000000'});
    assert.ok(objects.some(p=>p.sectionPlane));
    assert.ok(objects.some(p=>p.sectionCurve&&p.color==='#ef4b86'));
    const inThree=prepareThreePrimitives(objects);
    assert.ok(inThree.some(p=>p.kind==='mesh'));
    assert.ok(inThree.some(p=>p.kind==='polygon'&&p.sectionPlane));
    assert.ok(inThree.some(p=>p.kind==='segment'&&p.sectionCurve));
    const inPlotly=primitivesToPlotlyData(objects,{range:5});
    assert.ok(inPlotly.some(trace=>trace.type==='mesh3d'));
    assert.ok(inPlotly.some(trace=>trace.type==='scatter3d'));
    assert.ok(autoAxisLimit([eq])>=5);
  }
  assert.ok(parseGeometryInput('secao: 2,k',{params:{k:Infinity}}).error);
  assert.ok(parseGeometryInput('secao: -2,0').error);
});
test('presets de cônicas 3D são registrados e não confundidos com análise plana',()=>{
  const circle=PRESETS.find(p=>p.id==='cone-sections-3d');
  const hyperbola=PRESETS.find(p=>p.id==='cone-hyperbola-planes-3d');
  assert.ok(circle);
  assert.ok(hyperbola);
  assert.equal(circle.category,'Cônicas e quádricas');
  assert.equal(circle.equations[0].params.k,0);
  assert.equal(hyperbola.equations[0].params.k,1.6);
  assert.equal(hyperbola.equations[0].visible,undefined);
  assert.ok(hyperbola.equations.slice(1).every(e=>e.visible===false));
  assert.equal(PRESETS.find(p=>p.id==='conic-analysis').equations.length,4);
});
