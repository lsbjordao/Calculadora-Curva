import test from 'node:test';
import assert from 'node:assert/strict';
import { createCamera, orbit, zoomCamera, panCamera, presetView, projectPoint, fitCameraScale } from '../src/space3d/camera.js';
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

test('fitCameraScale fits the default box in the viewport', () => {
  const s = fitCameraScale({width:390, height:500});
  assert.ok(s > 0 && s*2*Math.sqrt(75) <= 390);
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
  const axes = prims.filter(p => p.kind === 'segment' && p.role === 'axis' && !p.tick);
  assert.equal(axes.length, 3);
  assert.ok(prims.filter(p => p.tick).length >= 30);
  assert.ok(prims.every(p => p.role === 'axis' || p.role === 'grid'));
  assert.ok(axesPrimitives(defaultBox(), {grid:true}).some(p => p.role === 'grid'));
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
