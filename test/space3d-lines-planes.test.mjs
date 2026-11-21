import assert from 'node:assert/strict';
import test from 'node:test';

import { addGeometryDefinitions, parseGeometryInput } from '../src/geometry.js';
import {
  lineFromPoints, lineFromPointDir, parseLine3,
  planeFromPoints, planeFromPointNormal, planeFromPointDirs, parsePlane,
  intersectLinePlane, intersectPlanes, intersectThreePlanes, intersectLines3,
  distancePointPlane, distancePointLine, distanceLines, distancePlanes,
  angleBetween, relativePosition, involves3d, wants3d
} from '../src/space3d/geometry3d.js';
import { createCamera, presetView, visibleBox } from '../src/space3d/camera.js';
import { buildDrawList } from '../src/space3d/render3d.js';
import { scenePrimitives } from '../src/space3d/view3d.js';

const close=(a,b,tol=1e-9)=>assert.ok(Math.abs(a-b)<=tol,`${a} ≉ ${b}`);
const closeVec=(a,b,tol)=>{ assert.equal(a.length,b.length); a.forEach((c,i)=>close(c,b[i],tol)); };
const prims=(r,kind)=>(r.scene3d||[]).filter(p=>p.kind===kind);
const cross=(a,b)=>[a[1]*b[2]-a[2]*b[1],a[2]*b[0]-a[0]*b[2],a[0]*b[1]-a[1]*b[0]];
const parallel=(a,b)=>cross(a,b).every(c=>Math.abs(c)<1e-9);
const onPlane=(P,pl)=>close(pl.n[0]*P[0]+pl.n[1]*P[1]+pl.n[2]*P[2],pl.d);
const finiteScene=r=>JSON.stringify(r.scene3d||[]).includes('null')===false
  && (r.scene3d||[]).every(p=>[p.p,p.a,p.b,p.from,p.to,p.n,p.v,...(p.points||[])].filter(Boolean).flat().every(Number.isFinite)
    && (p.kind!=='plane'||Number.isFinite(p.d)));

function registryWith(...lines){
  const registry=new Map();
  for(const line of lines){
    const r=parseGeometryInput(line,{registry});
    assert.ok(r&&r.type!=='error',line+': '+(r?.error||'null'));
    addGeometryDefinitions(registry,r);
  }
  return registry;
}

const plane=(n,d)=>({n,d});
const line=(p,v)=>({p,v});

// ── Planes ────────────────────────────────────────────────────────────────

test('parsePlane reads a linear equation with implicit multiplication', ()=>{
  const pl=parsePlane('2x - y + z = 3');
  assert.deepEqual(pl.n,[2,-1,1]);
  assert.equal(pl.d,3);
  const z0=parsePlane('z = 0');
  assert.deepEqual(z0.n,[0,0,1]);
  assert.equal(z0.d,0);
  const moved=parsePlane('x + 2 = 3y - z');
  closeVec(moved.n,[1,-3,1]);
  close(moved.d,-2);
  assert.throws(()=>parsePlane('x^2 + y = 1'),/linear/);
  assert.throws(()=>parsePlane('0*x = 1'),/não define um plano/);
});

test('planeFromPoints, planeFromPointNormal and planeFromPointDirs', ()=>{
  const pl=planeFromPoints([1,0,0],[0,1,0],[0,0,1]);
  assert.ok(parallel(pl.n,[1,1,1]));
  close(pl.d/pl.n[0],1);
  assert.throws(()=>planeFromPoints([0,0,0],[1,1,1],[2,2,2]),/pontos colineares: não determinam um plano/);
  assert.throws(()=>planeFromPoints([1,2,3],[1,2,3],[0,0,1]),/pontos colineares/);
  const pn=planeFromPointNormal([1,0,0],[2,-1,1]);
  assert.deepEqual(pn.n,[2,-1,1]);
  close(pn.d,2);
  assert.throws(()=>planeFromPointNormal([1,0,0],[0,0,0]),/normal nula/);
  const pd=planeFromPointDirs([0,0,1],[1,0,0],[0,1,0]);
  assert.ok(parallel(pd.n,[0,0,1]));
  onPlane([5,-3,1],pd);
  assert.throws(()=>planeFromPointDirs([0,0,0],[1,0,0],[2,0,0]),/paralelos/);
});

test('plano: command forms, names and scene', ()=>{
  const r=parseGeometryInput('plano: 2x - y + z = 3');
  assert.equal(r.type,'plane');
  assert.equal(r.dim,3);
  const planes=prims(r,'plane');
  assert.equal(planes.length,1);
  assert.equal(planes[0].alpha,0.25);
  assert.equal(planes[0].role,'main');
  assert.equal(planes[0].label,'π');
  assert.deepEqual(planes[0].n,[2,-1,1]);
  assert.equal(planes[0].d,3);
  const drawn=buildDrawList(r.scene3d,createCamera(),{width:400,height:300}).filter(i=>i.kind==='polygon');
  assert.equal(drawn.length,1,'the plane is clipped and drawn by buildDrawList');
  assert.ok(r.info.some(line=>line.includes('2x - y + z = 3')),r.info.join(' | '));
  const def=r.definitions.find(d=>d.kind==='plane');
  assert.ok(def);
  assert.equal(def.value.dim,3);

  const pts=parseGeometryInput('plano: A=(1,0,0), B=(0,1,0), C=(0,0,1)');
  assert.equal(pts.type,'plane');
  assert.equal(prims(pts,'point').length,3);
  const pn=parseGeometryInput('plano: P=(1,0,0), n=(2,-1,1)');
  assert.equal(pn.type,'plane');
  assert.deepEqual(pn.definitions.find(d=>d.kind==='plane').value.n,[2,-1,1]);
  assert.ok(prims(pn,'arrow').some(a=>a.role==='aux'),'normal drawn as an auxiliary arrow');
  const pd=parseGeometryInput('plano: P=(0,0,1), u=(1,0,0), v=(0,1,0)');
  assert.equal(pd.type,'plane');
  assert.ok(parallel(pd.definitions.find(d=>d.kind==='plane').value.n,[0,0,1]));

  // Planes without z are still planes under the explicit prefix.
  const noZ=parseGeometryInput('plano: x - y = 0');
  assert.equal(noZ.type,'plane');

  for(const name of ['p1','alfa','π','π1']){
    const named=parseGeometryInput(name+' = plano(x + y + z = 1)');
    assert.equal(named.type,'plane',name);
    assert.ok(named.definitions.some(d=>d.name===name&&d.kind==='plane'),name);
  }
  const en=parseGeometryInput('plane: x + y = 2');
  assert.equal(en.type,'plane');
});

test('degenerate planes report Portuguese errors instead of throwing', ()=>{
  const col=parseGeometryInput('plano: (0,0,0), (1,1,1), (2,2,2)');
  assert.equal(col.type,'error');
  assert.match(col.error,/pontos colineares: não determinam um plano/);
  const nul=parseGeometryInput('plano: P=(0,0,0), n=(k,0,0)',{params:{k:0}});
  assert.equal(nul.type,'error');
  assert.match(nul.error,/normal nula/);
  const flat=parseGeometryInput('plano: k*x = 1',{params:{k:0}});
  assert.equal(flat.type,'error');
  const inf=parseGeometryInput('plano: x/k = 1',{params:{k:0}});
  assert.equal(inf.type,'error');
});

test('a slider at zero keeps plano: k*x + y = 1 valid (y = 1)', ()=>{
  const r=parseGeometryInput('plano: k*x + y = 1',{params:{k:0}});
  assert.equal(r.type,'plane');
  const pl=r.definitions.find(d=>d.kind==='plane').value;
  closeVec(pl.n,[0,1,0]);
  close(pl.d,1);
  assert.ok(finiteScene(r));
});

// ── Lines ─────────────────────────────────────────────────────────────────

test('parseLine3 forms', ()=>{
  const sym=parseLine3('(x-1)/2 = (y+1)/3 = z/1');
  closeVec(sym.p,[1,-1,0]);
  closeVec(sym.v,[2,3,1]);
  const two=parseLine3('(1,2,3), (2,2,2)');
  closeVec(two.p,[1,2,3]);
  closeVec(two.v,[1,0,-1]);
  const pv=parseLine3('P=(1,2,3), v=(1,0,-1)');
  closeVec(pv.p,[1,2,3]);
  closeVec(pv.v,[1,0,-1]);
  const vec=parseLine3('(1,2,3) + t*(1,0,-1)');
  closeVec(vec.p,[1,2,3]);
  closeVec(vec.v,[1,0,-1]);
  const minus=parseLine3('(1,2,3) - t(1,0,-1)');
  closeVec(minus.v,[-1,0,1]);
  const par=parseLine3('x = 1 + 2t, y = -t, z = 3');
  closeVec(par.p,[1,0,3]);
  closeVec(par.v,[2,-1,0]);
  const mixed=parseLine3('x = y = z');
  assert.ok(parallel(mixed.v,[1,1,1]));
  assert.throws(()=>parseLine3('x = t^2, y = 0, z = 0'),/linear/);
});

test('lineFromPoints and lineFromPointDir reject degenerate input', ()=>{
  const l=lineFromPoints([0,0,0],[1,2,3]);
  closeVec(l.v,[1,2,3]);
  assert.throws(()=>lineFromPoints([1,1,1],[1,1,1]),/pontos coincidentes/);
  assert.throws(()=>lineFromPointDir([1,1,1],[0,0,0]),/vetor diretor nulo/);
});

test('reta: command, 3D routing and the null direction slider', ()=>{
  const r=parseGeometryInput('reta: (1,2,3) + t*(1,0,-1)');
  assert.equal(r.type,'line');
  assert.equal(r.dim,3);
  const segs=prims(r,'line');
  assert.equal(segs.length,1);
  assert.deepEqual([segs[0].p,segs[0].v,segs[0].label],[[1,2,3],[1,0,-1],'r']);
  const def=r.definitions.find(d=>d.kind==='line3');
  assert.ok(def);
  assert.equal(def.value.dim,3);
  for(const text of ['reta: x = 1 + 2t, y = -t, z = 3','reta: (x-1)/2 = (y+1)/3 = z/1','reta: P=(1,2,3), v=(1,0,-1)']){
    const res=parseGeometryInput(text);
    assert.equal(res.type,'line',text+': '+res.error);
    assert.equal(res.dim,3,text);
  }
  const named=parseGeometryInput('s = reta((0,0,0),(1,1,1))');
  assert.equal(named.dim,3);
  assert.ok(named.definitions.some(d=>d.name==='s'&&d.kind==='line3'));

  const zero=parseGeometryInput('reta: P=(0,0,0), v=(k,0,0)',{params:{k:0}});
  assert.equal(zero.type,'error');
  assert.match(zero.error,/vetor diretor nulo/);

  // Far lines still parse to an infinite line; whether it shows depends on the zoom.
  const far=parseGeometryInput('reta: (20,20,20) + t*(1,0,0)');
  assert.equal(far.type,'line');
  assert.equal(prims(far,'line').length,1);
  const view={width:400,height:300};
  assert.equal(buildDrawList(far.scene3d,createCamera({scale:50}),view).length,0,'outside the visible box: nothing drawn');
  assert.ok(buildDrawList(far.scene3d,createCamera({scale:5}),view).some(i=>i.kind==='segment'),'zoomed out: drawn');
});

test('reta: through registered 3D points and with a registered vector as direction', ()=>{
  const registry=registryWith('ponto: A=(1,0,0)','ponto: B=(0,1)','vetor: u=(1,2,3)');
  const ab=parseGeometryInput('reta: A, B',{registry});
  assert.equal(ab.dim,3);
  const l=ab.definitions.find(d=>d.kind==='line3').value;
  closeVec(l.v,[-1,1,0]);
  assert.ok(ab.info.some(line=>line.includes('z = 0')),'2D point promoted with a warning');
  const dir=parseGeometryInput('reta: (1,1,1), u',{registry});
  closeVec(dir.definitions.find(d=>d.kind==='line3').value.v,[1,2,3]);
});

// ── Intersections ─────────────────────────────────────────────────────────

test('intersectLinePlane', ()=>{
  const hit=intersectLinePlane(line([0,0,0],[1,1,1]),plane([1,1,1],3));
  assert.equal(hit.kind,'point');
  closeVec(hit.point,[1,1,1]);
  assert.equal(intersectLinePlane(line([0,0,0],[1,-1,0]),plane([1,1,1],3)).kind,'none');
  assert.equal(intersectLinePlane(line([3,0,0],[1,-1,0]),plane([1,1,1],3)).kind,'contained');
});

test('intersectPlanes', ()=>{
  const res=intersectPlanes(plane([1,1,1],1),plane([1,-1,0],0));
  assert.equal(res.kind,'line');
  assert.ok(parallel(res.line.v,[1,1,-2]));
  onPlane(res.line.p,plane([1,1,1],1));
  onPlane(res.line.p,plane([1,-1,0],0));
  assert.equal(intersectPlanes(plane([1,1,1],1),plane([2,2,2],5)).kind,'none');
  assert.equal(intersectPlanes(plane([1,1,1],1),plane([2,2,2],2)).kind,'same');
});

test('intersectThreePlanes', ()=>{
  const res=intersectThreePlanes(plane([1,1,1],6),plane([1,-1,0],0),plane([0,0,1],2));
  assert.equal(res.kind,'point');
  closeVec(res.point,[2,2,2]);
  const pencil=intersectThreePlanes(plane([1,0,0],0),plane([0,1,0],0),plane([1,1,0],0));
  assert.equal(pencil.kind,'line');
  assert.ok(parallel(pencil.line.v,[0,0,1]));
  assert.equal(intersectThreePlanes(plane([1,0,0],0),plane([1,0,0],1),plane([0,1,0],0)).kind,'none');
  assert.equal(intersectThreePlanes(plane([1,0,0],0),plane([0,1,0],0),plane([1,1,0],1)).kind,'none');
  assert.equal(intersectThreePlanes(plane([1,1,1],1),plane([2,2,2],2),plane([-1,-1,-1],-1)).kind,'plane');
});

test('intersectLines3', ()=>{
  const hit=intersectLines3(line([0,0,0],[1,0,0]),line([2,-1,0],[0,1,0]));
  assert.equal(hit.kind,'point');
  closeVec(hit.point,[2,0,0]);
  assert.equal(intersectLines3(line([0,0,0],[1,0,0]),line([0,1,0],[2,0,0])).kind,'parallel');
  assert.equal(intersectLines3(line([0,0,0],[1,0,0]),line([5,0,0],[-3,0,0])).kind,'same');
  assert.equal(intersectLines3(line([0,0,0],[1,0,0]),line([0,1,1],[0,1,0])).kind,'skew');
});

test('intersecao: line and plane, two planes, three planes and empty cases', ()=>{
  const registry=registryWith('r = reta((0,0,0) + t*(1,1,1))','π = plano(x + y + z = 3)');
  assert.equal(involves3d('r, π',{registry}),true);
  const lp=parseGeometryInput('intersecao: r, π',{registry});
  assert.equal(lp.type,'intersect');
  assert.equal(lp.dim,3);
  const P=prims(lp,'point').find(p=>p.role==='main');
  closeVec(P.p,[1,1,1]);
  assert.ok(lp.info.some(line=>line.includes('(1, 1, 1)')),lp.info.join(' | '));
  assert.deepEqual([lp.points[0].x,lp.points[0].y,lp.points[0].z],[1,1,1]);

  const pp=parseGeometryInput('intersecao: x + y + z = 1, x - y = 0');
  assert.equal(pp.type,'intersect');
  const cut=prims(pp,'line').find(s=>s.role==='main'&&!s.label);
  assert.ok(cut&&parallel(cut.v,[1,1,-2]),'intersection line is an infinite primitive');

  const three=parseGeometryInput('I = intersecao(x + y + z = 6, x - y = 0, z = 2)');
  assert.equal(three.type,'intersect');
  closeVec(prims(three,'point').find(p=>p.role==='main').p,[2,2,2]);
  assert.ok(three.definitions.some(d=>d.name==='I'&&d.kind==='point'&&d.value.dim===3));

  const empty=parseGeometryInput('intersecao: x + y + z = 1, 2x + 2y + 2z = 5');
  assert.notEqual(empty.type,'error');
  assert.ok(empty.info.some(line=>line.includes('vazia')),empty.info.join(' | '));
  assert.equal(prims(empty,'point').length,0);
  assert.ok(finiteScene(empty));

  const parallelLine=parseGeometryInput('intersecao: (0,0,0) + t*(1,-1,0), x + y + z = 3');
  assert.ok(parallelLine.info.some(line=>line.includes('vazia')));
  const skew=parseGeometryInput('intersecao: (0,0,0) + t*(1,0,0); (0,1,1) + t*(0,1,0)');
  assert.ok(skew.info.some(line=>line.includes('reversas')));
});

// ── Distances ─────────────────────────────────────────────────────────────

test('distance functions', ()=>{
  close(distancePointPlane([1,2,3],plane([2,-1,2],1)),5/3);
  close(distancePointLine([0,1,0],line([0,0,0],[1,0,0])),1);
  close(distancePointLine([3,4,0],line([0,0,0],[0,0,2])),5);
  const skew=distanceLines(line([0,0,0],[1,0,0]),line([0,1,1],[0,1,0]));
  close(skew.value,1);
  closeVec(skew.closest[0],[0,0,0]);
  closeVec(skew.closest[1],[0,0,1]);
  const par=distanceLines(line([0,0,0],[1,0,0]),line([0,3,4],[-2,0,0]));
  close(par.value,5);
  close(distanceLines(line([0,0,0],[1,0,0]),line([2,-1,0],[0,1,0])).value,0);
  close(distancePlanes(plane([1,0,0],1),plane([2,0,0],8)),3);
  close(distancePlanes(plane([1,0,0],1),plane([0,1,0],8)),0);
});

test('distancia: point–plane, point–line, skew lines and parallel planes', ()=>{
  const pp=parseGeometryInput('distancia: (1,2,3), 2x - y + 2z = 1');
  assert.equal(pp.type,'distance');
  assert.equal(pp.dim,3);
  assert.ok(pp.info.some(line=>line.includes('1.66667')),pp.info.join(' | '));
  assert.ok(prims(pp,'segment').some(s=>s.role==='aux'),'perpendicular drawn as auxiliary');

  const registry=registryWith('r = reta((0,0,0) + t*(1,0,0))','s = reta((0,1,1) + t*(0,1,0))','P = (0,3,4)');
  const rs=parseGeometryInput('distancia: r, s',{registry});
  assert.ok(rs.info.some(line=>line.startsWith('d(r, s) = 1')),rs.info.join(' | '));
  assert.ok(rs.info.some(line=>line.includes('reversas')));
  const ends=s=>[s.a,s.b].map(p=>p.map(c=>Math.round(c*1e9)/1e9+0).join(',')).sort().join(' ');
  assert.ok(prims(rs,'segment').some(s=>s.role==='aux'&&ends(s)==='0,0,0 0,0,1'),'common perpendicular from (0,0,0) to (0,0,1)');
  assert.ok(prims(rs,'point').length>=2,'feet of the common perpendicular');
  const pr=parseGeometryInput('distancia: P, r',{registry});
  assert.ok(pr.info.some(line=>line.startsWith('d(P, r) = 5')),pr.info.join(' | '));

  const planes=parseGeometryInput('distancia: z = 1, 2z = 8');
  assert.ok(planes.info.some(line=>line.includes('= 3')),planes.info.join(' | '));
  const points=parseGeometryInput('distancia: (0,0,0), (1,2,2)');
  assert.ok(points.info.some(line=>line.includes('= 3')),points.info.join(' | '));
  const def=parseGeometryInput('h = distancia((1,2,3), 2x - y + 2z = 1)');
  assert.ok(def.definitions.some(d=>d.name==='h'&&d.kind==='scalar'&&Math.abs(d.value-5/3)<1e-9));
});

// ── Angles and relative positions ─────────────────────────────────────────

test('angleBetween', ()=>{
  close(angleBetween(plane([0,0,1],0),plane([1,0,1],0)),45);
  close(angleBetween(line([0,0,0],[1,0,0]),line([0,0,0],[-1,1,0])),45);
  close(angleBetween(line([0,0,0],[0,0,1]),plane([0,0,1],0)),90);
  close(angleBetween(line([0,0,0],[1,0,0]),plane([0,0,1],0)),0);
  close(angleBetween(plane([0,0,1],0),line([0,0,0],[1,0,1])),45);
});

test('relativePosition', ()=>{
  const r=line([0,0,0],[1,0,0]), s=line([0,1,1],[0,1,0]);
  assert.equal(relativePosition(r,s),'reversas');
  assert.equal(relativePosition(r,line([2,-1,0],[0,1,0])),'concorrentes');
  assert.equal(relativePosition(r,line([0,1,0],[3,0,0])),'paralelas');
  assert.equal(relativePosition(r,line([4,0,0],[1,0,0])),'coincidentes');
  assert.equal(relativePosition(line([0,0,0],[1,1,1]),plane([1,1,1],3)),'fura');
  assert.equal(relativePosition(line([0,0,0],[1,-1,0]),plane([1,1,1],3)),'paralela');
  assert.equal(relativePosition(plane([1,1,1],3),line([3,0,0],[1,-1,0])),'contida');
  assert.equal(relativePosition(plane([1,1,1],1),plane([1,-1,0],0)),'concorrentes');
  assert.equal(relativePosition(plane([1,1,1],1),plane([2,2,2],5)),'paralelos');
  assert.equal(relativePosition(plane([1,1,1],1),plane([2,2,2],2)),'coincidentes');
});

test('angulo: and posicao: commands', ()=>{
  const registry=registryWith('p1 = plano(z = 0)','p2 = plano(x + z = 0)','vetor: u=(1,0,0)','vetor: w=(1,1,0)');
  const a=parseGeometryInput('angulo: p1, p2',{registry});
  assert.equal(a.type,'angle');
  assert.equal(a.dim,3);
  assert.ok(a.info.some(line=>line.includes('45°')),a.info.join(' | '));
  const uv=parseGeometryInput('angulo: u, w',{registry});
  assert.ok(uv.info.some(line=>line.includes('45°')),uv.info.join(' | '));
  const tri=parseGeometryInput('angulo: (1,0,0), (0,0,0), (0,0,1)');
  assert.ok(tri.info.some(line=>line.includes('90°')),tri.info.join(' | '));

  const pos=parseGeometryInput('posicao: (0,0,0) + t*(1,0,0), (0,1,1) + t*(0,1,0)');
  assert.equal(pos.type,'position');
  assert.equal(pos.dim,3);
  assert.ok(pos.info.some(line=>line.includes('reversas')),pos.info.join(' | '));
  const fura=parseGeometryInput('posição: (0,0,0) + t*(1,1,1), x + y + z = 3');
  assert.ok(fura.info.some(line=>line.includes('fura')));
  assert.ok(prims(fura,'point').some(p=>p.role==='main'));
  const planes=parseGeometryInput('position: p1, p2',{registry});
  assert.ok(planes.info.some(line=>line.includes('concorrentes')));
});

// ── Routing and 2D lines ──────────────────────────────────────────────────

test('2D reta, intersecao, distancia and angulo keep their 2D results', ()=>{
  const r=parseGeometryInput('reta: (0,0),(2,4)');
  assert.equal(r.type,'line');
  assert.equal('dim' in r,false);
  assert.equal(r.lines.length,1);
  const d=parseGeometryInput('dist: (0,0),(3,4)');
  assert.equal('dim' in d,false);
  assert.ok(d.info.includes('d(A, B) = 5'));
  const a=parseGeometryInput('angulo: (1,0),(0,0),(0,1)');
  assert.equal('dim' in a,false);
  assert.ok(a.info.includes('angulo = 90°'));
  const registry=registryWith('r = reta((0,0),(1,1))');
  const i=parseGeometryInput('intersecao: r; line((0,4),(4,0))',{registry});
  assert.equal('dim' in i,false);
  assert.deepEqual(i.points.map(p=>[p.x,p.y]),[[2,2]]);
  // Equations without z stay 2D lines.
  const eq=parseGeometryInput('intersecao: x + y = 1; x - y = 0');
  assert.equal('dim' in eq,false);
  assert.deepEqual(eq.points.map(p=>[p.x,p.y]),[[0.5,0.5]]);
  // A 2D vector named z keeps the 2D angle.
  const vecs=registryWith('z = vetor((0,0),(1,0))','w = vetor((0,0),(0,1))');
  const zw=parseGeometryInput('angulo: z; w',{registry:vecs});
  assert.equal('dim' in zw,false);
  assert.ok(zw.info.includes('angulo = 90°'));
  assert.equal(wants3d('distance','(1,2,3), x + y + z = 1',{}),true);
  assert.equal(wants3d('distance','(1,2), (3,4)',{}),false);
  assert.equal(wants3d('plane','x - y = 0',{}),true);
});

// ── Task 2 review follow-ups ──────────────────────────────────────────────

test('ponto(...) with three items: named points stay a list, other items are coordinates', ()=>{
  const registry=registryWith('ponto: A=(0,0), B=(3,4), C=(1,1)');
  const list=parseGeometryInput('G = ponto(A,B,C)',{registry});
  assert.equal(list.type,'point');
  assert.equal('dim' in list,false,'a list of 2D points stays 2D');
  assert.deepEqual(list.points.map(p=>p.label),['A','B','C']);

  const registry3=registryWith('ponto: A=(1,0,0), B=(0,1,0), C=(0,0,1)');
  const list3=parseGeometryInput('G = ponto(A,B,C)',{registry:registry3});
  assert.equal(list3.dim,3);
  assert.deepEqual(list3.points.map(p=>p.label),['A','B','C']);

  // Not all items are points: coordinates, with A and B read as the sliders a
  // and b (same rule as the 2D Q = ponto(A,B)).
  const mixed=parseGeometryInput('P = ponto(A,B,3)',{registry,params:{a:2,b:5}});
  assert.equal(mixed.type,'point');
  assert.equal(mixed.dim,3);
  assert.deepEqual(prims(mixed,'point')[0].p,[2,5,3]);

  const sliders=parseGeometryInput('S = ponto(a,b,c)',{params:{a:1,b:-2,c:4}});
  assert.equal(sliders.dim,3);
  assert.deepEqual(prims(sliders,'point')[0].p,[1,-2,4]);
  assert.ok(sliders.definitions.some(d=>d.name==='S'&&d.value.dim===3));
});

test('vetor: u=(1,2,3) registers u for later lines', ()=>{
  const registry=registryWith('vetor: u=(1,2,3)');
  const u=registry.get('u');
  assert.equal(u.kind,'vector');
  assert.equal(u.value.dim,3);
  assert.equal(involves3d('u',{registry}),true);
  const r=parseGeometryInput('reta: P=(0,0,0), u',{registry});
  closeVec(r.definitions.find(d=>d.kind==='line3').value.v,[1,2,3]);
});

test('unknown names and wrong object kinds give Portuguese errors', ()=>{
  const registry=registryWith('vetor: u=(1,2,3)');
  const missing=parseGeometryInput('posicao: r9, x + y + z = 1');
  assert.equal(missing.type,'error');
  assert.match(missing.error,/nome desconhecido|não definido/);
  const bad=parseGeometryInput('posicao: u, x + y + z = 1',{registry});
  assert.equal(bad.type,'error');
  const one=parseGeometryInput('intersecao: x + y + z = 1, (1,2,3)');
  assert.equal(one.type,'error');
});

// ── CR3: infinite lines and planes are clipped by the visible box ─────────

test('visibleBox covers the viewport at the current scale, centered on the target, at least ±5', ()=>{
  const view={width:400,height:300};   // half-diagonal 250 px
  assert.deepEqual(visibleBox(createCamera({scale:50}),view),{min:[-5,-5,-5],max:[5,5,5]});
  assert.deepEqual(visibleBox(createCamera({scale:12.5}),view),{min:[-20,-20,-20],max:[20,20,20]});
  assert.deepEqual(visibleBox(createCamera({scale:500}),view),{min:[-5,-5,-5],max:[5,5,5]},'never smaller than ±5');
  const moved=visibleBox(createCamera({scale:25,target:[1,2,3]}),view);
  assert.deepEqual(moved,{min:[-9,-8,-7],max:[11,12,13]});
});

test('plane z = 0 grows with the zoom: corners near ±5 at zoom 1 and ±20 at zoom 0.25', ()=>{
  const r=parseGeometryInput('plano: z = 0');
  const view={width:400,height:300};
  const extent=scale=>{
    const cam=createCamera({...presetView('xy'),scale});
    const poly=buildDrawList(r.scene3d,cam,view).find(i=>i.kind==='polygon');
    // Top view: world x = (screen x − W/2)/scale.
    return Math.max(...poly.points.map(q=>Math.abs((q.x-view.width/2)/scale)));
  };
  close(extent(50),5,1e-6);
  close(extent(12.5),20,1e-6);
});

test('parsing does not depend on the view', ()=>{
  const a=parseGeometryInput('plano: z = 0');
  const b=parseGeometryInput('plano: z = 0',{box:{min:[-50,-50,-50],max:[50,50,50]}});
  assert.deepEqual(a,b);
  assert.deepEqual(a.scene3d,[{kind:'plane',n:[0,0,1],d:0,alpha:0.25,role:'main',label:'π'}]);
  assert.equal(a.info.some(line=>line.includes('caixa')),false);
});

test('buildDrawList skips a line that misses the box and bad infinite primitives without throwing', ()=>{
  const cam=createCamera(), view={width:400,height:300};
  assert.deepEqual(buildDrawList([{kind:'line',p:[100,100,100],v:[1,0,0],label:'r'}],cam,view),[]);
  assert.deepEqual(buildDrawList([{kind:'plane',n:[0,0,1],d:100,label:'π'}],cam,view),[]);
  assert.deepEqual(buildDrawList([{kind:'line',p:[0,0,0],v:[0,0,0]},{kind:'plane',n:[0,0,0],d:1},{kind:'plane',n:[NaN,0,1],d:0}],cam,view),[]);
  const persp=createCamera({projection:'perspective',distance:3});
  const items=buildDrawList([{kind:'plane',n:[0,0,1],d:0},{kind:'line',p:[0,0,0],v:[1,1,0]}],persp,view);
  assert.ok(items.every(i=>JSON.stringify(i,(k,v)=>k==='source'?undefined:v).match(/null|NaN/)===null));
});

test('line style (color, width, dash, labels) applies to plane and line primitives', ()=>{
  const eq=text=>({kind:'geometry',visible:true,text,geometry:parseGeometryInput(text),lw:3,style:'dashed'});
  const prims3=scenePrimitives([eq('plano: z = 0'),eq('reta: (0,0,0) + t*(1,0,0)')],{colorOf:()=>'#c00'});
  const pl=prims3.find(p=>p.kind==='plane'), ln=prims3.find(p=>p.kind==='line');
  assert.equal(pl.color,'#c00');
  assert.equal(pl.alpha,0.25);
  assert.equal(ln.color,'#c00');
  assert.equal(ln.weight,3);
  assert.equal(ln.dash,true);
  const items=buildDrawList(prims3,createCamera(),{width:400,height:300});
  assert.ok(items.some(i=>i.kind==='polygon'&&i.color==='#c00'));
  assert.ok(items.some(i=>i.kind==='segment'&&i.color==='#c00'&&i.weight===3&&i.dash));
  assert.deepEqual(items.filter(i=>i.kind==='label').map(i=>i.text).sort(),['r','π']);
  const hidden=scenePrimitives([{...eq('plano: z = 0'),showGeoLabels:false}],{colorOf:()=>'#c00'});
  assert.equal(buildDrawList(hidden,createCamera(),{width:400,height:300}).some(i=>i.kind==='label'),false);
});
