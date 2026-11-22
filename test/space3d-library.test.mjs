import assert from 'node:assert/strict';
import test from 'node:test';
import {
  init3DLibrarySelector,
  getActive3DLibrary,
  setActive3DLibrary,
  onActive3DLibraryChange,
  show3DLibrarySelector,
  hide3DLibrarySelector
} from '../src/space3d/library-manager.js';
import {
  primitivesToPlotlyData,
  cameraToPlotlyEye
} from '../src/space3d/plotly-renderer.js';
import { createCamera } from '../src/space3d/camera.js';

test('library manager defaults to default and switches to plotly', async () => {
  let notified = null;
  onActive3DLibraryChange((lib) => { notified = lib; });

  await setActive3DLibrary('plotly');
  assert.equal(getActive3DLibrary(), 'plotly');
  assert.equal(notified, 'plotly');

  await setActive3DLibrary('default');
  assert.equal(getActive3DLibrary(), 'default');
  assert.equal(notified, 'default');

  // Three.js is now a distinct WebGL renderer, not a Canvas alias.
  await setActive3DLibrary('threejs');
  assert.equal(getActive3DLibrary(), 'threejs');
  assert.equal(notified, 'threejs');
  await setActive3DLibrary('default');
  assert.equal(getActive3DLibrary(), 'default');
});

test('primitivesToPlotlyData converts points, segments, arrows and planes', () => {
  const prims = [
    { kind: 'point', p: [1, 2, 3], label: 'A', color: '#ff0000' },
    { kind: 'segment', a: [0, 0, 0], b: [1, 1, 1], color: '#00ff00', weight: 2 },
    { kind: 'segment', a: [1, 2, 3], b: [1, 2, 0], guide: true, color: '#999999' },
    { kind: 'arrow', from: [0, 0, 0], to: [2, 0, 0], label: 'u', color: '#0000ff' },
    { kind: 'plane', n: [0, 0, 1], d: 0, color: '#33aa33', alpha: 0.3 },
    { kind: 'segment', a: [0, 0, 0], b: [5, 0, 0], role: 'tick' }, // tick ignored
    { kind: 'segment', a: [0, 0, 0], b: [5, 0, 0], role: 'grid' }  // grid ignored
  ];

  const traces = primitivesToPlotlyData(prims, {
    range: 5,
    theme: 'light',
    box: { min: [-5, -5, -5], max: [5, 5, 5] }
  });

  // Verify traces created
  assert.ok(traces.length >= 5, `Expected at least 5 traces, got ${traces.length}`);

  // 1. Plane: mesh3d + boundary line
  const meshTrace = traces.find(t => t.type === 'mesh3d');
  assert.ok(meshTrace, 'Mesh3d trace for plane should exist');
  assert.equal(meshTrace.opacity, 0.3);

  // 2. Guide segment
  const guideTrace = traces.find(t => t.type === 'scatter3d' && t.line?.dash === 'dash');
  assert.ok(guideTrace, 'Guide trace should have dashed line');

  // 3. Arrow: shaft line and cone tip
  const arrowCone = traces.find(t => t.type === 'cone');
  assert.ok(arrowCone, 'Cone trace for arrow tip should exist');
  assert.deepEqual(arrowCone.x, [2]);

  // 4. Point trace
  const pointTrace = traces.find(t => t.type === 'scatter3d' && t.mode?.includes('markers') && t.name === 'A');
  assert.ok(pointTrace, 'Point marker trace should exist');
  assert.deepEqual(pointTrace.x, [1]);
  assert.deepEqual(pointTrace.y, [2]);
  assert.deepEqual(pointTrace.z, [3]);
  assert.equal(pointTrace.text?.[0], 'A');
  assert.equal(pointTrace.marker.size, 4, 'Point markers must stay discreet');
  assert.equal(pointTrace.marker.line.width, 0.5);
  assert.ok(pointTrace.hovertemplate.includes('%{x}'), 'Hovertemplate must include %{x}');
  assert.ok(pointTrace.hovertemplate.includes('%{y}'), 'Hovertemplate must include %{y}');
  assert.ok(pointTrace.hovertemplate.includes('%{z}'), 'Hovertemplate must include %{z}');

  // 5. Normal segment trace
  const segTrace = traces.find(t => t.type === 'scatter3d' && t.name === 'Reta' || t.name === 'Reta/Segmento');
  assert.ok(segTrace, 'Segment trace should exist');
});

test('cameraToPlotlyEye maps camera direction to 3D spherical eye', () => {
  const cam = createCamera({ azimuth: -60, elevation: 25 });
  const eyeData = cameraToPlotlyEye(cam);
  assert.ok(eyeData.eye, 'Eye object exists');
  assert.ok(Number.isFinite(eyeData.eye.x));
  assert.ok(Number.isFinite(eyeData.eye.y));
  assert.ok(Number.isFinite(eyeData.eye.z));
  assert.ok(eyeData.up, 'Up vector exists');
});

test('DOM visibility toggles with stub elements', async () => {
  const stubElements = new Map();
  const makeStub = (id) => ({
    id,
    style: {},
    hidden: false,
    value: 'default',
    addEventListener() {}
  });

  stubElements.set('cv', makeStub('cv'));
  stubElements.set('plotly-3d-container', makeStub('plotly-3d-container'));
  stubElements.set('three-3d-container', makeStub('three-3d-container'));
  stubElements.set('3d-library-selector', makeStub('3d-library-selector'));
  stubElements.set('3d-lib-select', makeStub('3d-lib-select'));

  globalThis.document = {
    getElementById: (id) => stubElements.get(id) || null
  };

  init3DLibrarySelector();

  // Test 2D mode: selector hidden, cv visible, plotly hidden
  hide3DLibrarySelector();
  assert.equal(stubElements.get('3d-library-selector').hidden, true);
  assert.equal(stubElements.get('cv').style.display, '');
  assert.equal(stubElements.get('plotly-3d-container').style.display, 'none');
  assert.equal(stubElements.get('three-3d-container').style.display, 'none');

  // Test 3D mode with default library: selector visible, cv visible
  show3DLibrarySelector();
  assert.equal(stubElements.get('3d-library-selector').hidden, false);
  assert.equal(stubElements.get('cv').style.display, '');
  assert.equal(stubElements.get('plotly-3d-container').style.display, 'none');
  assert.equal(stubElements.get('three-3d-container').style.display, 'none');

  // Changing to Three.js hides the Canvas and shows the WebGL container.
  setActive3DLibrary('threejs',{redraw:false});
  show3DLibrarySelector();
  assert.equal(stubElements.get('cv').style.display,'none');
  assert.equal(stubElements.get('three-3d-container').style.display,'block');

  await setActive3DLibrary('default',{redraw:false});
  show3DLibrarySelector();
  assert.equal(stubElements.get('cv').style.display,'');
  assert.equal(stubElements.get('three-3d-container').style.display,'none');
  delete globalThis.document;
});
