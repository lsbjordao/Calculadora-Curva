"use strict";

/**
 * Plotly.js 3D renderer for Calculadora Curva
 * Provides an interactive 3D visualization alternative using Plotly.js
 */

import { clipLineToBox, clipPlaneToBox } from './scene3d.js';
import { cameraBasis } from './camera.js';

let currentPlotlyScene = null;

/**
 * Convert color input to valid hex/rgb color string
 */
function toColor(color, fallback = '#2d70b3') {
  if (!color) return fallback;
  if (typeof color === 'string') {
    if (color.startsWith('var(')) return fallback;
    return color;
  }
  if (typeof color === 'number') {
    return '#' + color.toString(16).padStart(6, '0');
  }
  return fallback;
}

/**
 * Converts camera state to Plotly scene eye and up vectors
 */
export function cameraToPlotlyEye(camera) {
  if (!camera) {
    return {
      eye: { x: 1.6, y: 1.6, z: 1.3 },
      up: { x: 0, y: 0, z: 1 },
      center: { x: 0, y: 0, z: 0 }
    };
  }
  const basis = cameraBasis(camera);
  const { forward, up } = basis;
  const dist = 2.2;
  return {
    eye: {
      x: forward[0] * dist,
      y: forward[1] * dist,
      z: forward[2] * dist
    },
    up: {
      x: up[0],
      y: up[1],
      z: up[2]
    },
    center: { x: 0, y: 0, z: 0 }
  };
}

/**
 * Transforms an array of 3D primitives into Plotly traces
 * @param {Array} primitives - Array of primitives from axesPrimitives and scenePrimitives
 * @param {Object} options - { range, box, theme, colors }
 * @returns {Array} Array of Plotly trace objects
 */
export function primitivesToPlotlyData(primitives, options = {}) {
  const data = [];
  const range = Number.isFinite(options.range) && options.range > 0 ? options.range : 5;
  const box = options.box || { min: [-range, -range, -range], max: [range, range, range] };
  const themeColors = options.colors || {};
  const isDark = options.theme === 'dark';
  const defaultObjColor = isDark ? '#4ea8de' : '#2d70b3';
  const axisLineColor = themeColors.axis || (isDark ? '#808793' : '#4b5563');

  if (!Array.isArray(primitives)) return data;

  const points = [];
  const linesAndSegments = [];
  const guideSegments = [];
  const arrows = [];
  const surfaces = [];
  const labels = [];

  for (const prim of primitives) {
    if (!prim || typeof prim !== 'object') continue;

    // Skip tick marks and numbers (Plotly handles axis ticks natively)
    if (prim.role === 'tick') continue;

    // Skip 3D grid plane segments (Plotly handles grid walls natively)
    if (prim.role === 'grid') continue;

    switch (prim.kind) {
      case 'point': {
        if (Array.isArray(prim.p) && prim.p.length === 3) {
          points.push(prim);
        }
        break;
      }
      case 'arrow': {
        if (Array.isArray(prim.from) && Array.isArray(prim.to)) {
          arrows.push(prim);
        }
        break;
      }
      case 'segment': {
        if (Array.isArray(prim.a) && Array.isArray(prim.b)) {
          if (prim.guide || prim.role === 'aux') {
            guideSegments.push(prim);
          } else {
            linesAndSegments.push(prim);
          }
        }
        break;
      }
      case 'line': {
        if (Array.isArray(prim.p) && Array.isArray(prim.v)) {
          const cut = clipLineToBox(prim.p, prim.v, box);
          if (cut) {
            linesAndSegments.push({
              kind: 'segment',
              a: cut[0],
              b: cut[1],
              color: prim.color,
              weight: prim.weight,
              label: prim.label
            });
          }
        }
        break;
      }
      case 'plane': {
        if (Array.isArray(prim.n) && Number.isFinite(prim.d)) {
          const pts = clipPlaneToBox(prim.n, prim.d, box);
          if (pts && pts.length >= 3) {
            surfaces.push({
              kind: 'polygon',
              points: pts,
              color: prim.color || defaultObjColor,
              alpha: prim.alpha ?? 0.22,
              label: prim.label
            });
          }
        }
        break;
      }
      case 'polygon': {
        if (Array.isArray(prim.points) && prim.points.length >= 3) {
          surfaces.push(prim);
        }
        break;
      }
      case 'mesh': {
        if (Array.isArray(prim.vertices) && Array.isArray(prim.faces)) {
          surfaces.push(prim);
        }
        break;
      }
      case 'label': {
        if (!prim.axisName && prim.role !== 'axis' && Array.isArray(prim.p)) {
          labels.push(prim);
        }
        break;
      }
    }
  }

  // 1. Surfaces (Planes and Polygons)
  for (const s of surfaces) {
    if (s.kind === 'polygon' && s.points && s.points.length >= 3) {
      const pts = s.points;
      const k = pts.length;
      const color = toColor(s.color, defaultObjColor);
      const alpha = Number.isFinite(s.alpha) ? s.alpha : 0.22;

      // Triangulation fan from vertex 0
      const I = [], J = [], K = [];
      for (let j = 1; j < k - 1; j++) {
        I.push(0);
        J.push(j);
        K.push(j + 1);
      }

      data.push({
        type: 'mesh3d',
        x: pts.map(p => p[0]),
        y: pts.map(p => p[1]),
        z: pts.map(p => p[2]),
        i: I,
        j: J,
        k: K,
        color: color,
        opacity: alpha,
        name: s.label || 'Plano',
        hoverinfo: s.label ? 'name' : 'skip',
        showlegend: false
      });

      // Sharp boundary edge loop
      const loop = [...pts, pts[0]];
      data.push({
        type: 'scatter3d',
        mode: 'lines',
        x: loop.map(p => p[0]),
        y: loop.map(p => p[1]),
        z: loop.map(p => p[2]),
        line: { color: color, width: 2 },
        hoverinfo: 'skip',
        showlegend: false
      });
    } else if (s.kind === 'mesh' && s.vertices && s.faces) {
      const color = toColor(s.color, defaultObjColor);
      const alpha = Number.isFinite(s.alpha) ? s.alpha : 0.22;
      const I = [], J = [], K = [];
      for (const face of s.faces) {
        if (!Array.isArray(face) || face.length < 3) continue;
        for (let j = 1; j < face.length - 1; j++) {
          I.push(face[0]);
          J.push(face[j]);
          K.push(face[j + 1]);
        }
      }
      data.push({
        type: 'mesh3d',
        x: s.vertices.map(p => p[0]),
        y: s.vertices.map(p => p[1]),
        z: s.vertices.map(p => p[2]),
        i: I,
        j: J,
        k: K,
        color: color,
        opacity: alpha,
        name: s.label || 'Malha',
        hoverinfo: s.label ? 'name' : 'skip',
        showlegend: false
      });
    }
  }

  // 2. Guide lines (dashed)
  if (guideSegments.length > 0) {
    const gx = [], gy = [], gz = [];
    for (const g of guideSegments) {
      gx.push(g.a[0], g.b[0], null);
      gy.push(g.a[1], g.b[1], null);
      gz.push(g.a[2], g.b[2], null);
    }
    data.push({
      type: 'scatter3d',
      mode: 'lines',
      x: gx,
      y: gy,
      z: gz,
      line: {
        color: themeColors.muted || (isDark ? '#6b7280' : '#9ca3af'),
        width: 1.5,
        dash: 'dash'
      },
      hoverinfo: 'skip',
      showlegend: false
    });
  }

  // 3. Lines and Segments
  for (const seg of linesAndSegments) {
    const color = toColor(seg.color, seg.role === 'axis' ? axisLineColor : defaultObjColor);
    data.push({
      type: 'scatter3d',
      mode: 'lines',
      x: [seg.a[0], seg.b[0]],
      y: [seg.a[1], seg.b[1]],
      z: [seg.a[2], seg.b[2]],
      line: {
        color: color,
        width: seg.weight ? seg.weight * 1.5 : (seg.role === 'axis' ? 2 : 3),
        dash: seg.dash ? 'dash' : 'solid'
      },
      name: seg.label || (seg.role === 'axis' ? 'Eixo' : 'Reta'),
      hoverinfo: seg.label ? 'name' : (seg.role === 'axis' ? 'skip' : 'x+y+z'),
      showlegend: false
    });
  }

  // 4. Arrows (Vectors)
  for (const arr of arrows) {
    const color = toColor(arr.color, defaultObjColor);
    const from = arr.from, to = arr.to;
    const d = [to[0] - from[0], to[1] - from[1], to[2] - from[2]];
    const len = Math.hypot(...d);

    // Shaft
    data.push({
      type: 'scatter3d',
      mode: arr.label ? 'lines+text' : 'lines',
      x: [from[0], to[0]],
      y: [from[1], to[1]],
      z: [from[2], to[2]],
      text: arr.label ? ['', arr.label] : undefined,
      textposition: 'top center',
      line: { color: color, width: 3.5 },
      name: arr.label || 'Vetor',
      hoverinfo: arr.label ? 'name' : 'x+y+z',
      showlegend: false
    });

    // 3D Cone tip
    if (len > 1e-4) {
      data.push({
        type: 'cone',
        x: [to[0]],
        y: [to[1]],
        z: [to[2]],
        u: [d[0]],
        v: [d[1]],
        w: [d[2]],
        sizemode: 'scaled',
        sizeref: 0.18,
        anchor: 'tip',
        showscale: false,
        colorscale: [[0, color], [1, color]],
        hoverinfo: 'skip'
      });
    }
  }

  // 5. Points
  for (const pt of points) {
    const color = toColor(pt.color, defaultObjColor);
    data.push({
      type: 'scatter3d',
      mode: pt.label ? 'markers+text' : 'markers',
      x: [pt.p[0]],
      y: [pt.p[1]],
      z: [pt.p[2]],
      text: pt.label ? [pt.label] : undefined,
      textposition: 'top center',
      marker: {
        size: pt.role === 'aux' ? 4 : 6,
        color: color,
        opacity: 0.95
      },
      name: pt.label ? `${pt.label} = (${pt.p.map(c => Number(c.toFixed(2))).join(', ')})` : 'Ponto',
      hoverinfo: 'name+x+y+z',
      showlegend: false
    });
  }

  // 6. Explicit labels
  for (const lb of labels) {
    data.push({
      type: 'scatter3d',
      mode: 'text',
      x: [lb.p[0]],
      y: [lb.p[1]],
      z: [lb.p[2]],
      text: [lb.text],
      textposition: 'top center',
      hoverinfo: 'skip',
      showlegend: false
    });
  }

  return data;
}

/**
 * Render scene with Plotly 3D
 */
export async function renderPlotly3D(primitives, options = {}) {
  if (typeof window === 'undefined' || !window.Plotly) {
    return;
  }

  const container = document.getElementById('plotly-3d-container');
  if (!container) return;

  const theme = options.theme || 'light';
  const isDark = theme === 'dark';
  const range = Number.isFinite(options.range) && options.range > 0 ? options.range : 5;
  const showGrid = options.grid !== false;

  const bgColor = isDark ? '#101318' : '#ffffff';
  const paneBgColor = isDark ? '#161a22' : '#f5f7fa';
  const textColor = isDark ? '#e5e8ec' : '#1f242d';
  const gridColor = isDark ? '#262d3a' : '#e2e6eb';
  const zeroLineColor = isDark ? '#4b5563' : '#9ca3af';

  const data = primitivesToPlotlyData(primitives, options);

  const sceneCamera = cameraToPlotlyEye(options.camera);
  const projectionType = options.camera?.projection === 'ortho' ? 'orthographic' : 'perspective';

  const layout = {
    autosize: true,
    paper_bgcolor: bgColor,
    plot_bgcolor: bgColor,
    font: {
      color: textColor,
      family: 'var(--sans, system-ui, -apple-system, sans-serif)',
      size: 11
    },
    margin: { l: 0, r: 0, t: 0, b: 0 },
    showlegend: false,
    scene: {
      aspectmode: 'cube',
      xaxis: {
        title: { text: 'x', font: { size: 12, color: textColor } },
        range: [-range, range],
        backgroundcolor: paneBgColor,
        gridcolor: gridColor,
        showbackground: true,
        zerolinecolor: zeroLineColor,
        zerolinewidth: 2,
        showzerolines: true,
        showgrid: showGrid
      },
      yaxis: {
        title: { text: 'y', font: { size: 12, color: textColor } },
        range: [-range, range],
        backgroundcolor: paneBgColor,
        gridcolor: gridColor,
        showbackground: true,
        zerolinecolor: zeroLineColor,
        zerolinewidth: 2,
        showzerolines: true,
        showgrid: showGrid
      },
      zaxis: {
        title: { text: 'z', font: { size: 12, color: textColor } },
        range: [-range, range],
        backgroundcolor: paneBgColor,
        gridcolor: gridColor,
        showbackground: true,
        zerolinecolor: zeroLineColor,
        zerolinewidth: 2,
        showzerolines: true,
        showgrid: showGrid
      },
      camera: {
        ...sceneCamera,
        projection: { type: projectionType }
      }
    }
  };

  const config = {
    responsive: true,
    displayModeBar: true,
    displaylogo: false,
    modeBarButtonsToRemove: ['lasso2d', 'select2d'],
    toImageButtonOptions: {
      format: 'png',
      filename: 'curva-3d',
      height: 900,
      width: 1200,
      scale: 2
    }
  };

  try {
    if (container._fullLayout) {
      // Preserve existing manual camera orientation unless syncCamera was explicitly requested
      if (options.syncCamera !== true && container._fullLayout.scene?._scene?.camera) {
        delete layout.scene.camera;
      }
      await window.Plotly.react(container, data, layout, config);
    } else {
      await window.Plotly.newPlot(container, data, layout, config);
    }
    currentPlotlyScene = { data, layout, config };
  } catch (error) {
    console.warn('Plotly render3D error:', error);
  }
}

/**
 * Update Plotly camera preset or view settings
 */
export function updatePlotlyCamera(camera) {
  if (typeof window === 'undefined' || !window.Plotly) return;
  const container = document.getElementById('plotly-3d-container');
  if (!container || !container._fullLayout) return;

  const sceneCamera = cameraToPlotlyEye(camera);
  const projectionType = camera?.projection === 'ortho' ? 'orthographic' : 'perspective';

  try {
    window.Plotly.relayout(container, {
      'scene.camera': {
        ...sceneCamera,
        projection: { type: projectionType }
      }
    });
  } catch (error) {
    console.warn('Plotly camera relayout error:', error);
  }
}

/**
 * Resize Plotly container
 */
export function resizePlotly3D() {
  if (typeof window === 'undefined' || !window.Plotly) return;
  const container = document.getElementById('plotly-3d-container');
  if (container && container._fullLayout) {
    try {
      window.Plotly.Plots.resize(container);
    } catch (_) {}
  }
}

/**
 * Clear Plotly scene
 */
export function clearPlotly3D() {
  if (typeof window === 'undefined' || !window.Plotly) return;
  const container = document.getElementById('plotly-3d-container');
  if (!container) return;

  try {
    window.Plotly.purge(container);
    container.innerHTML = '';
  } catch (_) {}
  currentPlotlyScene = null;
}

/**
 * Check if Plotly container is currently visible
 */
export function isPlotlyVisible() {
  if (typeof document === 'undefined') return false;
  const container = document.getElementById('plotly-3d-container');
  return !!container && container.style.display !== 'none';
}

/**
 * Set Plotly container visibility
 */
export function setPlotlyVisible(visible) {
  if (typeof document === 'undefined') return;
  const container = document.getElementById('plotly-3d-container');
  if (container) {
    container.style.display = visible ? 'block' : 'none';
  }
}
