"use strict";

import { cameraBasis, projectPoint, nearDepth, visibleBox } from './camera.js';
import { clipLineToBox, clipPlaneToBox } from './scene3d.js';

// Painter's algorithm on Canvas 2D. buildDrawList is pure: it projects the
// primitives, sorts surfaces (polygons and mesh faces) back to front by centroid
// depth, places segments/arrows/points among them by mean depth and appends every
// label last. Depths within a tolerance relative to the scene size count as equal
// (float noise, e.g. an axis lying on the plane z = 0); on a tie surfaces come
// first, so an edge lying on a plane stays on top. With perspective, segments,
// polygons and mesh faces are clipped to the near plane instead of dropped.
// Infinite objects ({kind:'plane', n, d, alpha} with n·X = d, {kind:'line', p, v})
// are clipped here against opts.box, by default visibleBox(camera, viewport), so
// they follow the zoom; their label sits inside a smaller on-screen box.

const finiteVec = p => Array.isArray(p) && p.length === 3 && p.every(Number.isFinite);
const TIE = 1e-9;
const MIN_TICK_PX = 6, TICK_LABEL_PX = 28, THIN = [1, 2, 5, 10, 20, 50, 100];

export function buildDrawList(primitives, camera, viewport, opts = {}) {
  if (!Array.isArray(primitives) || !camera || !viewport) return [];
  const box = opts.box || visibleBox(camera, viewport);
  const labelHalf = .8*Math.min(viewport.width, viewport.height)/(2*camera.scale);
  const labelBox = labelHalf > 0 ? {min:camera.target.map(c => c-labelHalf), max:camera.target.map(c => c+labelHalf)} : box;
  const basis = cameraBasis(camera), body = [], labels = [], {forward} = basis, t = camera.target;
  // Keep a small margin inside the near plane so clipped vertices project finitely.
  const near = camera.projection === 'perspective' ? nearDepth(camera)+camera.distance*1e-6 : -Infinity;
  const depthOf = p => -((p[0]-t[0])*forward[0]+(p[1]-t[1])*forward[1]+(p[2]-t[2])*forward[2]);
  const lerp = (a, b, da, db) => { const k = (near-da)/(db-da); return a.map((c, i) => c+k*(b[i]-c)); };
  const proj = p => {
    if (!finiteVec(p)) return null;
    const q = projectPoint(camera, p, viewport, basis);
    return q.behind || !Number.isFinite(q.x) || !Number.isFinite(q.y) ? null : q;
  };
  const clipSeg = (a, b) => {
    if (!finiteVec(a) || !finiteVec(b)) return null;
    const da = depthOf(a), db = depthOf(b);
    if (da < near && db < near) return null;
    if (da >= near && db >= near) return [a, b, false];
    return da < near ? [lerp(a, b, da, db), b, false] : [a, lerp(a, b, da, db), true];
  };
  // Sutherland–Hodgman against depth >= near.
  const clipPoly = pts => {
    if (!Array.isArray(pts) || !pts.every(finiteVec)) return null;
    const ds = pts.map(depthOf);
    if (ds.every(d => d >= near)) return pts;
    const out = [];
    pts.forEach((p, i) => {
      const j = (i+1)%pts.length, q = pts[j], dp = ds[i], dq = ds[j];
      if (dp >= near) out.push(p);
      if ((dp >= near) !== (dq >= near)) out.push(lerp(p, q, dp, dq));
    });
    return out;
  };
  // Pixels per unit along each axis (at the target depth). Tick marks and numbers
  // of an axis that points at the viewer (< MIN_TICK_PX per unit) are hidden;
  // numbers are thinned to every 2nd, 5th, 10th… unit when closer than TICK_LABEL_PX.
  const ppu = [0,1,2].map(i => camera.scale*Math.hypot(basis.right[i], basis.up[i]));
  const tickVisible = prim => {
    if (prim.role !== 'tick' || !Number.isInteger(prim.axis)) return true;
    const step = prim.step > 0 ? prim.step : 1, px = ppu[prim.axis]*step;
    if (prim.showEveryTick) return true;
    if (ppu[prim.axis] < MIN_TICK_PX) return false;
    if (prim.kind !== 'label') return true;
    const every = THIN.find(m => px*m >= TICK_LABEL_PX) ?? Infinity;
    return Math.round(prim.value/step)%every === 0;
  };
  const projAll = ps => { const out = []; for (const p of ps || []) { const q = proj(p); if (!q) return null; out.push(q); } return out; };
  const meanDepth = qs => qs.reduce((s, q) => s+q.depth, 0)/qs.length;
  const xy = q => ({x:q.x, y:q.y});
  const style = prim => {
    const s = {source:prim, role:prim.role || 'main'};
    if (prim.color) s.color = prim.color;
    return s;
  };
  const pushLabel = (prim, q, text, extra = {}) => {
    if (text == null || text === '') return;
    labels.push({...style(prim), kind:'label', x:q.x, y:q.y, depth:q.depth, text:String(text), ...extra});
  };
  const surface = (prim, pts, extra) => {
    const qs = projAll(clipPoly(pts));
    if (!qs || qs.length < 3) return;
    body.push({...style(prim), kind:'polygon', points:qs.map(xy), depth:meanDepth(qs), surface:true, alpha:prim.alpha ?? .18, ...extra});
  };

  for (const prim of primitives) {
    if (!prim || typeof prim !== 'object' || !tickVisible(prim)) continue;
    switch (prim.kind) {
      case 'point': {
        const q = proj(prim.p); if (!q) break;
        body.push({...style(prim), kind:'point', x:q.x, y:q.y, depth:q.depth});
        pushLabel(prim, q, prim.label, {anchor:'point'});
        break;
      }
      case 'segment': case 'arrow': {
        const arrow = prim.kind === 'arrow', seg = clipSeg(arrow ? prim.from : prim.a, arrow ? prim.to : prim.b);
        const a = seg && proj(seg[0]), b = seg && proj(seg[1]);
        if (!a || !b) break;
        const item = {...style(prim), kind:prim.kind, a:xy(a), b:xy(b), depth:(a.depth+b.depth)/2};
        if (prim.dash) item.dash = true;
        if (prim.weight) item.weight = prim.weight;
        if (arrow && seg[2]) item.headless = true; // tip cut by the near plane
        body.push(item);
        if (arrow) pushLabel(prim, {x:(a.x+b.x)/2, y:(a.y+b.y)/2, depth:item.depth}, prim.label, {anchor:'mid', dx:b.x-a.x, dy:b.y-a.y});
        break;
      }
      case 'line': {
        if (!finiteVec(prim.p) || !finiteVec(prim.v)) break;
        const seg = clipLineToBox(prim.p, prim.v, box), cut = seg && clipSeg(seg[0], seg[1]);
        const a = cut && proj(cut[0]), b = cut && proj(cut[1]);
        if (!a || !b) break;
        const item = {...style(prim), kind:'segment', a:xy(a), b:xy(b), depth:(a.depth+b.depth)/2};
        if (prim.dash) item.dash = true;
        if (prim.weight) item.weight = prim.weight;
        body.push(item);
        const at = clipLineToBox(prim.p, prim.v, labelBox)?.[1], q = at && proj(at);
        pushLabel(prim, q || b, prim.label);
        break;
      }
      case 'plane': {
        if (!finiteVec(prim.n) || !Number.isFinite(prim.d)) break;
        const pts = clipPlaneToBox(prim.n, prim.d, box);
        if (pts.length < 3) break;
        const before = body.length;
        surface(prim, pts);
        if (body.length === before) break;
        const at = clipPlaneToBox(prim.n, prim.d, labelBox)[0], q = (at && proj(at)) || proj(pts[0]);
        if (q) pushLabel(prim, q, prim.label);
        break;
      }
      case 'polygon': surface(prim, prim.points); break;
      case 'mesh': {
        const verts = Array.isArray(prim.vertices) ? prim.vertices : [];
        for (const face of prim.faces || []) if (Array.isArray(face)) surface(prim, face.map(i => verts[i]), {mesh:true});
        break;
      }
      case 'label': { const q = proj(prim.p); if (q) pushLabel(prim, q, prim.text); break; }
    }
  }
  return [...sortBackToFront(body), ...labels];
}

// Depths are grouped into tie clusters (consecutive gaps <= tolerance relative to
// the scene's depth extent) so the order is transitive and deterministic. Inside a
// cluster: surfaces before lines/points, then input order.
function sortBackToFront(body) {
  if (!body.length) return [];
  const order = body.map((item, i) => ({item, i}));
  order.sort((x, y) => (y.item.depth-x.item.depth) || (x.i-y.i));
  const top = order[0].item.depth, bottom = order[order.length-1].item.depth;
  const eps = TIE*Math.max(1, top-bottom, Math.abs(top), Math.abs(bottom));
  let cluster = 0;
  order.forEach((o, k) => { if (k && order[k-1].item.depth-o.item.depth > eps) cluster++; o.cluster = cluster; });
  order.sort((x, y) => (x.cluster-y.cluster) || ((x.item.surface ? 0 : 1)-(y.item.surface ? 0 : 1)) || (x.i-y.i));
  return order.map(o => o.item);
}

const DEFAULTS = {axis:'#9aa1ab', grid:'#dde1e7', text:'#1a1d23', bg:'#ffffff', muted:'#727a86', edge:'#e4e7ec', font:'ui-monospace, Menlo, Consolas, monospace'};

// getVar(name) reads a CSS custom property (e.g. getComputedStyle(body).getPropertyValue).
export function colorsFromTheme(getVar) {
  const read = (...names) => {
    for (const n of names) {
      let v;
      try { v = getVar(n); } catch { v = ''; }
      v = v == null ? '' : String(v).trim();
      if (v) return v;
    }
    return '';
  };
  return {
    axis: read('--axis') || DEFAULTS.axis,
    grid: read('--grid-major', '--grid-minor') || DEFAULTS.grid,
    text: read('--ink', '--fg') || DEFAULTS.text,
    bg: read('--bg') || DEFAULTS.bg,
    muted: read('--muted') || DEFAULTS.muted,
    edge: read('--panel-edge') || DEFAULTS.edge,
    font: read('--mono') || DEFAULTS.font,
  };
}

function colorOf(item, colors) {
  if (item.color) return item.color;
  if (item.role === 'axis' || item.role === 'tick') return colors.axis;
  if (item.role === 'grid') return colors.grid;
  return colors.text;
}

function drawArrowHead(ctx, a, b, color) {
  const dx = b.x-a.x, dy = b.y-a.y, len = Math.hypot(dx, dy);
  if (len < 8) return;
  const ux = dx/len, uy = dy/len, size = 8;
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.moveTo(b.x, b.y);
  ctx.lineTo(b.x-ux*size-uy*size*.55, b.y-uy*size+ux*size*.55);
  ctx.lineTo(b.x-ux*size+uy*size*.55, b.y-uy*size-ux*size*.55);
  ctx.closePath();
  ctx.fill();
}

function labelPosition(item) {
  if (item.anchor === 'point') return [item.x+8, item.y-18];
  if (item.anchor === 'mid') {
    const len = Math.hypot(item.dx, item.dy) || 1;
    let nx = -item.dy/len, ny = item.dx/len;
    if (ny > 0) { nx = -nx; ny = -ny; }
    return [item.x+nx*16, item.y+ny*16];
  }
  return [item.x+4, item.y-7];
}

export function drawScene3d(ctx, drawList, colors = colorsFromTheme(() => '')) {
  const placed = [];
  for (const item of drawList || []) {
    const color = colorOf(item, colors), aux = item.role === 'aux';
    ctx.save();
    switch (item.kind) {
      case 'polygon': {
        ctx.beginPath();
        item.points.forEach((p, i) => i ? ctx.lineTo(p.x, p.y) : ctx.moveTo(p.x, p.y));
        ctx.closePath();
        ctx.fillStyle = color;
        ctx.globalAlpha = aux ? item.alpha*.6 : item.alpha;
        ctx.fill();
        ctx.strokeStyle = color;
        ctx.lineWidth = item.mesh ? .6 : 1.2;
        ctx.globalAlpha = item.mesh ? .35 : (aux ? .4 : .6);
        if (aux) ctx.setLineDash([4,3]);
        ctx.stroke();
        break;
      }
      case 'segment': case 'arrow': {
        ctx.strokeStyle = color;
        ctx.lineCap = 'round';
        ctx.lineWidth = item.weight || (item.kind === 'arrow' ? 2 : item.role === 'grid' ? .8 : 1.4);
        ctx.globalAlpha = aux ? .55 : item.role === 'grid' ? .7 : .9;
        if (aux || item.dash) ctx.setLineDash([5,4]);
        ctx.beginPath();
        ctx.moveTo(item.a.x, item.a.y);
        ctx.lineTo(item.b.x, item.b.y);
        ctx.stroke();
        if (item.kind === 'arrow' && !item.headless) { ctx.setLineDash([]); drawArrowHead(ctx, item.a, item.b, color); }
        break;
      }
      case 'point': {
        ctx.lineWidth = 2;
        ctx.fillStyle = color;
        ctx.strokeStyle = colors.bg;
        ctx.globalAlpha = aux ? .6 : 1;
        ctx.beginPath();
        ctx.arc(item.x, item.y, 4.5, 0, Math.PI*2);
        ctx.fill();
        ctx.stroke();
        break;
      }
      case 'label': drawLabel(ctx, item, item.role === 'tick' ? colors.muted : item.role === 'axis' ? colors.axis : color, colors, placed); break;
    }
    ctx.restore();
  }
}

// Labels get a background chip (like drawWorldLabel in app.js) and are nudged
// down/up a few times when they would cover an earlier label.
function drawLabel(ctx, item, color, colors, placed) {
  const small = item.role === 'tick';
  ctx.font = (small ? '10px ' : '10.5px ')+colors.font;
  ctx.textBaseline = 'top';
  ctx.textAlign = 'left';
  const h = small ? 12 : 15, pad = small ? 1 : 3;
  const w = Math.ceil(ctx.measureText ? ctx.measureText(item.text).width : item.text.length*6.5);
  let [x, y] = labelPosition(item);
  const hits = (yy) => placed.some(r => x < r.x+r.w && x+w > r.x && yy < r.y+r.h && yy+h > r.y);
  for (const shift of [0, h+2, -(h+2), 2*(h+2), -2*(h+2)]) if (!hits(y+shift)) { y += shift; break; }
  placed.push({x, y, w, h});
  if (!small) {
    ctx.fillStyle = colors.bg;
    ctx.globalAlpha = .85;
    ctx.fillRect(x-pad, y-pad, w+pad*2, h+pad*2);
    ctx.globalAlpha = 1;
  }
  ctx.fillStyle = color;
  ctx.fillText(item.text, x, y);
}
