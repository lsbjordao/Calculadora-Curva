"use strict";

/**
 * Plotly.js 3D renderer for Calculadora Curva
 * Provides an interactive 3D visualization alternative using Plotly.js
 */

import { clipLineToBox, clipPlaneToBox } from './scene3d.js';
import { cameraBasis } from './camera.js';

let currentPlotlyScene = null;
const FONT_FAMILY = 'system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Arial, sans-serif';

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
      eye: { x: 1.65, y: 1.65, z: 1.35 },
      up: { x: 0, y: 0, z: 1 },
      center: { x: 0, y: 0, z: 0 }
    };
  }
  const basis = cameraBasis(camera);
  const { forward, up } = basis;
  const dist = 2.35;
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
  const defaultObjColor = isDark ? '#f97316' : '#ea580c';
  const axisLineColor = themeColors.axis || (isDark ? 'rgba(255,255,255,0.45)' : 'rgba(0,0,0,0.45)');

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
              color: prim.color || (isDark ? '#38bdf8' : '#0284c7'),
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
        if (prim.role !== 'tick' && Array.isArray(prim.p)) {
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
      const color = toColor(s.color, isDark ? '#38bdf8' : '#0284c7');
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
      const color = toColor(s.color, isDark ? '#38bdf8' : '#0284c7');
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

  // 2. Guide lines (dotted / dashed lines to coordinate planes)
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
        color: isDark ? 'rgba(255, 255, 255, 0.45)' : 'rgba(0, 0, 0, 0.4)',
        width: 1.5,
        dash: 'dash'
      },
      hoverinfo: 'skip',
      showlegend: false
    });
  }

  // 3. Lines and Segments
  for (const seg of linesAndSegments) {
    const isAxis = seg.role === 'axis';
    const color = toColor(seg.color, isAxis ? axisLineColor : defaultObjColor);
    data.push({
      type: 'scatter3d',
      mode: 'lines',
      x: [seg.a[0], seg.b[0]],
      y: [seg.a[1], seg.b[1]],
      z: [seg.a[2], seg.b[2]],
      line: {
        color: color,
        width: seg.weight ? seg.weight * 1.5 : (isAxis ? 2 : 3),
        dash: seg.dash ? 'dash' : 'solid'
      },
      name: seg.label || (isAxis ? 'Eixo' : 'Reta'),
      hoverinfo: isAxis ? 'skip' : 'name+x+y+z',
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
      mode: 'lines',
      x: [from[0], to[0]],
      y: [from[1], to[1]],
      z: [from[2], to[2]],
      line: { color: color, width: 4 },
      hoverinfo: 'skip',
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
        sizeref: 0.2,
        anchor: 'tip',
        showscale: false,
        colorscale: [[0, color], [1, color]],
        hoverinfo: 'skip'
      });
    }

    // Interactive hover marker & label at vector tip
    data.push({
      type: 'scatter3d',
      mode: arr.label ? 'markers+text' : 'markers',
      x: [to[0]],
      y: [to[1]],
      z: [to[2]],
      text: arr.label ? [arr.label] : undefined,
      textposition: 'top center',
      textfont: {
        color: color,
        size: 13,
        family: FONT_FAMILY
      },
      marker: {
        size: 4,
        color: color,
        opacity: 0.05
      },
      name: arr.label || 'Vetor',
      hovertemplate: (
        (arr.label ? `<b>${arr.label}</b> (vetor)<br>` : '<b>Vetor</b><br>') +
        `x: %{x}<br>y: %{y}<br>z: %{z}<extra></extra>`
      ),
      showlegend: false
    });
  }

  // 5. Points (with on-hover spikes and coordinate tooltip)
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
      textfont: {
        color: color,
        size: 13,
        family: FONT_FAMILY
      },
      marker: {
        size: pt.role === 'aux' ? 3 : 4,
        color: color,
        opacity: 0.95,
        line: {
          color: isDark ? '#ffffff' : '#000000',
          width: 0.5
        }
      },
      name: pt.label || 'Ponto',
      hovertemplate: (
        (pt.label ? `<b>${pt.label}</b><br>` : '<b>Ponto</b><br>') +
        `x: %{x}<br>y: %{y}<br>z: %{z}<extra></extra>`
      ),
      showlegend: false
    });
  }

  // 6. Other scene labels
  for (const lb of labels) {
    if (lb.axisName || lb.role === 'axis') continue;
    data.push({
      type: 'scatter3d',
      mode: 'text',
      x: [lb.p[0]],
      y: [lb.p[1]],
      z: [lb.p[2]],
      text: [lb.text],
      textposition: 'top center',
      textfont: {
        color: defaultObjColor,
        size: 12,
        family: FONT_FAMILY
      },
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

  // Use the exact page background color so the 3D scene seamlessly matches the page
  const bgColor = options.colors?.bg || (isDark ? '#0d1017' : '#ffffff');
  const textColor = isDark ? '#e2e8f0' : '#1e293b';
  const tickColor = isDark ? '#94a3b8' : '#64748b';
  const gridColor = isDark ? 'rgba(255, 255, 255, 0.08)' : 'rgba(0, 0, 0, 0.07)';

  const data = primitivesToPlotlyData(primitives, options);

  const sceneCamera = cameraToPlotlyEye(options.camera);
  const projectionType = options.camera?.projection === 'ortho' ? 'orthographic' : 'perspective';

  const layout = {
    autosize: true,
    paper_bgcolor: bgColor,
    plot_bgcolor: bgColor,
    hovermode: 'closest',
    hoverlabel: {
      bgcolor: isDark ? '#1a202c' : '#ffffff',
      bordercolor: isDark ? '#4a5568' : '#cbd5e1',
      font: {
        family: FONT_FAMILY,
        size: 12,
        color: isDark ? '#f7fafc' : '#0f172a'
      }
    },
    modebar: {
      orientation: 'h',
      color: isDark ? 'rgba(255, 255, 255, 0.65)' : 'rgba(30, 41, 59, 0.65)',
      activecolor: isDark ? '#38bdf8' : '#0284c7'
    },
    font: {
      color: textColor,
      family: FONT_FAMILY,
      size: 11
    },
    margin: { l: 30, r: 30, t: 30, b: 30 },
    showlegend: false,
    scene: {
      aspectmode: 'cube',
      xaxis: {
        title: { text: '' },
        range: [-range, range],
        showbackground: false,
        backgroundcolor: bgColor,
        gridcolor: gridColor,
        gridwidth: 1,
        showzerolines: false,
        showgrid: showGrid,
        showspikes: true,
        spikesides: true,
        spikethickness: 2,
        spikecolor: isDark ? '#38bdf8' : '#0284c7',
        tickfont: { size: 10, color: tickColor, family: FONT_FAMILY }
      },
      yaxis: {
        title: { text: '' },
        range: [-range, range],
        showbackground: false,
        backgroundcolor: bgColor,
        gridcolor: gridColor,
        gridwidth: 1,
        showzerolines: false,
        showgrid: showGrid,
        showspikes: true,
        spikesides: true,
        spikethickness: 2,
        spikecolor: isDark ? '#4ade80' : '#16a34a',
        tickfont: { size: 10, color: tickColor, family: FONT_FAMILY }
      },
      zaxis: {
        title: { text: '' },
        range: [-range, range],
        showbackground: false,
        backgroundcolor: bgColor,
        gridcolor: gridColor,
        gridwidth: 1,
        showzerolines: false,
        showgrid: showGrid,
        showspikes: true,
        spikesides: true,
        spikethickness: 2,
        spikecolor: isDark ? '#c084fc' : '#9333ea',
        tickfont: { size: 10, color: tickColor, family: FONT_FAMILY }
      },
      annotations: [
        {
          showarrow: false,
          x: range * 0.97,
          y: 0,
          z: 0,
          text: '<b>x</b>',
          font: { size: 16, color: isDark ? '#38bdf8' : '#0284c7', family: FONT_FAMILY }
        },
        {
          showarrow: false,
          x: 0,
          y: range * 0.97,
          z: 0,
          text: '<b>y</b>',
          font: { size: 16, color: isDark ? '#4ade80' : '#16a34a', family: FONT_FAMILY }
        },
        {
          showarrow: false,
          x: 0,
          y: 0,
          z: range * 0.97,
          text: '<b>z</b>',
          font: { size: 16, color: isDark ? '#c084fc' : '#9333ea', family: FONT_FAMILY }
        }
      ],
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
      height: 1080,
      width: 1920,
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
