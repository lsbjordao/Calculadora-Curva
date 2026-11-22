"use strict";

/**
 * 3D Library Manager
 * Handles switching between custom Canvas 2D, Plotly.js and Three.js WebGL renderers
 */

import { renderPlotly3D, clearPlotly3D, resizePlotly3D, updatePlotlyCamera } from './plotly-renderer.js';
import { renderThree3D, clearThree3D, resizeThree3D, resetThree3DError } from './three-renderer.js';
export { updatePlotlyCamera };

let currentLibrary = 'default';
const libraryChangeCallbacks = [];

function getSavedLibrary() {
  if (typeof localStorage === 'undefined') return null;
  try {
    const saved = localStorage.getItem('3d-library-preference');
    if (saved === 'plotly' || saved === 'threejs') return saved;
    if (saved === 'default' || saved === 'native') return 'default';
  } catch (_) {}
  return null;
}

function setSavedLibrary(library) {
  if (typeof localStorage === 'undefined') return;
  try {
    localStorage.setItem('3d-library-preference', library);
  } catch (_) {}
}

/**
 * Initialize the 3D library selector
 */
export function init3DLibrarySelector() {
  if (typeof document === 'undefined') return;
  const selector = document.getElementById('3d-lib-select');
  const container = document.getElementById('3d-library-selector');
  if (!selector) return;

  // Restore saved preference
  const saved = getSavedLibrary();
  if (saved) {
    currentLibrary = saved;
    selector.value = saved;
  }

  // Handle changes
  selector.addEventListener('change', (e) => {
    setActive3DLibrary(e.target.value);
  });

  // Hidden initially until 3D mode is active
  if (container) {
    container.hidden = true;
  }
}

/**
 * Set the active 3D library
 * @param {string} library - 'default' (or legacy 'native'), 'plotly', 'threejs'
 * @param {Object} options - { redraw: boolean }
 */
export async function setActive3DLibrary(library, { redraw = true } = {}) {
  let normalized = library;
  if (normalized === 'native') normalized = 'default';

  if (normalized !== 'default' && normalized !== 'plotly' && normalized !== 'threejs') {
    console.warn('Biblioteca 3D desconhecida:', library);
    return;
  }

  if (normalized === currentLibrary) return;

  currentLibrary = normalized;
  setSavedLibrary(normalized);
  if(normalized==='threejs') resetThree3DError();

  const selector = typeof document !== 'undefined' && document.getElementById('3d-lib-select');
  if (selector && selector.value !== normalized) {
    selector.value = normalized;
  }

  updateVisibility('3d');

  if (redraw) {
    for (const callback of libraryChangeCallbacks) {
      try {
        await callback(normalized);
      } catch (error) {
        console.error('Erro no callback de biblioteca 3D:', error);
      }
    }
  }
}

/**
 * Register a callback for when the library changes
 * @param {Function} callback - Called with (library)
 */
export function onActive3DLibraryChange(callback) {
  libraryChangeCallbacks.push(callback);
}

/**
 * Get the currently active renderer ('default' | 'plotly' | 'threejs')
 */
export function getActive3DLibrary() {
  return currentLibrary;
}

/**
 * Render scene with current library
 * @param {Array} primitives - Scene primitives
 * @param {Object} options - Rendering options
 */
export async function render3DScene(primitives, options = {}) {
  if (currentLibrary === 'plotly') return renderPlotly3D(primitives, options);
  if (currentLibrary === 'threejs') return renderThree3D(primitives, options);
  // Canvas rendering is handled by the main app drawScene3d
}

/**
 * Clear current 3D scene
 */
export function clear3DScene() {
  if (currentLibrary === 'plotly') clearPlotly3D();
  if (currentLibrary === 'threejs') clearThree3D();
}

/**
 * Update container visibility based on mode and current library
 * @param {string} viewMode - '2d' or '3d'
 */
export function updateVisibility(viewMode = '3d') {
  if (typeof document === 'undefined') return;
  const cv = document.getElementById('cv');
  const plotlyContainer = document.getElementById('plotly-3d-container');
  const threeContainer = document.getElementById('three-3d-container');
  const selector = document.getElementById('3d-library-selector');

  if (viewMode !== '3d') {
    if (cv) cv.style.display = '';
    if (plotlyContainer) plotlyContainer.style.display = 'none';
    if (threeContainer) threeContainer.style.display = 'none';
    if (selector) selector.hidden = true;
    return;
  }

  if (selector) selector.hidden = false;

  if (cv) cv.style.display = currentLibrary === 'default' ? '' : 'none';
  if (plotlyContainer) plotlyContainer.style.display = currentLibrary==='plotly' ? 'block' : 'none';
  if (threeContainer) threeContainer.style.display = currentLibrary==='threejs' ? 'block' : 'none';
  if (currentLibrary === 'plotly') resizePlotly3D();
  if (currentLibrary === 'threejs') resizeThree3D();
}

/**
 * Handle window resize
 */
export function handle3DResize() {
  if (currentLibrary === 'plotly') resizePlotly3D();
  if (currentLibrary === 'threejs') resizeThree3D();
}

/**
 * Show the library selector (when entering 3D mode)
 */
export function show3DLibrarySelector() {
  updateVisibility('3d');
}

/**
 * Hide the library selector (when in 2D mode)
 */
export function hide3DLibrarySelector() {
  updateVisibility('2d');
}
