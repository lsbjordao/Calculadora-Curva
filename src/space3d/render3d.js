"use strict";

import { cameraBasis, projectPoint } from './camera.js';

// Painter's algorithm on Canvas 2D. buildDrawList is pure: it projects the
// primitives, sorts surfaces (polygons and mesh faces) back to front by centroid
// depth, places segments/arrows/points among them by mean depth (ties: surface
// first, so an edge lying on a plane stays on top) and appends every label last.

const finiteVec = p => Array.isArray(p) && p.length === 3 && p.every(Number.isFinite);

export function buildDrawList(primitives, camera, viewport) {
  if (!Array.isArray(primitives) || !camera || !viewport) return [];
  const basis = cameraBasis(camera), body = [], labels = [];
  const proj = p => {
    if (!finiteVec(p)) return null;
    const q = projectPoint(camera, p, viewport, basis);
    return q.behind || !Number.isFinite(q.x) || !Number.isFinite(q.y) ? null : q;
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
  const surface = (prim, qs, extra) => {
    if (!qs || qs.length < 3) return;
    body.push({...style(prim), kind:'polygon', points:qs.map(xy), depth:meanDepth(qs), surface:true, alpha:prim.alpha ?? .18, ...extra});
  };

  for (const prim of primitives) {
    if (!prim || typeof prim !== 'object') continue;
    switch (prim.kind) {
      case 'point': {
        const q = proj(prim.p); if (!q) break;
        body.push({...style(prim), kind:'point', x:q.x, y:q.y, depth:q.depth});
        pushLabel(prim, q, prim.label, {anchor:'point'});
        break;
      }
      case 'segment': case 'arrow': {
        const a = proj(prim.kind === 'arrow' ? prim.from : prim.a), b = proj(prim.kind === 'arrow' ? prim.to : prim.b);
        if (!a || !b) break;
        const item = {...style(prim), kind:prim.kind, a:xy(a), b:xy(b), depth:(a.depth+b.depth)/2};
        if (prim.dash) item.dash = true;
        if (prim.weight) item.weight = prim.weight;
        body.push(item);
        if (prim.kind === 'arrow') pushLabel(prim, {x:(a.x+b.x)/2, y:(a.y+b.y)/2, depth:item.depth}, prim.label, {anchor:'mid', dx:b.x-a.x, dy:b.y-a.y});
        break;
      }
      case 'polygon': surface(prim, projAll(prim.points)); break;
      case 'mesh': {
        const verts = Array.isArray(prim.vertices) ? prim.vertices.map(proj) : [];
        for (const face of prim.faces || []) {
          const qs = face.map(i => verts[i]);
          if (qs.every(Boolean)) surface(prim, qs, {mesh:true});
        }
        break;
      }
      case 'label': { const q = proj(prim.p); if (q) pushLabel(prim, q, prim.text); break; }
    }
  }
  // Stable: equal depth keeps surfaces before lines, then input order.
  const order = body.map((item, i) => [item, i]);
  order.sort((x, y) => (y[0].depth-x[0].depth) || ((x[0].surface ? 0 : 1)-(y[0].surface ? 0 : 1)) || (x[1]-y[1]));
  return [...order.map(x => x[0]), ...labels];
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
  if (item.role === 'axis') return colors.axis;
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
        if (item.kind === 'arrow') { ctx.setLineDash([]); drawArrowHead(ctx, item.a, item.b, color); }
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
      case 'label': drawLabel(ctx, item, item.role === 'axis' ? (item.axisName ? colors.axis : colors.muted) : color, colors, placed); break;
    }
    ctx.restore();
  }
}

// Labels get a background chip (like drawWorldLabel in app.js) and are nudged
// down/up a few times when they would cover an earlier label.
function drawLabel(ctx, item, color, colors, placed) {
  const small = item.role === 'axis' && !item.axisName;
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
