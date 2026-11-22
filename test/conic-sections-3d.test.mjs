import test from 'node:test';
import assert from 'node:assert/strict';
import {classifyConicSection,coneSurface,conePlaneIntersection,makeConicSectionScene} from '../src/space3d/conic-sections.js';
import {parseGeometryInput} from '../src/geometry.js';
import {PRESETS} from '../src/presets.js';
import {LESSONS,lessonCheckpoints} from '../src/lessons.js';
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

test('aula Cônicas e quádricas apresenta as quatro seções do cone no 3D',()=>{
  const lesson=LESSONS.find(x=>x.id==='conic-sections-3d');
  assert.ok(lesson);
  assert.equal(lesson.steps.length,4);
  assert.equal(lesson.steps[0].title,'Seções do cone e circunferência');
  assert.deepEqual(lesson.steps.map(step=>step.scene.equations[0].params.k),[0,.5,1,1.6]);
  for(const step of lesson.steps){
    const entry=step.scene.equations[0];
    const r=parseGeometryInput(entry.text,{params:entry.params});
    assert.equal(r.dim,3);
    assert.ok(!r.error);
    const checkpoints=lessonCheckpoints(step);
    assert.ok(checkpoints.length>=2);
    assert.equal(checkpoints.at(-1).check.type,'ack');
  }
});

test('controles h,a,d,p transformam a seção preservando cone e plano',()=>{
  const settings=[
    {h:.8,k:0,aperture:1,vertexZ:0,azimuth:0},
    {h:2.5,k:.35,aperture:1.4,vertexZ:1.5,azimuth:.7},
    {h:3.5,k:1.6,aperture:1.2,vertexZ:-1.3,azimuth:-.5}
  ];
  for(const c of settings){
    const {h,k,...options}=c;
    const sections=conePlaneIntersection(h,k,{...options,halfHeight:Math.max(5,2.6*h)});
    assert.ok(sections.length>25,'geometria com controles deve existir');
    for(const line of sections)for(const [x,y,z] of [line.a,line.b]){
      close(x*x+y*y,c.aperture*c.aperture*(z-c.vertexZ)**2,1e-6);
      close(z,c.vertexZ+c.h+c.k*(x*Math.cos(c.azimuth)+y*Math.sin(c.azimuth)),1e-6);
    }
    const scene=makeConicSectionScene(h,k,options);
    assert.ok(scene.scene.some(s=>s.kind==='point'&&s.p[2]===c.vertexZ));
    assert.ok(scene.count>25);
  }
});
test('a classificação depende da abertura e da inclinação, não só de k',()=>{
  assert.equal(classifyConicSection(.5,1),'ellipse');
  assert.equal(classifyConicSection(.5,2),'parabola');
  assert.equal(classifyConicSection(.5,2.4),'hyperbola');
  assert.equal(classifyConicSection(0,2.4),'circle');
  assert.throws(()=>classifyConicSection(.5,0),/abertura/);
});
test('novo comando secao h,k,a,d,p funciona nos três renderizadores',()=>{
  const state={h:2.7,k:.5,a:2,d:1.2,p:1.1};
  const obj=parseGeometryInput('secao: h,k,a,d,p',{params:state});
  assert.ok(!obj.error,String(obj.error));
  assert.equal(obj.section.kind,'parabola');
  assert.equal(obj.section.h,2.7);
  assert.equal(obj.section.aperture,2);
  assert.equal(obj.section.vertexZ,1.2);
  assert.equal(obj.section.azimuth,1.1);
  const eq={kind:'geometry',visible:true,error:false,geometry:obj};
  const primitives=scenePrimitives([eq]);
  assert.ok(prepareThreePrimitives(primitives).some(x=>x.kind==='mesh'));
  assert.ok(primitivesToPlotlyData(primitives,{range:10}).some(t=>t.type==='mesh3d'));
  assert.ok(autoAxisLimit([eq])>5);
  assert.ok(parseGeometryInput('secao: 2,.5').section.kind==='ellipse');
  assert.ok(parseGeometryInput('secao: 2,.5,2').section.kind==='parabola');
  assert.ok(parseGeometryInput('secao: 2,.5,2,1.5').section.vertexZ===1.5);
  assert.ok(parseGeometryInput('secao: 2,.5,2,1.5,.6').section.azimuth===.6);
  assert.ok(parseGeometryInput('secao: 0,.5').error);
  assert.ok(parseGeometryInput('secao: 2,.5,0').error);
});
test('presets de seções do cone expõem os cinco controles com valores coerentes',()=>{
  for(const id of ['cone-sections-3d','cone-hyperbola-planes-3d']){
    const preset=PRESETS.find(x=>x.id===id);
    for(const entry of preset.equations){
      assert.equal(entry.text,'secao: h,k,a,d,p');
      assert.deepEqual(Object.keys(entry.params),['h','k','a','d','p']);
      const result=parseGeometryInput(entry.text,{params:entry.params});
      assert.ok(!result.error,String(result.error));
    }
  }
});
