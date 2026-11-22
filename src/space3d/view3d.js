"use strict";

import { createCamera, orbit, zoomCamera, panCamera } from './camera.js';
import { defaultBox, clipLineToBox, clipSegmentToBox, guideLines } from './scene3d.js';
import { toVec3 } from './geometry3d.js';

// Glue between the app's equation rows and the pure 3D core: view mode rules
// (§5.1, §7a.10), the saved view3d state, the per-line scene with the line's
// color and role variants (§7a.5), 2D objects promoted to z = 0, and the
// camera gestures on the canvas.

const ORBIT_DEG_PER_PX = .4;
const FACE_ALPHA = .22;
const NOTICE_2D = 'objeto 3D: abra a vista 3D';
const NOTICE_3D = 'não aparece na vista 3D';

export function is3dEquation(eq) {
  return !!eq && eq.kind === 'geometry' && !eq.error && eq.geometry?.dim === 3;
}

// Rows of 3D points get the "guias" chip; guides are on unless turned off.
export function hasGuidesChip(eq) {
  return is3dEquation(eq) && eq.geometry.type === 'point';
}
export function showsGuides(eq) {
  return hasGuidesChip(eq) && eq.showGeoGuides !== false;
}

export const CAMERA_HINT = 'arraste para girar · Shift+arraste para mover · roda para zoom · duplo clique volta';

export function has3dObjects(equations = []) {
  return equations.some(eq => eq?.visible !== false && !eq?.error && (is3dEquation(eq) || (eq.showAlgebraSystem && eq.systemScene3d?.length) || (eq.showAlgebraTransform3d && eq.transformScene3d?.length)));
}

export function autoAxisLimit(equations = [], minimum = 5) {
  let extent = finitePos(minimum, 5);
  const include = point => {
    const values = Array.isArray(point)
      ? point
      : point && Number.isFinite(point.x) && Number.isFinite(point.y)
        ? [point.x, point.y, Number.isFinite(point.z) ? point.z : 0]
        : [];
    values.slice(0, 3).forEach(value => {
      if (Number.isFinite(value)) extent = Math.max(extent, Math.abs(value));
    });
  };
  const includeScene = primitive => {
    if (!primitive) return;
    if (primitive.kind === 'point' || primitive.kind === 'label') include(primitive.p);
    else if (primitive.kind === 'segment') { include(primitive.a); include(primitive.b); }
    else if (primitive.kind === 'arrow') { include(primitive.from); include(primitive.to); }
    else if (primitive.kind === 'polygon') (primitive.points || []).forEach(include);
    else if (primitive.kind === 'mesh') (primitive.vertices || []).forEach(include);
    else if (primitive.kind === 'line') include(primitive.p);
    else if (primitive.kind === 'plane' && Array.isArray(primitive.n)) {
      const norm2 = primitive.n.reduce((sum, value) => sum + value * value, 0);
      if (norm2 > 0 && Number.isFinite(primitive.d)) {
        include(primitive.n.map(value => value * primitive.d / norm2));
      }
    }
  };

  equations.forEach(eq => {
    if (!eq || eq.visible === false || eq.error) return;
    if(eq.showAlgebraSystem && eq.systemScene3d)eq.systemScene3d.forEach(includeScene);
    if(eq.showAlgebraTransform3d && eq.transformScene3d)eq.transformScene3d.forEach(includeScene);
    if(eq.kind!=='geometry')return;
    const geometry = eq.geometry;
    if (!geometry) return;
    (geometry.points || []).forEach(include);
    (geometry.segments || []).forEach(segment => { include(segment.a); include(segment.b); });
    (geometry.vectors || []).forEach(vector => { include(vector.from); include(vector.to); });
    (geometry.scene3d || []).forEach(includeScene);
  });

  if (extent <= minimum) return minimum;
  const target = Math.min(Number.MAX_SAFE_INTEGER, extent * 1.1);
  const roughStep = target / 5;
  const power = 10 ** Math.floor(Math.log10(roughStep));
  const step = [1, 2, 5, 10].map(value => value * power).find(value => value >= roughStep) || power * 10;
  return Math.max(minimum, Math.ceil(target / step - 1e-12) * step);
}

// The view switches to 3D only on the "no 3D object" → "some 3D object"
// transition; otherwise the current (possibly manual or saved) choice stays.
export function decideViewMode({previousHas3d, nowHas3d, current}) {
  if (nowHas3d && !previousHas3d) return '3d';
  return current === '3d' ? '3d' : '2d';
}

// 2D-only scenes of a row (algebra rows can carry a 2D transform/system scene).
function scene2dOf(eq) {
  if (eq.kind === 'geometry') return eq.geometry?.dim === 3 ? null : eq.geometry;
  if (eq.kind === 'result') return eq.transformScene || (eq.showAlgebraSystem ? eq.systemScene : null) || null;
  return null;
}

export function viewNotice(eq, mode) {
  if (!eq || eq.error || !String(eq.text ?? '').trim()) return '';
  if (mode === '3d') return scene2dOf(eq) || is3dEquation(eq) || (eq.showAlgebraSystem && eq.systemScene3d?.length) || (eq.showAlgebraTransform3d && eq.transformScene3d?.length) ? '' : NOTICE_3D;
  return is3dEquation(eq) ? NOTICE_2D : '';
}

const finitePos = (x, d) => Number.isFinite(x) && x > 0 ? x : d;

export function normalizeView3d(saved) {
  const s = saved && typeof saved === 'object' ? saved : {};
  const cam = s.camera && typeof s.camera === 'object' ? s.camera : {};
  const savedMode = s.mode === '3d' || s.mode === '2d';
  return {
    mode: s.mode === '3d' ? '3d' : '2d',
    savedMode,
    grid: s.grid === true,
    axisTickStep: s.axisTickStep === '1' ? '1' : 'auto',
    autoAxisRange: s.autoAxisRange !== false,
    axisRange: finitePos(s.axisRange, 5),
    camera: createCamera({azimuth:cam.azimuth, elevation:cam.elevation, distance:cam.distance, target:cam.target, projection:cam.projection}),
    zoom: finitePos(cam.zoom, 1),
  };
}

// The camera scale is saved relative to the scale that fits the box in the
// current viewport, so a reload on another screen keeps the same framing.
export function serializeView3d(view3d, fitScale) {
  const c = view3d.camera;
  const zoom = Number.isFinite(fitScale) && fitScale > 0 ? c.scale/fitScale : finitePos(view3d.zoom, 1);
  return {mode:view3d.mode === '3d' ? '3d' : '2d', grid:!!view3d.grid,
    axisTickStep:view3d.axisTickStep === '1' ? '1' : 'auto',
    autoAxisRange:view3d.autoAxisRange !== false, axisRange:finitePos(view3d.axisRange, 5), camera:{
    azimuth:c.azimuth, elevation:c.elevation, distance:c.distance, target:[...c.target], projection:c.projection,
    zoom:Number(zoom.toPrecision(12)),
  }};
}

// --- Scene -------------------------------------------------------------------

const v3 = p => toVec3(p);
const isDashed = style => style === 'dashed' || style === 'dotted';

function promote2d(g, box) {
  const prims = [];
  if (!g) return prims;
  const area = {min:[box.min[0], box.min[1]], max:[box.max[0], box.max[1]]};
  (g.polygons || []).forEach(poly => {
    if (poly?.points?.length >= 3) prims.push({kind:'polygon', points:poly.points.map(v3), role:'main'});
  });
  (g.conics || []).forEach(conic => {
    if (typeof conic?.implicitF !== 'function') return;
    for (const [a, b] of conicContour(conic, area)) prims.push({kind:'segment', a:[a[0], a[1], 0], b:[b[0], b[1], 0], role:'main', curve:true});
  });
  (g.lines || []).forEach(line => {
    const a = Number(line?.a), b = Number(line?.b), c = Number(line?.c), n2 = a*a+b*b;
    if (!Number.isFinite(n2) || n2 < 1e-24 || !Number.isFinite(c)) return;
    const seg = clipLineToBox([-c*a/n2, -c*b/n2, 0], [-b, a, 0], box);
    if (seg) prims.push({kind:'segment', a:seg[0], b:seg[1], role:line.style ? 'aux' : 'main'});
  });
  (g.segments || []).forEach(seg => {
    if (!seg?.a || !seg?.b) return;
    const s = clipSegmentToBox(v3(seg.a), v3(seg.b), box);
    if (s) prims.push({kind:'segment', a:s[0], b:s[1], role:seg.style ? 'aux' : 'main'});
  });
  (g.vectors || []).forEach(vec => {
    if (vec?.from && vec?.to) prims.push({kind:'arrow', from:v3(vec.from), to:v3(vec.to), label:vec.label, role:'main'});
  });
  if (g.type !== 'vector') (g.points || []).forEach(p => {
    if (p && Number.isFinite(p.x) && Number.isFinite(p.y)) prims.push({kind:'point', p:v3(p), label:p.label, role:'main'});
  });
  return prims;
}

// Contours are recomputed only when the conic object changes (recompile).
const contourCache = new WeakMap();
function conicContour(conic, area) {
  let segs = contourCache.get(conic);
  if (!segs) { segs = contourSegments(conic.implicitF, area, 64); contourCache.set(conic, segs); }
  return segs;
}

// Marching squares for f(x, y) = 0 on a rectangle; returns [[x,y],[x,y]] pairs.
export function contourSegments(f, area, n = 64) {
  const [x0, y0] = area.min, [x1, y1] = area.max, hx = (x1-x0)/n, hy = (y1-y0)/n;
  const val = (x, y) => { try { const v = f(x, y); return Number.isFinite(v) ? v : NaN; } catch { return NaN; } };
  const grid = [];
  for (let j = 0; j <= n; j++) { const row = []; for (let i = 0; i <= n; i++) row.push(val(x0+i*hx, y0+j*hy)); grid.push(row); }
  const out = [];
  const cross = (xa, ya, va, xb, yb, vb) => { const t = va/(va-vb); return [xa+t*(xb-xa), ya+t*(yb-ya)]; };
  for (let j = 0; j < n; j++) for (let i = 0; i < n; i++) {
    const xa = x0+i*hx, xb = xa+hx, ya = y0+j*hy, yb = ya+hy;
    const v = [grid[j][i], grid[j][i+1], grid[j+1][i+1], grid[j+1][i]];
    if (v.some(Number.isNaN)) continue;
    const c = [[xa, ya], [xb, ya], [xb, yb], [xa, yb]], hits = [];
    for (let k = 0; k < 4; k++) {
      const m = (k+1)%4;
      if ((v[k] < 0) !== (v[m] < 0)) hits.push(cross(c[k][0], c[k][1], v[k], c[m][0], c[m][1], v[m]));
    }
    if (hits.length === 2) out.push([hits[0], hits[1]]);
    else if (hits.length === 4) out.push([hits[0], hits[1]], [hits[2], hits[3]]);
  }
  return out;
}

// Copies each primitive with the line's color, width and dash, faces/planes
// semi-transparent, aux segments dashed (the renderer also lightens role aux).
function styled(prim, eq, color) {
  // Uma linha solveinfo contém três planos distintos. Preservar suas cores
  // especiais sem alterar a cor uniforme das demais figuras da Curva.
  const out = {...prim, color:prim.systemPlane||prim.systemSolution||prim.transform3d ? prim.color||color : color};
  if (eq.showGeoLabels === false) {
    if (prim.kind === 'label') return null;
    delete out.label;
  }
  // plane/line: infinite objects, clipped to the visible box by buildDrawList.
  if (prim.kind === 'polygon' || prim.kind === 'mesh' || prim.kind === 'plane') out.alpha = Number.isFinite(prim.alpha) ? prim.alpha : FACE_ALPHA;
  if (prim.kind === 'segment' || prim.kind === 'arrow' || prim.kind === 'line') {
    if (prim.role === 'aux') out.dash = true;
    else {
      if (!prim.weight && Number.isFinite(eq.lw) && eq.lw > 0) out.weight = eq.lw;
      if (prim.kind !== 'arrow' && isDashed(eq.style)) out.dash = true;
    }
  }
  return out;
}

export function scenePrimitives(equations = [], {colorOf = () => '', box = defaultBox()} = {}) {
  const prims = [];
  for (const eq of equations) {
    if (!eq || eq.visible === false || eq.error) continue;
    const source = eq.showAlgebraTransform3d && eq.transformScene3d ? eq.transformScene3d
      : eq.showAlgebraSystem && eq.systemScene3d ? eq.systemScene3d
      : is3dEquation(eq) ? eq.geometry.scene3d : promote2d(scene2dOf(eq), box);
    if (!Array.isArray(source) || !source.length) continue;
    const color = colorOf(eq), guides = showsGuides(eq);
    for (const prim of source) {
      const s = prim && styled(prim, eq, color);
      if (!s) continue;
      prims.push(s);
      // Depth cue for 3D points (not for vector tips: only point rows).
      if (guides && prim.kind === 'point') for (const g of guideLines(prim.p)) {
        const c = clipSegmentToBox(g.a, g.b, box);
        if (c) prims.push({...g, a:c[0], b:c[1], color});
      }
    }
  }
  return prims;
}

// --- Camera gestures -----------------------------------------------------------

// Drag = orbit (0.4°/px), Shift+drag or two fingers = pan, wheel/pinch = zoom,
// double click = default camera, arrows/+/− on the focused canvas. Every
// handler is a no-op while opts.isActive() is false (2D view). During a drag the
// camera carries dragging:true (coarser meshes, Task 9).
export function attachCameraControls(canvas, getCamera, setCamera, requestDraw, opts = {}) {
  const isActive = opts.isActive || (() => true);
  const commit = opts.onCommit || (() => {});
  const reset = opts.defaultCamera || (() => createCamera());
  const pointers = new Map();
  let pan = false, moved = false, pinch = null;
  const set = cam => { setCamera(cam); requestDraw(); };
  const setDragging = on => { const c = getCamera(); if (!!c.dragging !== on) setCamera({...c, target:[...c.target], dragging:on}); };
  const pair = () => { const [a, b] = [...pointers.values()]; return {d:Math.hypot(b.x-a.x, b.y-a.y), mx:(a.x+b.x)/2, my:(a.y+b.y)/2}; };

  canvas.addEventListener('pointerdown', e => {
    if (!isActive()) return;
    pointers.set(e.pointerId, {x:e.clientX, y:e.clientY});
    if (pointers.size === 1) { pan = !!e.shiftKey; moved = false; }
    // preventDefault on pointerdown suppresses the mousedown that would focus
    // the canvas, so focus it here for the arrow/+/− keys.
    try { canvas.focus?.({preventScroll:true, focusVisible:false}); } catch {}
    if (canvas.style) canvas.style.cursor = 'grabbing';
    if (pointers.size === 2) pinch = pair();
    try { canvas.setPointerCapture?.(e.pointerId); } catch {}
    e.preventDefault?.();
  });
  canvas.addEventListener('pointermove', e => {
    const p = pointers.get(e.pointerId);
    if (!p || !isActive()) return;
    const dx = e.clientX-p.x, dy = e.clientY-p.y;
    p.x = e.clientX; p.y = e.clientY;
    if (!dx && !dy) return;
    moved = true;
    setDragging(true);
    let cam = getCamera();
    if (pointers.size >= 2 && pinch) {
      const now = pair();
      if (pinch.d > 0 && now.d > 0) cam = zoomCamera(cam, now.d/pinch.d);
      cam = panCamera(cam, now.mx-pinch.mx, now.my-pinch.my);
      pinch = now;
    } else if (pan || e.shiftKey) cam = panCamera(cam, dx, dy);
    else cam = orbit(cam, -dx*ORBIT_DEG_PER_PX, dy*ORBIT_DEG_PER_PX);
    set(cam);
  });
  const end = e => {
    if (!pointers.has(e.pointerId)) return;
    pointers.delete(e.pointerId);
    try { canvas.releasePointerCapture?.(e.pointerId); } catch {}
    if (pointers.size < 2) pinch = null;
    if (pointers.size) return;
    if (canvas.style) canvas.style.cursor = 'grab';
    if (getCamera().dragging) { setDragging(false); requestDraw(); }
    if (moved) commit();
    moved = false;
  };
  canvas.addEventListener('pointerup', end);
  canvas.addEventListener('pointercancel', end);
  canvas.addEventListener('wheel', e => {
    if (!isActive()) return;
    e.preventDefault?.();
    set(zoomCamera(getCamera(), Math.pow(1.0015, -(e.deltaY || 0))));
    commit();
  }, {passive:false});
  canvas.addEventListener('dblclick', e => {
    if (!isActive()) return;
    e.preventDefault?.();
    set(reset());
    commit();
  });
  canvas.addEventListener('keydown', e => {
    if (!isActive() || e.ctrlKey || e.metaKey || e.altKey) return;
    const step = e.shiftKey ? 15 : 5, cam = getCamera();
    const next = {
      ArrowLeft: () => orbit(cam, step, 0), ArrowRight: () => orbit(cam, -step, 0),
      ArrowUp: () => orbit(cam, 0, step), ArrowDown: () => orbit(cam, 0, -step),
      '+': () => zoomCamera(cam, 1.2), '=': () => zoomCamera(cam, 1.2),
      '-': () => zoomCamera(cam, 1/1.2), '_': () => zoomCamera(cam, 1/1.2),
    }[e.key];
    if (!next) return;
    e.preventDefault?.();
    set(next());
    commit();
  });
}
