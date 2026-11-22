import test from 'node:test';
import assert from 'node:assert/strict';
import {classifyAngledConicSection,conePlaneIntersectionAngle,makeAngledConicSectionScene} from '../src/space3d/conic-sections.js';
import {parseGeometryInput,extractGeometryParams} from '../src/geometry.js';
import {PRESETS} from '../src/presets.js';
import {scenePrimitives} from '../src/space3d/view3d.js';
import {prepareThreePrimitives} from '../src/space3d/three-renderer.js';
import {primitivesToPlotlyData} from '../src/space3d/plotly-renderer.js';

const near=(x,y,eps=1e-7)=>assert.ok(Math.abs(x-y)<eps,String(x)+' ≠ '+y);

test('seção angular inclui ambas as posições verticais exatas',()=>{
  for(const angle of [-90,90]){
    const h=2,aperture=1.3,vertexZ=1.1,azimuth=.4,offset=.75;
    const segments=conePlaneIntersectionAngle(h,angle,{aperture,vertexZ,azimuth,offset,halfHeight:7,samples:480});
    assert.ok(segments.length>35,'A seção vertical deve permanecer visível');
    assert.ok(segments.some(s=>s.a[2]>vertexZ),'Ramo no cone superior');
    assert.ok(segments.some(s=>s.a[2]<vertexZ),'Ramo no cone inferior');
    for(const segment of segments)for(const [x,y,z] of [segment.a,segment.b]){
      near(x*x+y*y,aperture**2*(z-vertexZ)**2,1e-6);
      const u=x*Math.cos(azimuth)+y*Math.sin(azimuth);
      near(u,angle===90?-offset:offset,1e-6);
    }
    const scene=makeAngledConicSectionScene(h,angle,{aperture,vertexZ,azimuth,offset});
    assert.equal(scene.type,'hyperbola');
    const poly=scene.scene.find(p=>p.sectionPlane);
    assert.ok(poly?.points.length>=3);
    assert.ok(poly.points.every(p=>Math.abs(p[0]*Math.cos(azimuth)+p[1]*Math.sin(azimuth)-(angle===90?-offset:offset))<1e-7));
    assert.match(scene.info.join(' '),/vertical/);
  }
});
test('rotação contínua entre circunferência, elipse, parábola, hipérbole e vertical',()=>{
  const samples=[[0,'circle'],[26,'ellipse'],[45,'parabola'],[58,'hyperbola'],[89,'hyperbola'],[90,'hyperbola'],
    [-26,'ellipse'],[-45,'parabola'],[-58,'hyperbola'],[-90,'hyperbola']];
  for(const [angle,type] of samples){
    assert.equal(classifyAngledConicSection(angle),type);
    const scene=makeAngledConicSectionScene(2,angle,{offset:.75});
    assert.equal(scene.type,type);
    assert.ok(scene.count>10,'Curva visível em '+angle+'°');
  }
  assert.equal(classifyAngledConicSection(30,Math.sqrt(3)),'parabola');
  assert.throws(()=>classifyAngledConicSection(91),/90/);
  assert.equal(makeAngledConicSectionScene(2,90,{offset:0}).type,'two-lines');
});
test('comando angular com parâmetro q mantém compatibilidade com comando clássico k',()=>{
  const expr='secao: h,angulo(q),a,d,p,b';
  assert.deepEqual(extractGeometryParams(expr),['h','q','a','d','p','b']);
  const params={h:2,q:90,a:1.3,d:.4,p:.2,b:.75};
  const obj=parseGeometryInput(expr,{params});
  assert.ok(!obj.error,String(obj.error));
  assert.equal(obj.dim,3);
  assert.equal(obj.section.kind,'hyperbola');
  assert.equal(obj.section.angle,90);
  assert.equal(obj.section.offset,.75);
  const eq={kind:'geometry',visible:true,error:false,geometry:obj};
  const prim=scenePrimitives([eq],{colorOf:()=> '#000000'});
  assert.ok(prepareThreePrimitives(prim).some(p=>p.kind==='polygon'&&p.sectionPlane));
  assert.ok(primitivesToPlotlyData(prim,{range:9}).some(p=>p.type==='mesh3d'));
  const legacy=parseGeometryInput('secao: 2,1.6');
  assert.equal(legacy.section.kind,'hyperbola');
  assert.equal(legacy.section.k,1.6);
  assert.ok(parseGeometryInput('secao: h,angulo(q),a,d,p,b',{params:{...params,q:91}}).error);
});
test('presets 3D apresentam inclinação angular e afastamento horizontal',()=>{
  const all=PRESETS.filter(p=>['cone-sections-3d','cone-hyperbola-planes-3d'].includes(p.id));
  assert.equal(all.length,2);
  for(const preset of all)for(const entry of preset.equations){
    assert.equal(entry.text,'secao: h,angulo(q),a,d,p,b');
    assert.ok(entry.params.q>=-90&&entry.params.q<=90);
    assert.ok(entry.params.b>0);
    const g=parseGeometryInput(entry.text,{params:entry.params});
    assert.ok(!g.error,String(g.error));
  }
});


test('b percorre os lados do eixo X e atravessa exatamente x=0 com q=90°',()=>{
  const h=2, a=1.1;
  for(const b of [-3,-1,0,1,3]){
    const section=makeAngledConicSectionScene(h,90,{aperture:a,offset:b});
    assert.ok(section.count>0,'Seção deve existir para b='+b);
    const plane=section.scene.find(p=>p.sectionPlane);
    assert.ok(plane,'Plano deve permanecer visível');
    assert.ok(plane.points.every(p=>Math.abs(p[0]+b)<1e-7));
    const curve=section.scene.filter(p=>p.sectionCurve);
    assert.ok(curve.length>0);
    for(const segment of curve)for(const point of [segment.a,segment.b]){
      const [x,y,z]=point;
      near(x,-b,1e-7);
      near(x*x+y*y,a*a*z*z,1e-6);
    }
    const obj=parseGeometryInput('secao: h,angulo(q),a,d,p,b',
      {params:{h,q:90,a,d:0,p:0,b}});
    assert.ok(!obj.error,String(obj.error));
    assert.equal(obj.section.offset,b);
    assert.equal(obj.section.kind,b===0?'two-lines':'hyperbola');
    const eq={kind:'geometry',visible:true,error:false,geometry:obj};
    const primitives=scenePrimitives([eq],{colorOf:()=> '#000'});
    assert.ok(prepareThreePrimitives(primitives).some(p=>p.sectionCurve));
    assert.ok(primitivesToPlotlyData(primitives,{range:8}).some(p=>p.type==='scatter3d'));
  }
});
test('b=0 em q=±90° produz duas geratrizes concorrentes pelo vértice',()=>{
  for(const q of [-90,90]){
    const scene=makeAngledConicSectionScene(2,q,{vertexZ:1.4,azimuth:.6,aperture:1.5,offset:0});
    assert.equal(scene.type,'two-lines');
    const segments=scene.scene.filter(p=>p.sectionCurve);
    assert.equal(segments.length,2);
    assert.match(scene.info.join(' '),/degenerada/);
    for(const segment of segments){
      assert.ok(segment.degenerate);
      for(const [x,y,z] of [segment.a,segment.b]){
        const u=x*Math.cos(.6)+y*Math.sin(.6);
        near(u,0);
        near(x*x+y*y,1.5**2*(z-1.4)**2,1e-6);
      }
      near((segment.a[0]+segment.b[0])/2,0);
      near((segment.a[1]+segment.b[1])/2,0);
      near((segment.a[2]+segment.b[2])/2,1.4);
    }
  }
});
test('ao cruzar o vértice em outras inclinações, cônicas degeneradas continuam visíveis',()=>{
  const h=2;
  const cases=[
    {q:60,b:-h*Math.cos(Math.PI/3)/Math.sin(Math.PI/3),type:'two-lines',lines:2},
    {q:45,b:-h,type:'one-line',lines:1},
    {q:30,b:-h*Math.cos(Math.PI/6)/Math.sin(Math.PI/6),type:'vertex-point',lines:0}
  ];
  for(const {q,b,type,lines} of cases){
    const s=makeAngledConicSectionScene(h,q,{offset:b});
    assert.equal(s.type,type);
    assert.equal(s.scene.filter(p=>p.sectionCurve).length,lines);
    assert.ok(s.count>0);
    const entry=parseGeometryInput('secao: h,angulo(q),a,d,p,b',
      {params:{h,q,a:1,d:0,p:0,b}});
    assert.ok(!entry.error,'Geometria degenerada deve ser válida: '+String(entry.error));
  }
});
