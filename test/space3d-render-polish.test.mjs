import assert from 'node:assert/strict';
import test from 'node:test';

import { createCamera } from '../src/space3d/camera.js';
import { clipPlaneToBox, defaultBox } from '../src/space3d/scene3d.js';
import { buildDrawList } from '../src/space3d/render3d.js';
import { buildSystemScene3D } from '../src/linear-transform-view.js';
import { solveinfo } from '../src/linear-algebra.js';
import { parseGeometryInput } from '../src/geometry.js';

// GD: lines lying in a plane are painted after it from any camera (Canvas).

const vp={width:800,height:600};
const cameras=function*(){
  for(let az=-180;az<180;az+=13) for(let el=-85;el<=85;el+=10)
    for(const projection of ['ortho','perspective']) yield createCamera({azimuth:az,elevation:el,projection});
};
const order=(prims,cam)=>buildDrawList(prims,cam,vp).filter(i=>i.kind!=='label');
const idx=(list,pred)=>list.findIndex(i=>pred(i.source));
const allIdx=(list,pred)=>list.map((i,k)=>pred(i.source)?k:-1).filter(k=>k>=0);

test('off-centroid segment, line and point lying in a plane are drawn after it', ()=>{
  const plane={kind:'polygon',points:clipPlaneToBox([0,0,1],0,defaultBox()),alpha:.2,id:'plane'};
  const seg={kind:'segment',a:[1,4,0],b:[4,1,0],id:'seg'};
  const line={kind:'line',p:[2,3,0],v:[1,0.3,0],id:'line'};
  const point={kind:'point',p:[3,3,0],id:'point'};
  const tilted={kind:'plane',n:[1,2,3],d:4,alpha:.2,id:'tilted'};
  const onTilted={kind:'segment',a:[4,0,0],b:[0,-1,2],id:'onTilted'}; // 1·4+0 = 4, 0−2+6 = 4
  let views=0;
  for(const cam of cameras()){
    const list=order([seg,line,point,plane,onTilted,tilted],cam);
    const p=idx(list,s=>s.id==='plane'), t=idx(list,s=>s.id==='tilted');
    for(const id of ['seg','line','point']){
      const k=idx(list,s=>s.id===id);
      if(k>=0&&p>=0) assert.ok(k>p,`${id} antes do plano: az ${cam.azimuth} el ${cam.elevation} ${cam.projection}`);
    }
    const k=idx(list,s=>s.id==='onTilted');
    if(k>=0&&t>=0) assert.ok(k>t,`onTilted: az ${cam.azimuth} el ${cam.elevation}`);
    views++;
  }
  assert.ok(views>500);
});

test('a segment off the plane keeps the depth order (it is not lifted)', ()=>{
  const plane={kind:'polygon',points:clipPlaneToBox([0,0,1],0,defaultBox()),alpha:.2,id:'plane'};
  const below={kind:'segment',a:[1,4,-2],b:[4,1,-2],id:'below'};
  const cam=createCamera({azimuth:-60,elevation:60});
  const list=order([below,plane],cam);
  assert.ok(idx(list,s=>s.id==='below')<idx(list,s=>s.id==='plane'),'abaixo do plano, visto de cima: antes');
});

test('solveinfo 3×3: the solution line is drawn after the planes that contain it', ()=>{
  const A=[[1,1,1],[2,2,2],[1,-1,0]], b=[1,2,0];
  const scene=buildSystemScene3D(A,b,null,solveinfo(A,b));
  for(const cam of cameras()){
    const list=order(scene,cam);
    const line=idx(list,s=>s.systemSolution&&s.kind==='line');
    if(line<0) continue;
    for(const k of allIdx(list,s=>s.kind==='plane')) assert.ok(line>k,`az ${cam.azimuth} el ${cam.elevation}`);
  }
});

test('corte: the section curve is drawn after its plane; ger: a line inside a ger plane too', ()=>{
  const cut=parseGeometryInput('corte: x^2 + y^2 - z^2 = 0, z = 0.5*y + 1').scene3d.filter(p=>p.kind!=='mesh');
  const span=parseGeometryInput('ger: (1,0,0),(0,1,0)').scene3d;
  const inside={kind:'line',p:[0,0,0],v:[1,1,0],id:'inside'};
  for(const cam of cameras()){
    const list=order(cut,cam);
    const plane=idx(list,s=>s.kind==='plane');
    for(const k of allIdx(list,s=>s.sectionCurve)) assert.ok(k>plane,`corte az ${cam.azimuth} el ${cam.elevation}`);
    const g=order([inside,...span],cam);
    const gp=idx(g,s=>s.kind==='plane'), gl=idx(g,s=>s.id==='inside');
    if(gp>=0&&gl>=0) assert.ok(gl>gp,`ger az ${cam.azimuth} el ${cam.elevation}`);
  }
});

// ── Item 3: u×v along the line of sight ──────────────────────────────────

import { viewAlignmentHint } from '../src/space3d/view3d.js';

test('row hint when u×v (vetorial) or u, v, w (misto) point along the view; camera untouched', ()=>{
  const row=text=>({kind:'geometry',visible:true,text,geometry:parseGeometryInput(text)});
  const cam=createCamera();                 // main's default: azimuth −60°, elevation 25°
  const before=JSON.stringify(cam);
  assert.equal(viewAlignmentHint(row('vetorial: u=(1,2,3), v=(4,5,6)'),cam),'gire a vista para ver u×v');
  assert.equal(JSON.stringify(cam),before);
  assert.equal(viewAlignmentHint(row('vetorial: u=(1,2,3), v=(4,5,6)'),createCamera({azimuth:0,elevation:25})),'');
  assert.equal(viewAlignmentHint(row('vetorial: (1,0,0),(0,1,0)'),cam),'');
  assert.equal(viewAlignmentHint(row('vetorial: (1,0,0),(0,1,0)'),createCamera({azimuth:0,elevation:89})),'gire a vista para ver u×v');
  // misto: w = (0,0,1) seen from the top.
  assert.equal(viewAlignmentHint(row('misto: (1,0,0),(0,1,0),(0,0,1)'),createCamera({azimuth:0,elevation:89})),'gire a vista para ver w');
  assert.equal(viewAlignmentHint(row('misto: (1,0,0),(0,1,0),(0,0,1)'),cam),'');
  // Only vetorial/misto rows; parallel vectors (u×v = 0) give no hint.
  assert.equal(viewAlignmentHint(row('vetor: u=(1,2,3)'),cam),'');
  assert.equal(viewAlignmentHint(row('vetorial: (1,0,0),(2,0,0)'),cam),'');
});

test('with the axis box, a plane and its label stay inside the ±N box', ()=>{
  const cam=createCamera({scale:12});        // zoomed out: visibleBox would be about ±40
  const box={min:[-5,-5,-5],max:[5,5,5]};
  const list=buildDrawList([{kind:'plane',n:[1,1,1],d:1,alpha:.2,label:'π'}],cam,vp,{box});
  const poly=list.find(i=>i.kind==='polygon'), label=list.find(i=>i.kind==='label');
  const reach=Math.max(...poly.points.map(p=>Math.hypot(p.x-400,p.y-300)));
  assert.ok(reach<=12*5*Math.sqrt(3)+1,`polígono até ${reach} px`);
  assert.ok(Math.hypot(label.x-400,label.y-300)<=reach+1,'rótulo dentro do recorte');
  const wide=buildDrawList([{kind:'plane',n:[1,1,1],d:1,alpha:.2}],cam,vp).find(i=>i.kind==='polygon');
  assert.ok(Math.max(...wide.points.map(p=>Math.hypot(p.x-400,p.y-300)))>reach*2,'sem opts.box: caixa visível (comportamento antigo)');
});
