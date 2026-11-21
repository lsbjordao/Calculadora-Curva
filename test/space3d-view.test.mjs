import assert from 'node:assert/strict';
import test from 'node:test';
import { createCamera } from '../src/space3d/camera.js';
import { parseGeometryInput } from '../src/geometry.js';
import {
  decideViewMode, has3dObjects, viewNotice, normalizeView3d, serializeView3d,
  scenePrimitives, contourSegments, attachCameraControls
} from '../src/space3d/view3d.js';

const geoEq=(text,extra={})=>({kind:'geometry',text,visible:true,error:false,geometry:parseGeometryInput(text),ci:0,...extra});

test('decideViewMode só muda para 3D na transição sem-3D → com-3D',()=>{
  assert.equal(decideViewMode({previousHas3d:false,nowHas3d:true,current:'2d'}),'3d');
  assert.equal(decideViewMode({previousHas3d:true,nowHas3d:true,current:'2d'}),'2d');
  assert.equal(decideViewMode({previousHas3d:true,nowHas3d:false,current:'3d'}),'3d');
  assert.equal(decideViewMode({previousHas3d:false,nowHas3d:false,current:'2d'}),'2d');
  assert.equal(decideViewMode({previousHas3d:false,nowHas3d:true,current:'3d'}),'3d');
});

test('has3dObjects conta só linhas 3D visíveis e válidas',()=>{
  assert.equal(has3dObjects([geoEq('ponto: A=(1,2)')]),false);
  assert.equal(has3dObjects([geoEq('ponto: A=(1,2,3)')]),true);
  assert.equal(has3dObjects([geoEq('ponto: A=(1,2,3)',{visible:false})]),false);
  assert.equal(has3dObjects([geoEq('ponto: A=(1,2,3)',{error:true})]),false);
});

test('viewNotice avisa objetos 3D na vista 2D e não geométricos na vista 3D',()=>{
  assert.equal(viewNotice(geoEq('ponto: A=(1,2,3)'),'2d'),'objeto 3D: abra a vista 3D');
  assert.equal(viewNotice(geoEq('ponto: A=(1,2,3)'),'3d'),'');
  assert.equal(viewNotice(geoEq('ponto: A=(1,2)'),'3d'),'');
  assert.equal(viewNotice({kind:'function',text:'sin(x)',visible:true,error:false},'3d'),'não aparece na vista 3D');
  assert.equal(viewNotice({kind:'function',text:'sin(x)',visible:true,error:false},'2d'),'');
  assert.equal(viewNotice({kind:'function',text:'   ',visible:true,error:false},'3d'),'');
  assert.equal(viewNotice({kind:'function',text:'bad(',visible:true,error:true},'3d'),'');
});

test('normalizeView3d / serializeView3d guardam modo, câmera e zoom relativo',()=>{
  const empty=normalizeView3d(undefined);
  assert.equal(empty.mode,'2d');
  assert.equal(empty.savedMode,false);
  assert.equal(empty.zoom,1);
  const v=normalizeView3d({mode:'3d',grid:true,camera:{azimuth:30,elevation:10,projection:'perspective',zoom:2,target:[1,0,0]}});
  assert.equal(v.mode,'3d');
  assert.equal(v.savedMode,true);
  assert.equal(v.grid,true);
  assert.equal(v.camera.azimuth,30);
  assert.equal(v.camera.projection,'perspective');
  assert.equal(v.zoom,2);
  const out=serializeView3d({...v,camera:{...v.camera,scale:80,dragging:true}},40);
  assert.deepEqual(out,{mode:'3d',grid:true,camera:{azimuth:30,elevation:10,distance:30,target:[1,0,0],projection:'perspective',zoom:2}});
  assert.equal(normalizeView3d({mode:'xyz',camera:{zoom:-1}}).mode,'2d');
  assert.equal(normalizeView3d({mode:'3d',camera:{zoom:-1}}).zoom,1);
});

test('scenePrimitives aplica a cor da linha e as variantes por papel',()=>{
  const colorOf=eq=>eq.ci===1 ? '#2d70b3' : '#c0492f';
  const prims=scenePrimitives([geoEq('ponto: A=(1,2,3)'),geoEq('vetor: u=(2,-1,3)',{ci:1})],{colorOf});
  const point=prims.find(p=>p.kind==='point');
  const arrow=prims.find(p=>p.kind==='arrow');
  assert.deepEqual(point.p,[1,2,3]);
  assert.equal(point.color,'#c0492f');
  assert.equal(arrow.color,'#2d70b3');
  // Faces/planes semi-transparent; aux segments dashed.
  const synthetic={kind:'geometry',text:'x',visible:true,error:false,ci:0,lw:3,geometry:{type:'x',dim:3,scene3d:[
    {kind:'polygon',points:[[0,0,0],[1,0,0],[0,1,0]],role:'main'},
    {kind:'mesh',vertices:[[0,0,0],[1,0,0],[0,1,0]],faces:[[0,1,2]],alpha:.5},
    {kind:'segment',a:[0,0,0],b:[1,1,1],role:'aux'},
    {kind:'segment',a:[0,0,0],b:[1,0,1],role:'main'}
  ]}};
  const out=scenePrimitives([synthetic],{colorOf});
  assert.ok(out.every(p=>p.color==='#c0492f'));
  assert.ok(out[0].alpha>0&&out[0].alpha<.5);
  assert.equal(out[1].alpha,.5);
  assert.equal(out[2].dash,true);
  assert.ok(!out[3].dash);
  assert.equal(out[3].weight,3);
  // The original scene is not mutated.
  assert.equal(synthetic.geometry.scene3d[0].color,undefined);
});

test('scenePrimitives omite ocultas, não geométricas e rótulos desligados',()=>{
  const colorOf=()=> '#000';
  assert.deepEqual(scenePrimitives([geoEq('ponto: A=(1,2,3)',{visible:false})],{colorOf}),[]);
  assert.deepEqual(scenePrimitives([{kind:'function',text:'sin(x)',visible:true,error:false}],{colorOf}),[]);
  const noLabels=scenePrimitives([geoEq('ponto: A=(1,2,3)',{showGeoLabels:false})],{colorOf});
  assert.equal(noLabels.length,1);
  assert.equal(noLabels[0].label,undefined);
});

test('scenePrimitives promove objetos 2D para z = 0',()=>{
  const colorOf=()=> '#111';
  const prims=scenePrimitives([
    geoEq('ponto: B=(1,2)'),
    geoEq('vetor: v=(3,4)'),
    geoEq('reta: (0,0),(1,1)'),
    geoEq('conica: x^2 + y^2 = 4')
  ],{colorOf});
  const point=prims.find(p=>p.kind==='point'&&p.label==='B');
  assert.deepEqual(point.p,[1,2,0]);
  const arrow=prims.find(p=>p.kind==='arrow');
  assert.deepEqual(arrow.from,[0,0,0]);
  assert.deepEqual(arrow.to,[3,4,0]);
  const segs=prims.filter(p=>p.kind==='segment');
  assert.ok(segs.length>10,'reta + contorno da cônica');
  assert.ok(segs.every(s=>s.a[2]===0&&s.b[2]===0));
  // The line y = x is clipped by the ±5 box.
  assert.ok(segs.some(s=>Math.abs(Math.abs(s.a[0])-5)<1e-9&&Math.abs(s.a[0]-s.a[1])<1e-9));
  assert.ok(prims.every(p=>p.color==='#111'));
});

test('contourSegments traça x² + y² = 4 perto do raio 2',()=>{
  const segs=contourSegments((x,y)=>x*x+y*y-4,{min:[-5,-5],max:[5,5]},40);
  assert.ok(segs.length>20);
  for(const [a,b] of segs){
    assert.ok(Math.abs(Math.hypot(a[0],a[1])-2)<.15);
    assert.ok(Math.abs(Math.hypot(b[0],b[1])-2)<.15);
  }
  assert.deepEqual(contourSegments(()=>NaN,{min:[-5,-5],max:[5,5]},10),[]);
});

function fakeCanvas(){
  const listeners={};
  return {
    listeners,
    addEventListener(type,fn){ (listeners[type]||=[]).push(fn); },
    setPointerCapture(){}, releasePointerCapture(){},
    getBoundingClientRect:()=>({left:0,top:0,width:400,height:300}),
    style:{},
    fire(type,ev={}){ (listeners[type]||[]).forEach(fn=>fn({preventDefault(){},pointerId:1,clientX:0,clientY:0,...ev})); }
  };
}

test('attachCameraControls: arrastar gira, Shift move, roda aproxima, duplo clique restaura, teclado',()=>{
  const canvas=fakeCanvas();
  let camera=createCamera({scale:40}), draws=0, commits=0, active=true;
  const seen=[];
  attachCameraControls(canvas,()=>camera,c=>{camera=c;seen.push(c.dragging===true);},()=>draws++,{
    isActive:()=>active, onCommit:()=>commits++, defaultCamera:()=>createCamera({scale:50})
  });
  canvas.fire('pointerdown',{clientX:100,clientY:100});
  canvas.fire('pointermove',{clientX:110,clientY:95});
  assert.equal(camera.azimuth,-64);
  assert.equal(camera.elevation,23);
  assert.equal(camera.dragging,true);
  canvas.fire('pointerup',{clientX:110,clientY:95});
  assert.equal(camera.dragging,false);
  assert.equal(commits,1);
  assert.ok(draws>=2);

  canvas.fire('pointerdown',{clientX:100,clientY:100,shiftKey:true});
  canvas.fire('pointermove',{clientX:140,clientY:100,shiftKey:true});
  canvas.fire('pointerup',{clientX:140,clientY:100,shiftKey:true});
  assert.notDeepEqual(camera.target,[0,0,0]);
  assert.equal(camera.azimuth,-64);

  const before=camera.scale;
  canvas.fire('wheel',{deltaY:-100});
  assert.ok(camera.scale>before);

  canvas.fire('dblclick');
  assert.equal(camera.scale,50);
  assert.deepEqual(camera.target,[0,0,0]);
  assert.equal(camera.azimuth,-60);

  canvas.fire('keydown',{key:'ArrowRight'});
  assert.notEqual(camera.azimuth,-60);
  const s=camera.scale;
  canvas.fire('keydown',{key:'+'});
  assert.ok(camera.scale>s);

  // Two fingers: pinch zooms.
  const z=camera.scale;
  canvas.fire('pointerdown',{pointerId:1,clientX:100,clientY:100});
  canvas.fire('pointerdown',{pointerId:2,clientX:200,clientY:100});
  canvas.fire('pointermove',{pointerId:2,clientX:300,clientY:100});
  assert.ok(camera.scale>z*1.5);
  canvas.fire('pointerup',{pointerId:2,clientX:300,clientY:100});
  canvas.fire('pointerup',{pointerId:1,clientX:100,clientY:100});
  assert.equal(camera.dragging,false);

  // Inactive (2D view): nothing happens.
  active=false;
  const frozen=camera;
  canvas.fire('pointerdown',{clientX:0,clientY:0});
  canvas.fire('pointermove',{clientX:50,clientY:50});
  canvas.fire('wheel',{deltaY:-100});
  canvas.fire('keydown',{key:'ArrowLeft'});
  assert.equal(camera,frozen);
});
