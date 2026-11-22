import test from 'node:test';
import assert from 'node:assert/strict';
import { createCamera, orbit, zoomCamera, panCamera, presetView, projectPoint, fitCameraScale, cameraBasis } from '../src/space3d/camera.js';
import { defaultBox, clipSegmentToBox, clipLineToBox, clipPlaneToBox, pointInBox, axesPrimitives } from '../src/space3d/scene3d.js';
import { buildDrawList, drawScene3d, colorsFromTheme } from '../src/space3d/render3d.js';

const close = (a, b, tol = 1e-9) => assert.ok(Math.abs(a-b) <= tol, `${a} ≉ ${b}`);
const vp = {width:400, height:300};
const topView = () => createCamera(presetView('xy'));

test('camera defaults, orbit clamp, zoom and immutability', () => {
  const cam = createCamera();
  assert.equal(cam.azimuth, -60); assert.equal(cam.elevation, 25);
  assert.equal(cam.projection, 'ortho'); assert.deepEqual(cam.target, [0,0,0]);
  assert.equal(orbit(cam, 0, 200).elevation, 89);
  assert.equal(orbit(cam, 0, -200).elevation, -89);
  close(orbit(cam, 400, 0).azimuth, -20);
  assert.equal(zoomCamera(cam, 2).scale, cam.scale*2);
  assert.equal(cam.elevation, 25, 'orbit/zoom do not mutate');
  assert.ok(zoomCamera(cam, 0).scale > 0 && zoomCamera(cam, NaN).scale === cam.scale);
  assert.deepEqual(presetView('xz'), {azimuth:-90, elevation:0});
  assert.equal(presetView('nada'), null);
});

test('projectPoint: top view puts x right and y up; depth grows away from the viewer', () => {
  const cam = topView(), c = projectPoint(cam, [0,0,0], vp);
  close(c.x, 200); close(c.y, 150);
  const px = projectPoint(cam, [1,0,0], vp), py = projectPoint(cam, [0,1,0], vp);
  assert.ok(px.x > c.x); close(px.y, c.y);
  assert.ok(py.y < c.y); close(py.x, c.x);
  assert.ok(projectPoint(cam, [0,0,-1], vp).depth > projectPoint(cam, [0,0,1], vp).depth);
  const side = createCamera(presetView('xz')), up = projectPoint(side, [0,0,1], vp);
  assert.ok(up.y < 150); close(up.x, 200);
  const yz = createCamera(presetView('yz'));
  assert.ok(projectPoint(yz, [0,1,0], vp).x > 200);
});

test('perspective keeps the target scale and shrinks far points', () => {
  const ortho = createCamera(presetView('xz')), persp = {...ortho, projection:'perspective'};
  const near = projectPoint(persp, [1,-3,0], vp), far = projectPoint(persp, [1,3,0], vp);
  close(projectPoint(persp, [1,0,0], vp).x, projectPoint(ortho, [1,0,0], vp).x);
  assert.ok(near.x-200 > far.x-200 && far.x > 200);
  assert.ok(far.depth > near.depth);
});

test('panCamera moves the target so the scene follows the pointer', () => {
  const cam = topView(), moved = panCamera(cam, 40, 0);
  close(projectPoint(moved, [0,0,0], vp).x, 240, 1e-6);
  const down = panCamera(cam, 0, 30);
  close(projectPoint(down, [0,0,0], vp).y, 180, 1e-6);
  assert.deepEqual(cam.target, [0,0,0]);
});

test('fitCameraScale: the ±5 axes fill about 80–85% of the short side', () => {
  for (const vp of [{width:390, height:500}, {width:1280, height:800}, {width:390, height:422}]) {
    const side = Math.min(vp.width, vp.height), s = fitCameraScale(vp);
    assert.ok(s*10 >= .8*side && s*10 <= .85*side, `${s*10} / ${side}`);
  }
});

test('clipPlaneToBox returns the ordered section or []', () => {
  const box = defaultBox(), sq = clipPlaneToBox([0,0,1], 0, box);
  assert.equal(sq.length, 4);
  for (const p of sq) { close(p[2], 0); close(Math.abs(p[0]), 5); close(Math.abs(p[1]), 5); }
  for (let i = 0; i < 4; i++) { // consecutive corners share a side (ordered, not crossed)
    const a = sq[i], b = sq[(i+1)%4];
    assert.ok(a[0] === b[0] || a[1] === b[1]);
  }
  assert.deepEqual(clipPlaneToBox([0,0,1], 9, box), []);
  assert.equal(clipPlaneToBox([0,0,1], 5, box).length, 4, 'face of the box');
  assert.equal(clipPlaneToBox([1,1,1], 0, box).length, 6, 'hexagonal section');
  assert.deepEqual(clipPlaneToBox([0,0,0], 1, box), [], 'null normal');
  assert.deepEqual(clipPlaneToBox([NaN,0,1], 0, box), []);
  assert.deepEqual(clipPlaneToBox([1,1,1], 15, box), [], 'touches a single corner');
});

test('segment and line clipping, including objects outside the box', () => {
  const box = defaultBox();
  assert.equal(clipLineToBox([20,20,20], [1,0,0], box), null);
  assert.equal(clipLineToBox([0,0,0], [0,0,0], box), null);
  const s = clipSegmentToBox([0,0,0], [10,0,0], box);
  assert.deepEqual(s[0], [0,0,0]); close(s[1][0], 5);
  assert.equal(clipSegmentToBox([6,0,0], [9,0,0], box), null);
  assert.equal(clipSegmentToBox([0,0,0], [NaN,0,0], box), null);
  const l = clipLineToBox([1,2,3], [0,0,2], box);
  close(l[0][2], -5); close(l[1][2], 5); close(l[0][0], 1);
  const diag = clipLineToBox([0,0,0], [1,1,1], box);
  diag.flat().forEach(c => close(Math.abs(c), 5));
  assert.equal(pointInBox([1,2,3], box), true);
  assert.equal(pointInBox([1e9,0,0], box), false);
});

test('axesPrimitives: three axes, names and integer marks', () => {
  const prims = axesPrimitives(defaultBox());
  const texts = prims.filter(p => p.kind === 'label').map(p => p.text);
  for (const t of ['x','y','z','1','-5','5']) assert.ok(texts.includes(t), t);
  const axes = prims.filter(p => p.kind === 'segment' && p.role === 'axis');
  assert.equal(axes.length, 3);
  const ticks = prims.filter(p => p.role === 'tick');
  assert.ok(ticks.length >= 30);
  assert.ok(ticks.every(p => [0,1,2].includes(p.axis) && Number.isFinite(p.value) && p.step === 1));
  assert.ok(prims.every(p => ['axis','tick','grid'].includes(p.role)));
  const grid=axesPrimitives(defaultBox(), {grid:true}).filter(p => p.role === 'grid');
  assert.deepEqual(new Set(grid.map(p=>p.gridPlane)),new Set(['xy','xz','yz']));
  assert.ok(axesPrimitives(defaultBox()).every(p => p.role !== 'grid'));
});

test('axesPrimitives can show every integer mark and number when requested',()=>{
  const box={min:[-15,-15,-15],max:[15,15,15]};
  const automatic=axesPrimitives(box).filter(p=>p.role==='tick');
  assert.ok(automatic.every(p=>p.step===5));
  const complete=axesPrimitives(box,{axisTickStep:'1'}).filter(p=>p.role==='tick');
  assert.ok(complete.every(p=>p.step===1&&p.showEveryTick));
  for(const axis of [0,1,2]){
    const values=complete.filter(p=>p.axis===axis&&p.kind==='label').map(p=>p.value);
    assert.deepEqual(values,Array.from({length:31},(_,i)=>i-15).filter(value=>value!==0));
  }
});

test('buildDrawList sorts surfaces back to front, lines among them and labels last', () => {
  const sq = z => [[-1,-1,z],[1,-1,z],[1,1,z],[-1,1,z]];
  const prims = [
    {kind:'label', p:[0,0,0], text:'origem'},
    {kind:'polygon', points:sq(1), alpha:.2, id:'top'},
    {kind:'segment', a:[-1,0,0], b:[1,0,0], id:'mid'},
    {kind:'polygon', points:sq(-1), alpha:.2, id:'bottom'},
    {kind:'point', p:[0,0,2], label:'A'},
  ];
  const list = buildDrawList(prims, topView(), vp);
  const order = list.map(i => i.kind === 'label' ? 'label:'+i.text : i.source.id ?? i.kind);
  assert.deepEqual(order, ['bottom','mid','top','point','label:origem','label:A']);
  assert.equal(list[0].points.length, 4);
  assert.deepEqual(buildDrawList(prims, topView(), vp), list, 'deterministic');
});

test('buildDrawList splits meshes into faces and drops non-finite primitives', () => {
  const mesh = {kind:'mesh', vertices:[[0,0,-1],[1,0,-1],[1,1,-1],[0,1,-1],[0,0,1],[1,0,1],[1,1,1]], faces:[[4,5,6],[0,1,2,3]], alpha:.3};
  const list = buildDrawList([mesh, {kind:'point', p:[NaN,0,0]}, {kind:'segment', a:[0,0,0], b:[Infinity,0,0]}], topView(), vp);
  assert.equal(list.length, 2);
  assert.deepEqual(list.map(i => i.points.length), [4,3]);
  assert.ok(list.every(i => i.kind === 'polygon' && i.mesh));
  assert.deepEqual(buildDrawList(null, topView(), vp), []);
});

test('buildDrawList skips geometry behind a perspective camera', () => {
  const cam = {...topView(), projection:'perspective', distance:10};
  const list = buildDrawList([{kind:'point', p:[0,0,20]}, {kind:'point', p:[0,0,0]}], cam, vp);
  assert.equal(list.length, 1);
});

const cross = (a, b) => [a[1]*b[2]-a[2]*b[1], a[2]*b[0]-a[0]*b[2], a[0]*b[1]-a[1]*b[0]];

test('iso preset is a right-handed view with z up', () => {
  const cam = createCamera(presetView('iso')), {right, up, forward} = cameraBasis(cam);
  cross(right, up).forEach((c, i) => close(c, forward[i], 1e-12));
  const o = projectPoint(cam, [0,0,0], vp), x = projectPoint(cam, [1,0,0], vp), y = projectPoint(cam, [0,1,0], vp), z = projectPoint(cam, [0,0,1], vp);
  close(z.x, o.x, 1e-9); assert.ok(z.y < o.y, 'z up');
  assert.ok(x.x < o.x && x.y > o.y, 'x toward lower left');
  assert.ok(y.x > o.x && y.y > o.y, 'y toward lower right');
  // screen orientation of (x, y) is counter-clockwise seen from +z (z points at the viewer side)
  const sx = [x.x-o.x, -(x.y-o.y)], sy = [y.x-o.x, -(y.y-o.y)];
  assert.ok(sx[0]*sy[1]-sx[1]*sy[0] > 0);
});

test('orbit direction: +azimuth turns xz into yz, +elevation rises toward the top view', () => {
  const xz = createCamera(presetView('xz'));
  close(orbit(xz, 90, 0).azimuth, presetView('yz').azimuth);
  assert.equal(orbit(xz, 0, 10).elevation, 10);
  const cam = orbit(createCamera(presetView('yz')), 0, 89), top = projectPoint(cam, [0,0,1], vp);
  close(top.x, 200, 1e-9); assert.ok(top.depth < 0, 'camera above: +z is nearer');
});

test('projectPoint flags points behind a perspective eye', () => {
  const cam = {...topView(), projection:'perspective', distance:10};
  assert.equal(projectPoint(cam, [0,0,20], vp).behind, true);
  assert.equal(projectPoint(cam, [0,0,9.9], vp).behind, true, 'inside the near plane');
  assert.equal(projectPoint(cam, [0,0,5], vp).behind, undefined);
  assert.equal(projectPoint({...cam, projection:'ortho'}, [0,0,20], vp).behind, undefined);
});

test('clipPlaneToBox orders oblique sections and drops slivers', () => {
  const box = defaultBox(), onFace = p => [0,1,2].filter(i => Math.abs(Math.abs(p[i])-5) < 1e-9);
  for (const [n, d] of [[[1,1,1], 0], [[1,2,3], 1], [[1,-2,.5], 3], [[0,1,1], 2]]) {
    const poly = clipPlaneToBox(n, d, box);
    assert.ok(poly.length >= 3, String(n));
    poly.forEach((p, i) => {
      const q = poly[(i+1)%poly.length];
      assert.ok(onFace(p).some(k => onFace(q).includes(k) && Math.sign(p[k]) === Math.sign(q[k])), `${p} → ${q} share a face`);
      close(n[0]*p[0]+n[1]*p[1]+n[2]*p[2], d, 1e-9);
    });
  }
  assert.deepEqual(clipPlaneToBox([1,1,0], 9.9999999, box), []);
  assert.equal(clipPlaneToBox([1,1,0], 9.99, box).length, 4, 'thin but real section kept');
});

test('a segment lying on a polygon is drawn after it from any camera', () => {
  const plane = {kind:'polygon', points:clipPlaneToBox([0,0,1], 0, defaultBox()), alpha:.2, id:'plane'};
  const tilted = {kind:'polygon', points:clipPlaneToBox([1,2,3], 0, defaultBox()), alpha:.2, id:'tilted'};
  const xAxis = {kind:'segment', a:[-5,0,0], b:[5,0,0], id:'axis'};
  const onTilted = {kind:'segment', a:[-2,1,0], b:[2,-1,0], id:'onTilted'}; // through the centroid, n·X = 0
  let views = 0;
  for (let az = -180; az < 180; az += 7) for (let el = -89; el <= 89; el += 3) {
    for (const projection of ['ortho', 'perspective']) {
      const cam = createCamera({azimuth:az, elevation:el, projection});
      for (const [poly, seg] of [[plane, xAxis], [tilted, onTilted]]) {
        const ids = buildDrawList([seg, poly], cam, vp).map(i => i.source.id);
        assert.deepEqual(ids, [poly.id, seg.id], `az ${az} el ${el} ${projection}`);
      }
      views++;
    }
  }
  assert.ok(views > 1000);
});

test('perspective clips segments and polygons at the near plane instead of dropping them', () => {
  const cam = createCamera({projection:'perspective', distance:10}); // default az −60, el 25
  const [item] = buildDrawList([{kind:'segment', a:[0,-5,0], b:[0,-15,0]}], cam, vp);
  assert.ok(item, 'segment kept');
  const a = projectPoint(cam, [0,-5,0], vp);
  close(item.a.x, a.x, 1e-9); close(item.a.y, a.y, 1e-9);
  assert.ok([item.b.x, item.b.y].every(Number.isFinite));
  assert.ok(Math.hypot(item.b.x-item.a.x, item.b.y-item.a.y) > 1, 'shortened, not collapsed');
  const [arrow] = buildDrawList([{kind:'arrow', from:[0,-5,0], to:[0,-15,0]}], cam, vp);
  assert.equal(arrow.headless, true, 'no head at a clipped tip');
  const big = [[-20,-20,0],[20,-20,0],[20,20,0],[-20,20,0]];
  const [poly] = buildDrawList([{kind:'polygon', points:big, alpha:.2}], cam, vp);
  assert.ok(poly, 'polygon kept');
  assert.equal(poly.points.length, 5, 'one corner behind the eye is cut off');
  assert.ok(poly.points.flatMap(p => [p.x, p.y]).every(Number.isFinite));
  const mesh = {kind:'mesh', vertices:big, faces:[[0,1,2,3]], alpha:.3};
  assert.equal(buildDrawList([mesh], cam, vp).length, 1, 'mesh face kept');
  assert.deepEqual(buildDrawList([{kind:'segment', a:[20,-20,0], b:[22,-22,0]}], cam, vp), [], 'fully behind');
  const ortho = buildDrawList([{kind:'polygon', points:big, alpha:.2}], {...cam, projection:'ortho'}, vp);
  assert.equal(ortho[0].points.length, 4, 'ortho never clips');
});

function recorder() {
  const calls = [];
  const ctx = new Proxy({calls}, {
    get(target, k) {
      if (k in target) return target[k];
      if (k === 'measureText') return t => ({width:String(t).length*6});
      return (...args) => calls.push([k, ...args]);
    },
    set(target, k, v) { calls.push(['set:'+String(k), v]); return true; },
  });
  return ctx;
}

test('drawScene3d paints the draw list in order with theme and primitive colors', () => {
  const prims = [
    {kind:'polygon', points:[[-1,-1,-1],[1,-1,-1],[1,1,-1]], alpha:.25, color:'#c00'},
    {kind:'segment', a:[-1,0,0], b:[1,0,0], role:'aux'},
    {kind:'arrow', from:[0,0,0], to:[2,0,0], label:'u', color:'#00c'},
    {kind:'point', p:[0,0,1], label:'A'},
  ];
  const list = buildDrawList(prims, topView(), vp), ctx = recorder();
  const colors = colorsFromTheme(n => ({'--ink':'#111','--bg':'#fff','--axis':'#999'})[n]);
  drawScene3d(ctx, list, colors);
  const names = ctx.calls.map(c => c[0]);
  const idx = (name, from = 0) => names.indexOf(name, from);
  const firstFill = idx('fill'), firstStroke = idx('stroke');
  assert.ok(idx('moveTo') < idx('lineTo') && idx('lineTo') < firstFill, 'polygon path then fill');
  assert.ok(firstFill < firstStroke);
  assert.deepEqual(ctx.calls[idx('moveTo')].slice(1), [160, 190]);
  assert.ok(ctx.calls.some(c => c[0] === 'set:fillStyle' && c[1] === '#c00'));
  assert.ok(ctx.calls.some(c => c[0] === 'setLineDash' && c[1].length), 'aux role is dashed');
  const arrowStroke = ctx.calls.findIndex(c => c[0] === 'set:strokeStyle' && c[1] === '#00c');
  assert.ok(arrowStroke > firstStroke);
  assert.ok(idx('arc') > arrowStroke, 'point after arrow');
  const texts = ctx.calls.filter(c => c[0] === 'fillText').map(c => c[1]);
  assert.deepEqual(texts, ['u','A']);
  assert.ok(names.lastIndexOf('fillText') > idx('arc'), 'labels last');
  assert.equal(names.filter(n => n === 'save').length, names.filter(n => n === 'restore').length);
  assert.ok(ctx.calls.every(c => c.slice(1).every(v => typeof v !== 'number' || Number.isFinite(v))));
});

test('drawScene3d avoids stacking labels on the same spot', () => {
  const list = buildDrawList([{kind:'label', p:[0,0,0], text:'A'}, {kind:'label', p:[0,0,0], text:'B'}], topView(), vp);
  const ctx = recorder();
  drawScene3d(ctx, list, colorsFromTheme(() => ''));
  const [a, b] = ctx.calls.filter(c => c[0] === 'fillText');
  assert.notDeepEqual([a[2],a[3]], [b[2],b[3]]);
});

test('colorsFromTheme reads the style.css variables with fallbacks', () => {
  const c = colorsFromTheme(n => ({'--fg':'#111','--bg':'#fff'})[n]);
  for (const k of ['axis','grid','text','bg']) assert.ok(typeof c[k] === 'string' && c[k].length, k);
  assert.equal(c.text, '#111'); assert.equal(c.bg, '#fff');
  const dark = {'--bg':'#0d1017','--ink':'#e8ebf0','--axis':'#586273','--grid-major':'#222a34','--muted':'#9aa4b2'};
  const d = colorsFromTheme(n => dark[n] ? ' '+dark[n]+' ' : '');
  assert.deepEqual([d.axis, d.grid, d.text, d.bg, d.muted], ['#586273','#222a34','#e8ebf0','#0d1017','#9aa4b2']);
  assert.ok(colorsFromTheme(() => { throw new Error('sem DOM'); }).text);
});

test('Canvas: solveinfo 3×3 recorta os três planos ao alcance dos eixos e ancora os rótulos',async()=>{
  const {buildSystemScene3D}=await import('../src/linear-transform-view.js');
  const {scenePrimitives}=await import('../src/space3d/view3d.js');
  const system=buildSystemScene3D([[1,1,1],[2,-1,1],[1,2,-1]],[6,3,2],[1,2,3]);
  const eq={kind:'result',visible:true,error:false,showAlgebraSystem:true,systemScene3d:system};
  const prims=scenePrimitives([eq],{colorOf:()=> '#000000',box:defaultBox()});
  const cam=createCamera({azimuth:-60,elevation:25,scale:58});
  const viewport={width:1460,height:1000};
  const list=buildDrawList(prims,cam,viewport,{systemPlaneBox:defaultBox()});
  const patches=list.filter(p=>p.kind==='polygon'&&p.source.systemPlane);
  const labels=list.filter(p=>p.kind==='label'&&p.source.systemPlane);
  assert.equal(patches.length,3);
  assert.equal(labels.length,3);
  assert.equal(new Set(patches.map(p=>p.color)).size,3);
  for(const patch of patches){
    assert.ok(patch.points.length>=3);
    // With orthographic projection the centroid must fall within the patch's
    // screen-space bounding box, not out in the blank canvas.
    const label=labels.find(l=>l.source===patch.source);
    assert.ok(label);
    const xs=patch.points.map(p=>p.x),ys=patch.points.map(p=>p.y);
    assert.ok(label.x>=Math.min(...xs)-1e-8&&label.x<=Math.max(...xs)+1e-8);
    assert.ok(label.y>=Math.min(...ys)-1e-8&&label.y<=Math.max(...ys)+1e-8);
  }
  assert.equal(list.filter(p=>p.kind==='point'&&p.source.systemSolution).length,1);
  // Contrast with old viewport-dependent, much larger clipping.
  const old=buildDrawList(prims,cam,viewport).filter(p=>p.kind==='polygon'&&p.source.systemPlane);
  const area=p=>{const xs=p.points.map(v=>v.x),ys=p.points.map(v=>v.y);return (Math.max(...xs)-Math.min(...xs))*(Math.max(...ys)-Math.min(...ys));};
  assert.ok(patches.some((p,i)=>area(p)<area(old[i])*.8),'Planos de sistema não devem extrapolar os eixos');
});
