"use strict";

// Pure 3D scene primitives and clipping against the view box. Primitives:
//   {kind:'point', p, label?}            {kind:'segment', a, b, dash?, weight?}
//   {kind:'arrow', from, to, label?}     {kind:'polygon', points, alpha}
//   {kind:'mesh', vertices, faces, alpha} {kind:'label', p, text}
// All accept role?: 'main' | 'aux' (aux = dashed/lighter) and color?; axes use
// role 'axis' and the optional 3-plane grid role 'grid' (theme colors).

const EPS = 1e-9;
const isVec = p => Array.isArray(p) && p.length === 3 && p.every(Number.isFinite);
const boxOk = box => box && isVec(box.min) && isVec(box.max);

export function defaultBox() { return {min:[-5,-5,-5], max:[5,5,5]}; }

export function pointInBox(p, box, tol = 1e-9) {
  return isVec(p) && boxOk(box) && p.every((c, i) => c >= box.min[i]-tol && c <= box.max[i]+tol);
}

// Liang–Barsky on the parameter interval [t0, t1] of p + t v.
function clipParam(p, v, box, t0, t1) {
  for (let i = 0; i < 3; i++) {
    if (Math.abs(v[i]) < EPS) {
      if (p[i] < box.min[i]-EPS || p[i] > box.max[i]+EPS) return null;
      continue;
    }
    let ta = (box.min[i]-p[i])/v[i], tb = (box.max[i]-p[i])/v[i];
    if (ta > tb) [ta, tb] = [tb, ta];
    if (ta > t0) t0 = ta;
    if (tb < t1) t1 = tb;
    if (t0 > t1) return null;
  }
  return [t0, t1];
}
const at = (p, v, t) => p.map((c, i) => c+t*v[i]);

export function clipSegmentToBox(a, b, box) {
  if (!isVec(a) || !isVec(b) || !boxOk(box)) return null;
  const v = b.map((c, i) => c-a[i]);
  if (v.every(c => Math.abs(c) < EPS)) return pointInBox(a, box) ? [[...a], [...b]] : null;
  const r = clipParam(a, v, box, 0, 1);
  if (!r) return null;
  return [r[0] === 0 ? [...a] : at(a, v, r[0]), r[1] === 1 ? [...b] : at(a, v, r[1])];
}

export function clipLineToBox(p, v, box) {
  if (!isVec(p) || !isVec(v) || !boxOk(box) || Math.hypot(...v) < EPS) return null;
  const r = clipParam(p, v, box, -Infinity, Infinity);
  if (!r || r[1]-r[0] < EPS) return null;
  return [at(p, v, r[0]), at(p, v, r[1])];
}

function boxEdges(box) {
  const {min, max} = box, c = (i, j, k) => [i ? max[0] : min[0], j ? max[1] : min[1], k ? max[2] : min[2]];
  const edges = [];
  for (let a = 0; a < 2; a++) for (let b = 0; b < 2; b++) edges.push([c(0,a,b), c(1,a,b)], [c(a,0,b), c(a,1,b)], [c(a,b,0), c(a,b,1)]);
  return edges;
}

// Convex polygon of n·X = d inside the box, ordered counter-clockwise around n; [] if it does not cut.
export function clipPlaneToBox(n, d, box) {
  if (!isVec(n) || !Number.isFinite(d) || !boxOk(box)) return [];
  const len = Math.hypot(...n);
  if (len < EPS) return [];
  const u = n.map(c => c/len), off = d/len;
  const size = Math.max(...box.max.map((m, i) => m-box.min[i])) || 1, tol = 1e-9*size;
  // Same tolerance for "vertex on the plane" and for merging duplicate vertices.
  const pts = [], add = p => { if (!pts.some(q => Math.hypot(q[0]-p[0], q[1]-p[1], q[2]-p[2]) <= tol)) pts.push(p); };
  for (const [a, b] of boxEdges(box)) {
    const fa = u[0]*a[0]+u[1]*a[1]+u[2]*a[2]-off, fb = u[0]*b[0]+u[1]*b[1]+u[2]*b[2]-off;
    const za = Math.abs(fa) <= tol, zb = Math.abs(fb) <= tol;
    if (za) add([...a]);
    if (zb) add([...b]);
    if (!za && !zb && fa*fb < 0) { const t = fa/(fa-fb); add(a.map((c, i) => c+t*(b[i]-c))); }
  }
  if (pts.length < 3) return [];
  const centroid = [0,1,2].map(i => pts.reduce((s, p) => s+p[i], 0)/pts.length);
  const helper = Math.abs(u[0]) < .9 ? [1,0,0] : [0,1,0];
  const e1 = normalize(cross(helper, u)), e2 = cross(u, e1);
  const ang = p => { const r = p.map((c, i) => c-centroid[i]); return Math.atan2(dot(r, e2), dot(r, e1)); };
  const poly = pts.map(p => [p, ang(p)]).sort((x, y) => x[1]-y[1]).map(x => x[0]);
  // Drop zero-area slivers (plane grazing an edge): mean width = 2·area/perimeter.
  let area = 0, perimeter = 0;
  poly.forEach((p, i) => {
    const q = poly[(i+1)%poly.length], a = p.map((c, k) => c-centroid[k]), b = q.map((c, k) => c-centroid[k]);
    area += dot(cross(a, b), u)/2;
    perimeter += Math.hypot(q[0]-p[0], q[1]-p[1], q[2]-p[2]);
  });
  return 2*Math.abs(area)/perimeter < 1e-6*size ? [] : poly;
}
const dot = (a, b) => a[0]*b[0]+a[1]*b[1]+a[2]*b[2];
const cross = (a, b) => [a[1]*b[2]-a[2]*b[1], a[2]*b[0]-a[0]*b[2], a[0]*b[1]-a[1]*b[0]];
const normalize = a => { const l = Math.hypot(...a); return a.map(c => c/l); };

function tickStep(extent) {
  for (const s of [1, 2, 5, 10, 20, 50, 100, 200, 500, 1000]) if (extent/s <= 6) return s;
  return 10**Math.ceil(Math.log10(extent/6));
}

// Axes x, y, z through the origin (clamped to the box), names at the positive ends,
// integer marks and their numbers. Marks and numbers carry role 'tick' with
// {axis, value, step}, so buildDrawList can hide or thin them per axis on screen.
// opts.grid adds a dotted grid on the xy, xz and yz planes through the origin.
export function axesPrimitives(box = defaultBox(), opts = {}) {
  if (!boxOk(box)) box = defaultBox();
  const prims = [], names = ['x','y','z'];
  const origin = [0,1,2].map(i => Math.min(box.max[i], Math.max(box.min[i], 0)));
  const size = Math.max(...box.max.map((m, i) => m-box.min[i]));
  const tick = size*.015;
  for (let i = 0; i < 3; i++) {
    const a = [...origin], b = [...origin];
    a[i] = box.min[i]; b[i] = box.max[i];
    prims.push({kind:'segment', a, b, role:'axis', weight:1.4});
    const tip = [...b]; tip[i] += size*.04;
    prims.push({kind:'label', p:tip, text:names[i], role:'axis', axisName:true});
    const across = i === 0 ? 1 : 0;
    const forcedUnitStep = opts.axisTickStep === '1';
    const span = box.max[i]-box.min[i];
    const step = forcedUnitStep
      ? Math.max(1, Math.ceil(span/2000))
      : tickStep(Math.max(Math.abs(box.min[i]), Math.abs(box.max[i])));
    const showEveryTick = forcedUnitStep && step === 1;
    for (let k = Math.ceil(box.min[i]/step)*step; k <= box.max[i]+1e-9; k += step) {
      if (Math.abs(k) < 1e-9) continue;
      const m = [...origin]; m[i] = k;
      const t0 = [...m], t1 = [...m];
      t0[across] -= tick; t1[across] += tick;
      const value = Number(k.toPrecision(12)), meta = {role:'tick', tick:true, axis:i, value, step, showEveryTick};
      prims.push({kind:'segment', a:t0, b:t1, ...meta});
      const lp = [...m]; lp[across] -= tick*4;
      prims.push({kind:'label', p:lp, text:String(value), ...meta});
    }
  }
  if (opts.grid) {
    const addGridPlane = (u, v, plane) => {
      const extent = Math.max(Math.abs(box.min[u]), Math.abs(box.max[u]), Math.abs(box.min[v]), Math.abs(box.max[v]));
      const step = tickStep(extent);
      for (let k = Math.ceil(box.min[u]/step)*step; k <= box.max[u]+1e-9; k += step) {
        if (Math.abs(k) < 1e-9) continue;
        const a=[...origin], b=[...origin];
        a[u]=b[u]=k; a[v]=box.min[v]; b[v]=box.max[v];
        prims.push({kind:'segment',a,b,role:'grid',gridPlane:plane});
      }
      for (let k = Math.ceil(box.min[v]/step)*step; k <= box.max[v]+1e-9; k += step) {
        if (Math.abs(k) < 1e-9) continue;
        const a=[...origin], b=[...origin];
        a[v]=b[v]=k; a[u]=box.min[u]; b[u]=box.max[u];
        prims.push({kind:'segment',a,b,role:'grid',gridPlane:plane});
      }
    };
    addGridPlane(0,1,'xy');
    addGridPlane(0,2,'xz');
    addGridPlane(1,2,'yz');
  }
  return prims;
}

// Depth cue for a 3D point P = (x, y, z): dashed aux segments P → (x, y, 0) and,
// from that foot, to (x, 0, 0) and (0, y, 0). A guide that would have zero length
// (a coordinate is 0) is left out, so points on a plane or axis get fewer, shorter
// guides and the origin gets none.
export function guideLines(p) {
  if (!isVec(p)) return [];
  const [x, y, z] = p, foot = [x, y, 0], out = [];
  const add = (a, b) => { if (a.some((c, i) => Math.abs(c-b[i]) > EPS)) out.push({kind:'segment', a, b, role:'aux', dash:true, guide:true}); };
  add([...p], foot);
  add([...foot], [x, 0, 0]);
  add([...foot], [0, y, 0]);
  return out;
}
