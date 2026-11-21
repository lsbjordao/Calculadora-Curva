"use strict";

// Pure orbital camera for the 3D view. Angles are in degrees. Every helper
// returns a new camera so the app can keep the previous one for undo/compare.
// Screen basis (right-handed): right = (-sin φ, cos φ, 0),
// up = (-sin θ cos φ, -sin θ sin φ, cos θ), toward viewer = (cos θ cos φ, cos θ sin φ, sin θ).

const RAD = Math.PI/180;
const clamp = (x, lo, hi) => Math.min(hi, Math.max(lo, x));
const finite = (x, fallback) => Number.isFinite(x) ? x : fallback;
const MIN_SCALE = 2, MAX_SCALE = 5000;

export const DEFAULT_CAMERA = Object.freeze({azimuth:-60, elevation:25, distance:30, target:Object.freeze([0,0,0]), projection:'ortho', scale:40});

export function createCamera(opts = {}) {
  const d = DEFAULT_CAMERA, o = opts || {};
  const target = Array.isArray(o.target) && o.target.length === 3 && o.target.every(Number.isFinite) ? [...o.target] : [...d.target];
  return {
    azimuth: normalizeAzimuth(finite(o.azimuth, d.azimuth)),
    // ±90 is allowed here so presetView('xy') gives an exact top view; orbit()
    // stops at ±89 so dragging never flips the up vector through the pole.
    elevation: clamp(finite(o.elevation, d.elevation), -90, 90),
    distance: Math.max(1, finite(o.distance, d.distance)),
    target,
    projection: o.projection === 'perspective' ? 'perspective' : 'ortho',
    scale: clamp(finite(o.scale, d.scale), MIN_SCALE, MAX_SCALE),
  };
}

function normalizeAzimuth(a) { const r = ((a+180)%360+360)%360-180; return r === -180 ? 180 : r; }

export function orbit(camera, dAzimuth, dElevation) {
  return {...camera, target:[...camera.target],
    azimuth: normalizeAzimuth(camera.azimuth+finite(dAzimuth, 0)),
    elevation: clamp(camera.elevation+finite(dElevation, 0), -89, 89)}; // see createCamera
}

export function zoomCamera(camera, factor) {
  const f = Number.isFinite(factor) && factor > 0 ? factor : 1;
  return {...camera, target:[...camera.target], scale: clamp(camera.scale*f, MIN_SCALE, MAX_SCALE)};
}

export function cameraBasis(camera) {
  const a = camera.azimuth*RAD, e = camera.elevation*RAD;
  const ca = Math.cos(a), sa = Math.sin(a), ce = Math.cos(e), se = Math.sin(e);
  return {right:[-sa, ca, 0], up:[-se*ca, -se*sa, ce], forward:[ce*ca, ce*sa, se]};
}

// dx, dy in screen pixels (y grows downward): the scene follows the pointer.
export function panCamera(camera, dx, dy) {
  const {right, up} = cameraBasis(camera), s = camera.scale;
  const mx = finite(dx, 0)/s, my = finite(dy, 0)/s;
  return {...camera, target: camera.target.map((t, i) => t-mx*right[i]+my*up[i])};
}

const PRESETS = {xy:{azimuth:-90, elevation:90}, xz:{azimuth:-90, elevation:0}, yz:{azimuth:0, elevation:0}, iso:{azimuth:45, elevation:35.264}};
export function presetView(name) { return PRESETS[name] ? {...PRESETS[name]} : null; }

// Pixels per unit so that the axes (the box's largest half-extent, plus 20% for
// the axis names past the tips) fill about 82% of the viewport's short side in
// any orientation. The box corners may leave the screen; the axes never do.
export const FIT_AXIS_ROOM = 1.2;
export function fitCameraScale(viewport, box = {min:[-5,-5,-5], max:[5,5,5]}, margin = .98) {
  const r = FIT_AXIS_ROOM*Math.max(...box.max.map((m, i) => (m-box.min[i])/2)) || 1;
  const side = Math.min(viewport.width, viewport.height);
  return clamp(side*margin/(2*r), MIN_SCALE, MAX_SCALE);
}

// Returns {x, y, depth}; larger depth = farther from the viewer. With perspective,
// points closer than the near plane (see nearDepth) get `behind: true`; their x, y
// are meaningless and must not be drawn (buildDrawList clips to that plane first).
// Perspective near plane: smallest drawable depth (eye at depth = −distance).
export const NEAR_FRACTION = .02;
export function nearDepth(camera) { return camera.distance*(NEAR_FRACTION-1); }

export function projectPoint(camera, p, viewport, basis = cameraBasis(camera)) {
  const {right, up, forward} = basis, t = camera.target;
  const rx = p[0]-t[0], ry = p[1]-t[1], rz = p[2]-t[2];
  const sx = rx*right[0]+ry*right[1]+rz*right[2];
  const sy = rx*up[0]+ry*up[1]+rz*up[2];
  const depth = -(rx*forward[0]+ry*forward[1]+rz*forward[2]);
  let k = camera.scale, behind = false;
  if (camera.projection === 'perspective') {
    if (depth <= nearDepth(camera)) behind = true;
    else k *= camera.distance/(camera.distance+depth);
  }
  const out = {x: viewport.width/2+sx*k, y: viewport.height/2-sy*k, depth};
  if (behind) out.behind = true;
  return out;
}
