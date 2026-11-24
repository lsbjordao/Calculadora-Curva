import assert from 'node:assert/strict';
import test from 'node:test';

import { addGeometryDefinitions, parseGeometryInput } from '../src/geometry.js';
import { wants3d } from '../src/space3d/geometry3d.js';
import { createCamera, fitCameraScale } from '../src/space3d/camera.js';
import { axesPrimitives } from '../src/space3d/scene3d.js';
import { buildDrawList } from '../src/space3d/render3d.js';
import { autoAxisLimit, chips3d } from '../src/space3d/view3d.js';
import { prepareThreePrimitives, threeTickVisible } from '../src/space3d/three-renderer.js';
import { primitivesToPlotlyData } from '../src/space3d/plotly-renderer.js';

const close=(a,b,tol=1e-9)=>assert.ok(Math.abs(a-b)<=tol,`${a} ≉ ${b}`);
const closeVec=(a,b,tol)=>{ assert.equal(a.length,b.length); a.forEach((c,i)=>close(c,b[i],tol)); };
const prims=(r,kind)=>(r.scene3d||[]).filter(p=>p.kind===kind);
const arrowTo=(r,label)=>prims(r,'arrow').find(p=>p.label===label);
const info=r=>r.info.join(' | ');
const finiteScene=r=>(r.scene3d||[]).every(p=>
  [p.p,p.a,p.b,p.from,p.to,p.n,p.v,...(p.points||[])].filter(Boolean).flat().every(Number.isFinite)
  && (p.kind!=='plane'||Number.isFinite(p.d)));
const ok=r=>{ assert.ok(r,'null result'); assert.notEqual(r.type,'error',r.error); assert.equal(r.dim,3); assert.ok(finiteScene(r)); return r; };

function registryWith(...lines){
  const registry=new Map();
  for(const line of lines){
    const r=parseGeometryInput(line,{registry});
    assert.ok(r&&r.type!=='error',line+': '+(r?.error||'null'));
    addGeometryDefinitions(registry,r);
  }
  return registry;
}

// ── Plan, Step 1 ──────────────────────────────────────────────────────────

test('vetorial: u=(1,2,3), v=(4,5,6) draws u×v, the parallelogram and the area', ()=>{
  const r=ok(parseGeometryInput('vetorial: u=(1,2,3), v=(4,5,6)'));
  assert.equal(r.type,'cross');
  closeVec(arrowTo(r,'u×v').to,[-3,6,-3]);
  assert.match(info(r),/u × v = \(-3, 6, -3\)/);
  assert.match(info(r),/área = 7\.34847/);
  const faces=prims(r,'polygon');
  assert.equal(faces.length,1);
  assert.deepEqual(faces[0].points,[[0,0,0],[1,2,3],[5,7,9],[4,5,6]]);
  assert.ok(arrowTo(r,'u')&&arrowTo(r,'v'));
});

test('misto / paralelepipedo: [u,v,w], volume, 6 faces and 12 edges; coplanares', ()=>{
  for(const cmd of ['misto','paralelepipedo','paralelepípedo','triple','parallelepiped']){
    const r=ok(parseGeometryInput(cmd+': (1,0,0),(0,1,0),(0,0,1)'));
    assert.equal(r.type,'triple',cmd);
    assert.ok(r.info.includes('[u,v,w] = 1'),info(r));
    assert.ok(r.info.includes('volume = 1'),info(r));
    const faces=prims(r,'polygon');
    assert.equal(faces.length,6);
    assert.ok(faces.every(f=>f.alpha===0.2&&f.points.length===4));
    assert.equal(prims(r,'segment').length,12);
  }
  const neg=ok(parseGeometryInput('misto: (0,1,0),(1,0,0),(0,0,1)'));
  assert.ok(neg.info.includes('[u,v,w] = -1'));
  assert.ok(neg.info.includes('volume = 1'));
  const flat=ok(parseGeometryInput('misto: (1,0,0),(0,1,0),(1,1,0)'));
  assert.match(info(flat),/coplanares/);
  assert.match(info(flat),/volume 0/);
  assert.equal(prims(flat,'polygon').length,0);
  // A null vector is coplanar with anything: no NaN, no faces.
  const nul=ok(parseGeometryInput('misto: (0,0,0),(0,1,0),(0,0,1)'));
  assert.match(info(nul),/coplanares/);
});

test('soma: (1,0,0),(0,2,0) draws u, v, u+v and the parallelogram (aux)', ()=>{
  const r=ok(parseGeometryInput('soma: (1,0,0),(0,2,0)'));
  assert.equal(r.type,'sum');
  closeVec(arrowTo(r,'u+v').to,[1,2,0]);
  assert.equal(arrowTo(r,'u+v').role,'main');
  assert.match(info(r),/u \+ v = \(1, 2, 0\)/);
  const para=prims(r,'polygon');
  assert.equal(para.length,1);
  assert.equal(para[0].role,'aux');
  assert.ok(prims(r,'segment').every(s=>s.role==='aux'));
  // Three vectors: head-to-tail chain.
  const three=ok(parseGeometryInput('sum: (1,0,0),(0,1,0),(0,0,1)'));
  closeVec(arrowTo(three,'u+v+w').to,[1,1,1]);
});

test('ger: posto, reta, plano, ℝ³ e {0}', ()=>{
  const line=ok(parseGeometryInput('ger: (1,0,0),(2,0,0)'));
  assert.equal(line.type,'span');
  assert.match(info(line),/posto 1/);
  assert.match(info(line),/LD/);
  assert.equal(prims(line,'line').length,1);
  assert.deepEqual(prims(line,'line')[0].p,[0,0,0]);
  const plane=ok(parseGeometryInput('ger: (1,0,0),(0,1,0)'));
  assert.match(info(plane),/posto 2/);
  assert.match(info(plane),/plano pela origem: z = 0/);
  const pl=prims(plane,'plane');
  assert.equal(pl.length,1);
  assert.deepEqual(pl[0].n,[0,0,1]);
  assert.equal(pl[0].d,0);
  assert.doesNotMatch(info(plane),/LD/);
  const zero=ok(parseGeometryInput('ger: (0,0,0)'));
  assert.match(info(zero),/ger\{0\} = \{0\}/);
  assert.deepEqual(prims(zero,'point').map(p=>p.p),[[0,0,0]]);
  assert.equal(prims(zero,'arrow').length,0);
  const all=ok(parseGeometryInput('span: (1,0,0),(0,1,0),(1,1,1)'));
  assert.match(info(all),/posto 3/);
  assert.match(info(all),/ℝ³/);
  assert.equal(prims(all,'polygon').length,6);
  const ld=ok(parseGeometryInput('ger: (1,0,0),(0,1,0),(1,1,0)'));
  assert.match(info(ld),/posto 2/);
  assert.match(info(ld),/LD/);
  assert.equal(prims(ld,'plane').length,1);
  // Simplified normal: x + y + z = 0 with integer coefficients.
  const slanted=ok(parseGeometryInput('ger: (2,-2,0),(0,2,-2)'));
  assert.deepEqual(prims(slanted,'plane')[0].n,[1,1,1]);
  assert.match(info(slanted),/x \+ y \+ z = 0/);
  const one=ok(parseGeometryInput('ger: (0,0,3)'));
  assert.match(info(one),/posto 1/);
  assert.equal(prims(one,'line').length,1);
});

test('escalar: u=(3,4,0), v=(1,0,0) shows u·v, the angle and the projection (aux)', ()=>{
  const r=ok(parseGeometryInput('escalar: u=(3,4,0), v=(1,0,0)'));
  assert.equal(r.type,'dot');
  assert.ok(r.info.includes('u · v = 3'),info(r));
  assert.match(info(r),/ângulo\(u, v\) = 53\.1301°/);
  const proj=arrowTo(r,'proj');
  closeVec(proj.to,[3,0,0]);
  assert.equal(proj.role,'aux');
  for(const cmd of ['produto: u=(3,4,0); v=(1,0,0)','dot: (3,4,0), (1,0,0)']){
    const s=ok(parseGeometryInput(cmd));
    assert.ok(s.info.includes('u · v = 3'),cmd);
  }
  const ortho=ok(parseGeometryInput('escalar: (1,0,0), (0,0,2)'));
  assert.match(info(ortho),/ortogonais/);
  // Null v: no projection, no angle, no NaN.
  const nul=ok(parseGeometryInput('escalar: (1,2,3), (0,0,0)'));
  assert.match(info(nul),/vetor nulo/);
  assert.equal(arrowTo(nul,'proj'),undefined);
});

// ── Scaling and the "scalars before names" rule ───────────────────────────

test('escala: k, u and vetor: 2*u draw k·u', ()=>{
  const registry=registryWith('vetor: u=(1,2,3)');
  const a=ok(parseGeometryInput('escala: 2, u',{registry}));
  assert.equal(a.type,'scale');
  closeVec(arrowTo(a,'2u').to,[2,4,6]);
  assert.equal(arrowTo(a,'u').role,'aux');
  assert.match(info(a),/2u = 2·\(1, 2, 3\) = \(2, 4, 6\)/);
  assert.match(info(a),/mesmo sentido/);
  const b=ok(parseGeometryInput('vetor: 2*u',{registry}));
  closeVec(arrowTo(b,'2u').to,[2,4,6]);
  const neg=ok(parseGeometryInput('vetor: -u',{registry}));
  closeVec(arrowTo(neg,'-u').to,[-1,-2,-3]);
  assert.match(info(neg),/sentido oposto/);
  const lit=ok(parseGeometryInput('escala: -1/2, (2,0,4)'));
  closeVec(prims(lit,'arrow').find(p=>p.role==='main').to,[-1,0,-2]);
  // Definitions register the scaled vector.
  const named=parseGeometryInput('vetor: w = 2*u',{registry});
  assert.ok(named.definitions.some(d=>d.name==='w'&&d.kind==='vector'&&d.value.dim===3));
  const def=parseGeometryInput('w = escala(3, u)',{registry});
  ok(def);
  const w=def.definitions.find(d=>d.name==='w');
  closeVec([w.value.to.x,w.value.to.y,w.value.to.z],[3,6,9]);
  // k = 0 (slider): null vector, warning, no arrow for k·u.
  const zero=ok(parseGeometryInput('escala: k, u',{registry,params:{k:0}}));
  assert.match(info(zero),/vetor nulo/);
  assert.equal(prims(zero,'arrow').filter(p=>p.role==='main').length,0);
  // The scalar must come first.
  const bad=parseGeometryInput('escala: u, 2',{registry});
  assert.equal(bad.type,'error');
  assert.match(bad.error,/número/);
});

test('scalars are read before names: π and r stay numbers even with a plane π and a line r', ()=>{
  const registry=registryWith('vetor: u=(1,2,3)','plano: z = 0','reta: (0,0,0) + t*(1,0,0)');
  assert.equal(registry.get('π').kind,'plane');
  assert.equal(registry.get('r').kind,'line3');
  const pi=ok(parseGeometryInput('escala: π, u',{registry}));
  closeVec(prims(pi,'arrow').find(p=>p.role==='main').to,[Math.PI,2*Math.PI,3*Math.PI]);
  const r=ok(parseGeometryInput('escala: r, u',{registry,params:{r:3}}));
  closeVec(prims(r,'arrow').find(p=>p.role==='main').to,[3,6,9]);
  const v=ok(parseGeometryInput('vetor: r*u',{registry,params:{r:2}}));
  closeVec(prims(v,'arrow').find(p=>p.role==='main').to,[2,4,6]);
  const vp=ok(parseGeometryInput('vetor: π*u',{registry}));
  closeVec(prims(vp,'arrow').find(p=>p.role==='main').to,[Math.PI,2*Math.PI,3*Math.PI]);
  // Scaled vectors also work inside the other commands.
  const s=ok(parseGeometryInput('soma: 2*u, (0,0,1)',{registry}));
  closeVec(arrowTo(s,'2u+v').to,[2,4,7]);
});

// ── projecao in 3D, 2D unchanged ─────────────────────────────────────────

test('projecao accepts 3D; 2D produto and projecao are unchanged', ()=>{
  const p=ok(parseGeometryInput('projecao: (1,2,3), (0,0,2)'));
  assert.equal(p.type,'projection');
  assert.ok(p.info.includes('proj_v(u) = (0, 0, 3)'),info(p));
  closeVec(arrowTo(p,'proj').to,[0,0,3]);
  const def=parseGeometryInput('q = projecao((1,2,3), (0,0,2))');
  assert.ok(def.definitions.some(d=>d.name==='q'&&d.kind==='vector'));
  const bad=parseGeometryInput('projecao: (1,2,3), (0,0,0)');
  assert.equal(bad.type,'error');
  assert.match(bad.error,/vetor nulo/);

  const dot2=parseGeometryInput('produto: (3,4); (1,0)');
  assert.equal(dot2.dim,undefined);
  assert.deepEqual(dot2.info,['u · v = 3','|u| = 5','|v| = 1','cos(theta) = 0.6']);
  const proj2=parseGeometryInput('projecao: (3,4); (1,0)');
  assert.equal(proj2.dim,undefined);
  assert.deepEqual(proj2.info,['proj_v(u) = (3, 0)','coeficiente = 3','u · v = 3']);
  // 2D "vetor: 2*u" keeps its old (error) behavior.
  const registry=registryWith('vetor: u=(1,2)');
  const v2=parseGeometryInput('vetor: 2*u',{registry});
  assert.equal(v2.type,'error');
  assert.equal(v2.dim,undefined);
});

test('routing: the new commands are always ℝ³; vetor: k*u only with a 3D u', ()=>{
  for(const c of ['sum','scale','cross','triple','parallelepiped','span']) assert.ok(wants3d(c,'(1,0),(0,1)',{}),c);
  const r3=registryWith('vetor: u=(1,2,3)');
  const r2=registryWith('vetor: u=(1,2)');
  assert.ok(wants3d('vector','2*u',{registry:r3}));
  assert.ok(wants3d('vector','w = k*u',{registry:r3}));
  assert.ok(!wants3d('vector','2*u',{registry:r2}));
  assert.ok(wants3d('vector','2*(1,2,3)',{}));
  // 2D vectors in the new commands are promoted to z = 0 with a warning.
  const s=ok(parseGeometryInput('soma: (1,0),(0,2)'));
  closeVec(arrowTo(s,'u+v').to,[1,2,0]);
  assert.match(info(s),/promovid/);
});

// ── Degenerate inputs and definitions ─────────────────────────────────────

test('degenerate: parallel or null vectors, sliders at zero, wrong arity', ()=>{
  const par=ok(parseGeometryInput('vetorial: (1,2,3), (2,4,6)'));
  assert.match(info(par),/área = 0/);
  assert.match(info(par),/paralelos/);
  assert.equal(arrowTo(par,'u×v'),undefined);
  assert.equal(prims(par,'polygon').length,0);
  const k0=ok(parseGeometryInput('vetorial: (k,0,0), (0,1,0)',{params:{k:0}}));
  assert.match(info(k0),/área = 0/);
  const nulls=ok(parseGeometryInput('ger: (0,0,0), (0,0,0)'));
  assert.match(info(nulls),/ger\{0\} = \{0\}/);
  const sum0=ok(parseGeometryInput('soma: (1,0,0), (-1,0,0)'));
  assert.equal(arrowTo(sum0,'u+v'),undefined);
  assert.match(info(sum0),/vetor nulo/);
  for(const [line,re] of [['vetorial: (1,0,0)',/vetorial/],['misto: (1,0,0),(0,1,0)',/misto/],['soma: (1,0,0)',/soma/],['ger: x',/ger|nome/],['escala: 2',/escala/]]){
    const r=parseGeometryInput(line);
    assert.equal(r.type,'error',line);
    assert.match(r.error,re,line);
  }
});

test('definitions: vetorial and soma define vectors, misto a scalar, ger a line or a plane', ()=>{
  const registry=registryWith('vetor: u=(1,2,3)','vetor: v=(4,5,6)');
  const n=parseGeometryInput('n1 = vetorial(u, v)',{registry});
  ok(n);
  const def=n.definitions.find(d=>d.name==='n1');
  assert.equal(def.kind,'vector');
  closeVec([def.value.to.x,def.value.to.y,def.value.to.z],[-3,6,-3]);
  const s=parseGeometryInput('s = soma(u, v)',{registry});
  assert.equal(s.definitions.find(d=>d.name==='s').kind,'vector');
  const t=parseGeometryInput('V = misto(u, v, (0,0,1))',{registry});
  const tv=t.definitions.find(d=>d.name==='V');
  assert.equal(tv.kind,'scalar');
  close(tv.value,-3);
  const S=parseGeometryInput('S = ger(u, v)',{registry});
  ok(S);
  const sd=S.definitions.find(d=>d.name==='S');
  assert.equal(sd.kind,'plane');
  addGeometryDefinitions(registry,S);
  const inter=ok(parseGeometryInput('posicao: S, (0,0,0)',{registry}));
  assert.match(info(inter),/pertence/);
  const L=parseGeometryInput('L = ger(u)',{registry});
  assert.equal(L.definitions.find(d=>d.name==='L').kind,'line3');
});

// ── Main's axis range, tick thinning and the other renderers ─────────────

test('autoAxisLimit (main) widens the axes for the operation scenes; ger ℝ³ keeps ±5', ()=>{
  const eqs=text=>[{kind:'geometry',text,geometry:parseGeometryInput(text),visible:true}];
  assert.equal(autoAxisLimit(eqs('soma: (8,0,0),(0,8,0)')),10);
  assert.equal(autoAxisLimit(eqs('ger: (1,0,0),(0,1,0),(0,0,1)')),5);
  assert.equal(autoAxisLimit(eqs('vetorial: (1,0,0),(0,1,0)')),5);
});

test('ticks hide only when the gap between marks is under 6 px (zoomed out, every axis keeps numbers)', ()=>{
  const view={width:400,height:300};
  const box={min:[-20,-20,-20],max:[20,20,20]};
  const cam=createCamera({scale:fitCameraScale(view)*.25});
  const items=buildDrawList(axesPrimitives(box),cam,view).filter(i=>i.kind==='label'&&i.role==='tick');
  for(const axis of [0,1,2]){
    const pts=items.filter(i=>i.source.axis===axis).sort((a,b)=>a.source.value-b.source.value);
    assert.ok(pts.length>0,'axis '+axis+' keeps tick numbers');
    for(let i=1;i<pts.length;i++) assert.ok(Math.hypot(pts[i].x-pts[i-1].x,pts[i].y-pts[i-1].y)>=28-1e-6);
  }
  // Three.js applies the same rule (marks every 5 units, about 3 px per unit).
  const ticks=axesPrimitives(box).filter(p=>p.role==='tick'&&p.kind==='label');
  for(const axis of [0,1,2]) assert.ok(ticks.some(p=>p.axis===axis&&threeTickVisible(p,cam)),'three axis '+axis);
});

test('Three.js and Plotly keep every primitive of vetorial, misto and ger', ()=>{
  for(const text of ['vetorial: u=(1,2,3), v=(4,5,6)','misto: (1,0,0),(0,1,0),(0,0,1)','ger: (1,0,0),(0,1,0)','ger: (1,1,0)']){
    const scene=parseGeometryInput(text).scene3d;
    assert.ok(scene.length>0,text);
    const three=prepareThreePrimitives(scene,{min:[-5,-5,-5],max:[5,5,5]});
    assert.equal(three.length,scene.length,text+' (three)');
    assert.ok(three.every(p=>p.kind!=='plane'&&p.kind!=='line'),text+' planes/lines clipped for Three');
    const traces=primitivesToPlotlyData(scene,{range:5});
    assert.ok(traces.length>0,text+' (plotly)');
  }
});

// ── Row chips for 3D rows ─────────────────────────────────────────────────

test('chips3d: only the chips that act on a 3D row', ()=>{
  const row=text=>({kind:'geometry', text, geometry:parseGeometryInput(text), visible:true});
  assert.equal(chips3d(row('ponto: A=(1,2)')),null);
  assert.equal(chips3d(row('vetor: (1,2)')),null);
  assert.deepEqual(chips3d(row('ponto: A=(1,2,3)')),{labels:true,vectors:false,guides:true});
  assert.deepEqual(chips3d(row('vetor: u=(1,2,3)')),{labels:true,vectors:true,guides:false});
  assert.deepEqual(chips3d(row('plano: z = 0')),{labels:true,vectors:false,guides:false});
  assert.deepEqual(chips3d(row('distancia: (0,0,0), (1,1,1)')),{labels:true,vectors:false,guides:false});
  assert.deepEqual(chips3d(row('ger: (0,0,0)')).vectors,false);
});

test('fix wave: escala: u, 2 names the form; ger: takes one to three vectors', ()=>{
  const registry=registryWith('vetor: u=(1,2,3)');
  assert.equal(parseGeometryInput('escala: u, 2',{registry}).error,'escala: u não é um número (use escala: k, u)');
  const four=parseGeometryInput('ger: (1,0,0),(0,1,0),(0,0,1),(1,1,1)');
  assert.equal(four.type,'error');
  assert.equal(four.error,'ger: use de um a três vetores (ger: u, v, w)');
  ok(parseGeometryInput('ger: (1,0,0),(0,1,0),(0,0,1)'));
});

test('fix wave: ger ℝ³ box follows the axis range (±N) in the composed scene', async ()=>{
  const { scenePrimitives }=await import('../src/space3d/view3d.js');
  const geometry=parseGeometryInput('ger: (1,0,0),(0,1,0),(0,0,1)');
  const eqs=[{kind:'geometry',text:'ger: (1,0,0),(0,1,0),(0,0,1)',geometry,visible:true}];
  for(const N of [3,10]){
    const box={min:[-N,-N,-N],max:[N,N,N]};
    const polys=scenePrimitives(eqs,{box}).filter(p=>p.kind==='polygon');
    assert.equal(polys.length,6);
    const coords=polys.flatMap(p=>p.points.flat());
    assert.equal(Math.max(...coords),N);
    assert.equal(Math.min(...coords),-N);
  }
});
