"use strict";

import { compile, extractParams, parseEquationInput, compileCondition, compilePiecewise, splitTop, parsePoints, setImplicitY, setUserFunctions, isDefinitionLhs } from './parser.js';
import { polyFit, expFit, powFit, logFit, sigmoidFit } from './regress.js';
import { describe, pearson } from './stats.js';
import { configureNumeric, derivAt, derivInfo, secondDeriv, integ, integralAt, limitAt, limitAtInfinity, safeEval, segmentIntegral } from './numeric.js';
import { derivativeText } from './symbolic.js';
import { derivativeSteps } from './steps.js';
import { antiderivativeText, integralSteps } from './integrate.js';
import { analyzeEq, formatIntervalList, htmlEscape } from './analysis.js';
import { PRESETS, getPreset } from './presets.js';
import { clearState, loadState, saveState } from './storage.js';
import { fmt, fmtLimitNumber, formatLimitInfo, formatLimitInfinity, niceStep, snapToStep } from './coords.js';
import { createStyleEditor, sanitizeColor } from './style-editor.js';
import { createValueTable } from './table.js';
import { createHistory } from './history.js';
import { applyOpFields, createOpControls } from './op-controls.js';
import { tableModel, createDataTable } from './data-table.js';
import {
  LESSONS,
  checkpointComplete,
  clampStepIndex,
  countCompletedLessonSteps,
  getLesson,
  getLessonCheckpointProgress,
  lessonCheckpoints,
  lessonScene,
  normalizeLessonProgress,
  setLessonCheckpointProgress
} from './lessons.js';
import { addGeometryDefinitions, extractGeometryParams, parseGeometryInput } from './geometry.js';
import { choosePointSourceIndex, constructionExpression, formatPointCommand, nextPointLabel, normalizePoint, updatePoint, usedGeometryNames } from './geometry-builder.js';
import { describeCanvas, formatMathVisual } from './accessibility.js';
import { splitInfoLines, infoLabelValue } from './info-format.js';
import { isStructuredResult, resultInfo, renderAlgebraResult } from './algebra-ui.js';
import { matrixInfo } from './linear-algebra.js';
import { algebraDeclaration, createAlgebraSymbols } from './algebra-symbols.js';
import { createTransformControls, buildSystemScene, buildSystemScene3D } from './linear-transform-view.js';
import { initAlgebraWorkbench } from './algebra-workbench.js';
import { initProjectControls } from './project-controls.js';
import { exportGraphPng, exportCombinedPng } from './export-graphic.js';
import {encodeSharedScene,decodeSharedScene} from './share-scene.js';
import { createCamera, zoomCamera, presetView, fitCameraScale, projectPoint } from './space3d/camera.js';
import { axesPrimitives } from './space3d/scene3d.js';
import { buildDrawList, drawScene3d, colorsFromTheme } from './space3d/render3d.js';
import { attachCameraControls, autoAxisLimit, CAMERA_HINT, decideViewMode, hasGuidesChip, has3dObjects, normalizeView3d, scenePrimitives, serializeView3d, viewNotice } from './space3d/view3d.js';
import { init3DLibrarySelector, getActive3DLibrary, render3DScene, show3DLibrarySelector, hide3DLibrarySelector, handle3DResize, onActive3DLibraryChange, updatePlotlyCamera } from './space3d/library-manager.js';
import { initThree3DControls, initThreePlaneDragging } from './space3d/three-renderer.js';
import { createTransform3DControls } from './space3d/transform3d.js';
import { createSectionPanel } from './space3d/section-panel.js';
import {intersectGeneralQuadricPlane,clipTriangleMesh} from './space3d/implicit-quadric.js';
import {sampleImplicitPlane} from './space3d/implicit-surfaces.js';
import {nearestProjectedSection} from './space3d/section-sync.js';
import { dragPlaneParameters, dragConeParameters } from './space3d/plane-interaction.js';
import { finiteSceneBounds } from './space3d/camera-fit.js';

const PALETTES={
  light:["#c0492f","#2d70b3","#2f7d5b","#6042a6","#d98324","#1d1d1f","#0a8aa6","#a8336e"],
  dark: ["#ef6a52","#5aa0e0","#46b888","#9a7ce0","#f0a64e","#d8dde3","#39c0dc","#e06aa0"]
};
const PARAM_DEFAULTS={a:1,b:0,c:0,d:1,h:2,i:1,j:1,k:1,m:1,n:10,p:1,q:1,r:1,u:.5,v:.2};
const PARAM_LIMITS={
  a:{min:-5,max:5,step:0.1}, b:{min:-10,max:10,step:0.1}, c:{min:-10,max:10,step:0.1}, d:{min:-10,max:10,step:0.1},
  h:{min:0.25,max:4.5,step:0.05}, k:{min:-8,max:8,step:0.1}, m:{min:-8,max:8,step:0.1}, n:{min:-100,max:100,step:1},
  p:{min:-8,max:8,step:0.1}, q:{min:-8,max:8,step:0.1}, r:{min:-8,max:8,step:0.1}, u:{min:0,max:1,step:.01}, v:{min:0,max:1,step:.01}, i:{min:-100,max:100,step:1}, j:{min:-100,max:100,step:1}
};
const DEFAULT_SIDE_WIDTH=340;
const SIDE_WIDTH_MIN=280;
const SIDE_WIDTH_MAX=620;
let theme='light';
let sideWidth=DEFAULT_SIDE_WIDTH;
const GRID_MODES=['linear','log','polar'];
const DATA_COMMAND_RE=/^(points|fit\d*|fitexp|fitpow|fitlog|fitsig|histogram|hist|seq|intersec|stats|compare|comparar|resid|residual)\s*:\s*(.+)$/i;
const FIT_COMPARE_SPECS=['fit','fit2','fit3','fit4','fitexp','fitpow','fitlog','fitsig'];
let gridMode='linear';
let annotations=[];
let annotationMode=false;
let annotationDrag=null;
let annotationHoverId=null;
let annotationMove=null;
let annotationDragStart=null;
let annotationIdCounter=1;
function PAL(){ return PALETTES[theme]; }
function eqColor(eq){ return eq.colorOverride || PAL()[eq.ci % PAL().length]; }

let nextId=1;
const equations=[];
let algebraSymbols=createAlgebraSymbols([]);
const resultRefreshers=new Map();
const transformControllers=new Map();
const transform3dControllers=new Map();
let selectedEquationId=null;
const view={cx:0, cy:0, scale:38};
// 3D view (§5.1, §7a.10): mode, orbital camera and floor grid. view3dFit is the
// camera scale that fits the box in the current viewport (zoom is saved relative
// to it); has3dSeen is null until the first render after a load, so the saved
// mode wins there and only later "no 3D" → "some 3D" transitions switch to 3D.
let view3d=normalizeView3d(null);
let view3dFit=0;
let view3dFitAxisRange=null;
let has3dSeen=null;
let dualSection=true;
let planeDragMode=false;
let planeDragStart=null;
let W=0,H=0,dpr=1;
let mouse={inside:false, px:0, py:0};
let saveTimer=null;
let lessonActionHandler=()=>{};
let lessonProgress=normalizeLessonProgress();
let refreshLessonUi=()=>{};
let refreshLessonHighlight=()=>{};
let geoTool='select';
let selectedGeoPoints=[];

function notifyLessonAction(kind){ lessonActionHandler(kind); }

function clampSideWidth(width){
  const n=Number(width);
  if(!Number.isFinite(n)) return DEFAULT_SIDE_WIDTH;
  const viewport=Number.isFinite(window.innerWidth) ? window.innerWidth : 1200;
  const max=Math.max(SIDE_WIDTH_MIN, Math.min(SIDE_WIDTH_MAX, viewport-360));
  return Math.round(Math.min(Math.max(n,SIDE_WIDTH_MIN),max));
}

function applySideWidth(width,{resizeCanvas=false}={}){
  sideWidth=clampSideWidth(width);
  document.documentElement?.style?.setProperty?.('--side-width',sideWidth+'px');
  const resizer=document.getElementById('side-resizer');
  if(resizer){
    resizer.setAttribute('aria-valuemin',String(SIDE_WIDTH_MIN));
    resizer.setAttribute('aria-valuemax',String(Math.max(SIDE_WIDTH_MIN,Math.min(SIDE_WIDTH_MAX,(window.innerWidth||1200)-360))));
    resizer.setAttribute('aria-valuenow',String(sideWidth));
  }
  if(resizeCanvas&&cv) resize();
}

function w2px(wx){ return (wx-view.cx)*view.scale + W/2; }
function w2py(wy){ return H/2 - (wy-view.cy)*view.scale; }
function px2wx(px){ return (px-W/2)/view.scale + view.cx; }
function py2wy(py){ return (H/2-py)/view.scale + view.cy; }

configureNumeric(()=>({scale:view.scale,W,H,px2wx}));

function makeEq(text){
  const ci=nextId-1;
  const eq={id:nextId++, ci, text:text||"", visible:true, fn:null, error:false,
            showD:false, showI:false, showR:false, showL:false, showA:false,
            showGeoLabels:true,
            name:'', collapsed:false, showResultTable:true,
            colorOverride:null, style:'solid', lw:2, params:{}, paramNames:[], analysisCache:null, intCache:null,
            kind:'function', ineqOp:null, domain:null, xFn:null, yFn:null, rFn:null,
            points:null, pointSource:null, pointLabel:null, histSource:null, valueFn:null, fitInfo:null, fitSpec:null, fitSource:null, regInfo:null, implicitF:null, defName:null, geometry:null,
            statsInfo:null, statsSource:null, statsKind:null};
  applyOpFields(eq);
  recompileEq(eq);
  return eq;
}

function serializeEq(eq){
  return {
    ci:eq.ci,
    text:eq.text,
    visible:eq.visible,
    name:eq.name,
    collapsed:eq.collapsed,
    showD:eq.showD,
    showI:eq.showI,
    showR:eq.showR,
    showL:eq.showL,
    showA:eq.showA,
    colorOverride:eq.colorOverride,
    style:eq.style,
    lw:eq.lw,
    params:eq.params,
    showD2:eq.showD2,
    dx:eq.dx,
    ia:eq.ia,
    ib:eq.ib,
    riemannN:eq.riemannN,
    riemannMode:eq.riemannMode,
    lx:eq.lx,
    lInf:eq.lInf,
    dp:eq.dp,
    showNormal:eq.showNormal,
    tmin:eq.tmin,
    tmax:eq.tmax,
    thmin:eq.thmin,
    thmax:eq.thmax,
    showGeoSideLengths:eq.showGeoSideLengths,
    showGeoVectorLengths:eq.showGeoVectorLengths,
    showGeoTriangleClass:eq.showGeoTriangleClass,
    showGeoAngles:eq.showGeoAngles,
    showGeoAnglesExternal:eq.showGeoAnglesExternal,
    showGeoAnglesComplement:eq.showGeoAnglesComplement,
    showGeoLabels:eq.showGeoLabels,
    showGeoGuides:eq.showGeoGuides,
    showGeoXAxisAngles:eq.showGeoXAxisAngles,
    histBins:eq.histBins,
    histDensity:eq.histDensity,
    histNormal:eq.histNormal,
    statsPop:eq.statsPop,
    showAlgebraTransform:!!eq.showAlgebraTransform,
    showAlgebraTransform3d:!!eq.showAlgebraTransform3d,
    showAlgebraSystem:!!eq.showAlgebraSystem,
    clipSide:eq.clipSide||0,
    surfacePoint:Array.isArray(eq.surfacePoint)?eq.surfacePoint:undefined,
    surfaceDirection:Number.isFinite(eq.surfaceDirection)?eq.surfaceDirection:0,
    showResultTable:eq.showResultTable
  };
}

function hydrateEq(saved){
  if(!saved||typeof saved.text!=='string') return null;
  const eq=applyEquationOptions(makeEq(saved.text), saved);
  if(Number.isFinite(saved.ci)) eq.ci=saved.ci;
  return eq;
}

function scheduleSave(){
  clearTimeout(saveTimer);
  saveTimer=setTimeout(persistState,120);
}

function plainState(){
  return {
    theme,
    sideWidth,
    gridMode,
    annotations: annotations.map(a => ({id:a.id, x:a.x, y:a.y, text:a.text, color:a.color, noBorder:a.noBorder})),
    view:{cx:view.cx, cy:view.cy, scale:view.scale},
    view3d:serializeView3d(view3d, view3dFit),
    dualSection,
    equations:equations.map(serializeEq),
    lessonProgress:normalizeLessonProgress(lessonProgress)
  };
}

function saveNow(){ saveState(plainState()); }

function persistState(){ saveNow(); commitHistory(); }

function normalizeGridMode(mode){
  return GRID_MODES.includes(mode) ? mode : 'linear';
}

function updateGridModeButton(){
  const button=document.getElementById('grid-mode');
  if(!button) return;
  const meta={
    linear:{text:'#', label:'Grade cartesiana'},
    log:{text:'log', label:'Grade logarítmica'},
    polar:{text:'◎', label:'Grade polar'}
  }[gridMode];
  button.textContent=meta.text;
  button.title=meta.label+' (alternar)';
  button.setAttribute('aria-label',meta.label);
  button.dataset.mode=gridMode;
}

// --- Undo/redo -------------------------------------------------------------
// Mutations funnel through the debounced persistState, so each settled
// edit/pan/zoom contributes one entry; rapid keystrokes or a drag coalesce into
// a single step. The stack machine itself lives in history.js (unit-tested).
const history=createHistory({limit:100});

function snapshotState(){ return JSON.stringify(plainState()); }

function commitHistory(){
  if(history.commit(snapshotState())) updateHistoryButtons();
}

function applyState(snap){
  const state=JSON.parse(snap);
  if(state.theme==='dark'||state.theme==='light') theme=state.theme;
  gridMode=normalizeGridMode(state.gridMode);
  restoreAnnotations(state.annotations);
  applySideWidth(state.sideWidth);
  lessonProgress=normalizeLessonProgress(state.lessonProgress);
  if(state.view){
    if(Number.isFinite(state.view.cx)) view.cx=state.view.cx;
    if(Number.isFinite(state.view.cy)) view.cy=state.view.cy;
    if(Number.isFinite(state.view.scale)) view.scale=Math.min(Math.max(state.view.scale,0.02),50000);
  }
  restoreView3d(state.view3d);
  dualSection=state.dualSection!==false;
  equations.splice(0,equations.length);
  nextId=1;               // rebuild ids deterministically for this state
  (Array.isArray(state.equations)?state.equations:[]).forEach(saved=>{
    const eq=hydrateEq(saved);
    if(eq) equations.push(eq);
  });
  if(equations.length===0) equations.push(makeEq(''));
  recompileAllEquations();
  applyTheme();
  updateGridModeButton();
  renderRows();
  refreshLessonUi();
  draw();
  saveNow();              // persist without committing a new history entry
}

function restoreView3d(saved){
  view3d=normalizeView3d(saved);
  view3dFit=0;
  view3dFitAxisRange=null;
  has3dSeen=null;
  fitCameraToViewport();
}

function activeAxisRange(){
  return view3d.autoAxisRange ? autoAxisLimit(equations) : view3d.axisRange;
}

function axisBox(limit=activeAxisRange()){
  return {min:[-limit,-limit,-limit],max:[limit,limit,limit]};
}

// Keep zoom relative to the current axis box so resizing preserves framing.
function fitCameraToViewport(){
  if(!(W>0&&H>0)) return;
  const limit=activeAxisRange();
  const fit=fitCameraScale({width:W,height:H},axisBox(limit));
  const zoom=view3dFit>0 ? view3d.camera.scale/view3dFit : view3d.zoom;
  view3d.camera={...createCamera({...view3d.camera,scale:fit*zoom}),dragging:!!view3d.camera.dragging};
  view3dFit=fit;
  view3dFitAxisRange=limit;
}

function defaultCamera3d(keep={}){
  return createCamera({projection:keep.projection,scale:fitCameraScale({width:W||1,height:H||1},axisBox())});
}

function flushPending(){
  if(saveTimer){ clearTimeout(saveTimer); saveTimer=null; persistState(); }
}

function undo(){
  flushPending();
  const snap=history.undo();
  if(snap===null) return;
  applyState(snap);
  updateHistoryButtons();
}

function redo(){
  flushPending();
  const snap=history.redo();
  if(snap===null) return;
  applyState(snap);
  updateHistoryButtons();
}

function updateHistoryButtons(){
  const u=document.getElementById('undo'), r=document.getElementById('redo');
  if(u) u.disabled=!history.canUndo();
  if(r) r.disabled=!history.canRedo();
}

function applyTheme(){
  const button=document.getElementById('theme');
  document.body.classList.toggle('dark', theme==='dark');
  button.textContent = theme==='dark' ? '\u2600' : '\u25d0';
  button.title = theme==='dark' ? 'Ativar tema claro' : 'Ativar tema escuro';
  invalidateCssCache();
}

function restoreState(state){
  if(!state) return false;
  gridMode=normalizeGridMode(state.gridMode);
  restoreAnnotations(state.annotations);
  applySideWidth(state.sideWidth);
  lessonProgress=normalizeLessonProgress(state.lessonProgress);
  if(state.view){
    if(Number.isFinite(state.view.cx)) view.cx=state.view.cx;
    if(Number.isFinite(state.view.cy)) view.cy=state.view.cy;
    if(Number.isFinite(state.view.scale)) view.scale=Math.min(Math.max(state.view.scale,0.02),50000);
  }
  restoreView3d(state.view3d);
  dualSection=state.dualSection!==false;
  const savedEquations=Array.isArray(state.equations) ? state.equations : [];
  savedEquations.forEach(saved=>{
    const eq=hydrateEq(saved);
    if(eq) equations.push(eq);
  });
  return equations.length>0;
}

function sanitizeParams(params){
  const out={};
  if(params&&typeof params==='object'){
    Object.entries(params).forEach(([key,value])=>{
      if(Object.prototype.hasOwnProperty.call(PARAM_DEFAULTS,key)&&Number.isFinite(value)) out[key]=value;
    });
  }
  return out;
}

function setupParams(eq, names){
  eq.params=sanitizeParams(eq.params);
  names.forEach(name=>{
    if(!Number.isFinite(eq.params[name])){
      const isAngled=/^\s*secao\s*:[^\n]*angulo\(/i.test(eq.text);
      eq.params[name]=isAngled&&name==='b'?.75:isAngled&&name==='q'?0:PARAM_DEFAULTS[name]??1;
    }
  });
  Object.keys(eq.params).forEach(name=>{ if(!names.includes(name)) delete eq.params[name]; });
  eq.paramNames=names;
}

// Param names inside a brace ({domain} or {piecewise}); the brace text isn't a
// single tokenizable expression, so scan the comma/colon-separated fragments.
function extractBraceParams(src){
  const names=new Set();
  for(const frag of src.split(/[,:]/)){
    try{ extractParams(frag).forEach(n=>names.add(n)); }catch(_){}
  }
  return [...names];
}

const POLY_SUP=['','x','x²','x³','x⁴','x⁵','x⁶'];
function polyLabel(coeffs){
  // Sign-aware: join terms with ` + `/` - ` over absolute values, so a negative
  // coefficient reads `… - 1.1` instead of `… + -1.1`.
  let out='';
  for(let i=coeffs.length-1;i>=0;i--){
    const c=coeffs[i];
    if(Math.abs(c)<1e-9 && coeffs.length>1) continue;
    const body=fmt(Math.abs(c))+(i>0 ? (POLY_SUP[i]||('x^'+i)) : '');
    if(out==='') out=(c<0?'-':'')+body;
    else out+=(c<0?' - ':' + ')+body;
  }
  return 'y ≈ '+(out===''?'0':out);
}

function validPoints(points){
  return Array.isArray(points) && points.length>0 && points.every(p=>p && Number.isFinite(p.x) && Number.isFinite(p.y));
}

function fitForSpec(spec, points){
  let fit;
  if(spec==='fitexp') fit=expFit(points);
  else if(spec==='fitpow') fit=powFit(points);
  else if(spec==='fitlog') fit=logFit(points);
  else if(spec==='fitsig') fit=sigmoidFit(points);
  else {
    const deg=spec==='fit'?1:(Number(spec.slice(3))||1);
    fit=polyFit(points,deg);
  }
  if(!fit) return null;
  if(spec==='fitexp') fit.label='y ≈ '+fmt(fit.a)+'·e^('+fmt(fit.b)+'x)';
  else if(spec==='fitpow') fit.label='y ≈ '+fmt(fit.a)+'·x^'+fmt(fit.b);
  else if(spec==='fitlog') fit.label='y ≈ '+fmt(fit.a)+' + '+fmt(fit.b)+'·ln(x)';
  else if(spec==='fitsig') fit.label='y ≈ '+fmt(fit.y0)+' + '+fmt(fit.L)+'/(1+e^(-'+fmt(fit.k)+'(x-'+fmt(fit.x0)+')))';
  else {
    fit.label=polyLabel(fit.coeffs);
    if(spec==='fit'||spec==='fit1'){
      const c=pearson(points);
      if(c) fit.label+=' · r='+fmt(c.r);
    }
  }
  return fit;
}

function isFitSpec(spec){
  return /^fit\d*$/.test(spec) || ['fitexp','fitpow','fitlog','fitsig'].includes(spec);
}

function finiteDataPoints(points){
  return Array.isArray(points) ? points.filter(p=>p && Number.isFinite(p.x) && Number.isFinite(p.y)) : [];
}

function fitMetrics(points, fit){
  if(!fit||typeof fit.predict!=='function') return null;
  const residuals=[];
  let sse=0, sae=0, bias=0;
  for(const p of finiteDataPoints(points)){
    const predicted=fit.predict(p.x);
    if(!Number.isFinite(predicted)) continue;
    const residual=p.y-predicted;
    if(!Number.isFinite(residual)) continue;
    residuals.push({x:p.x, y:residual, residual, observed:p.y, predicted});
    sse+=residual*residual;
    sae+=Math.abs(residual);
    bias+=residual;
  }
  const n=residuals.length;
  if(!n) return null;
  return {
    n,
    residuals,
    sse,
    mae:sae/n,
    rmse:Math.sqrt(sse/n),
    bias:bias/n,
    r2:Number.isFinite(fit.r2) ? fit.r2 : null
  };
}

export function compareFitModels(points, specs=FIT_COMPARE_SPECS){
  const data=finiteDataPoints(points);
  if(data.length<2) return [];
  const rows=[];
  for(const spec of specs){
    const fit=fitForSpec(spec, data);
    const metrics=fitMetrics(data, fit);
    if(!metrics) continue;
    rows.push({spec, fit, ...metrics});
  }
  rows.sort((a,b)=>{
    if(a.rmse!==b.rmse) return a.rmse-b.rmse;
    return (b.r2 ?? -Infinity)-(a.r2 ?? -Infinity);
  });
  return rows;
}

export function residualPointsForModel(points, spec='fit2'){
  const data=finiteDataPoints(points);
  if(data.length<2||!isFitSpec(spec)) return null;
  const fit=fitForSpec(spec, data);
  const metrics=fitMetrics(data, fit);
  if(!metrics) return null;
  return {fit, metrics, points:metrics.residuals.map(p=>({x:p.x, y:p.y}))};
}

export function residualTableRows(metrics){
  const rows=Array.isArray(metrics?.residuals) ? metrics.residuals : [];
  return rows.map(p=>{
    const residual=Number.isFinite(p.residual) ? p.residual : p.y;
    return {
      x:p.x,
      observed:p.observed,
      predicted:p.predicted,
      residual,
      squared:residual*residual,
      absolute:Math.abs(residual)
    };
  }).filter(p=>Number.isFinite(p.x) && Number.isFinite(p.observed) &&
               Number.isFinite(p.predicted) && Number.isFinite(p.residual));
}

export function histogramTableRows(values, options={}){
  const data=Array.isArray(values) ? values.filter(Number.isFinite) : [];
  if(!data.length) return [];
  const explicitBins=Number.isInteger(options.histBins) || Number.isInteger(options.bins);
  const targetBins=Number.isInteger(options.histBins) ? options.histBins
    : (Number.isInteger(options.bins) ? options.bins : 12);
  const bins=computeHistogramBins(data, targetBins, explicitBins);
  let cumulative=0;
  return bins.map((bin,index)=>{
    cumulative+=bin.count;
    const width=bin.max-bin.min;
    const relative=bin.count/data.length;
    return {
      index:index+1,
      min:bin.min,
      max:bin.max,
      center:bin.center,
      width,
      count:bin.count,
      relative,
      cumulative,
      cumulativeRelative:cumulative/data.length,
      density:width>0 ? bin.count/(data.length*width) : null
    };
  });
}

function fitModelName(spec){
  const model=String(spec||'fit').toLowerCase();
  if(model==='fit'||model==='fit1') return 'linear';
  if(/^fit\d+$/.test(model)) return 'polinomial grau '+Number(model.slice(3));
  if(model==='fitexp') return 'exponencial';
  if(model==='fitpow') return 'potência';
  if(model==='fitlog') return 'logarítmico';
  if(model==='fitsig') return 'sigmoidal';
  return model;
}

function fitDomainHint(spec){
  const model=String(spec||'fit').toLowerCase();
  if(model==='fitpow') return 'usa dados com x>0 e y>0';
  if(model==='fitlog') return 'usa dados com x>0';
  if(model==='fitexp') return 'usa dados com y>0';
  if(model==='fitsig') return 'estimativa logística pelos extremos observados';
  return 'sem restrição de domínio no ajuste';
}

function polyTermLabel(index){
  if(index===0) return 'constante';
  return 'coeficiente de '+(POLY_SUP[index] || ('x^'+index));
}

export function fitParameterRows(spec, fit, metrics=null){
  if(!fit) return [];
  const model=String(spec||'fit').toLowerCase();
  const rows=[
    {item:'modelo', value:fitModelName(model), detail:fitDomainHint(model)}
  ];
  if(fit.label) rows.push({item:'equação', value:fit.label, detail:'curva ajustada'});
  if(metrics?.n) rows.push({item:'n', value:metrics.n, detail:'pontos usados'});
  const r2=metrics?.r2 ?? fit.r2;
  if(Number.isFinite(r2)) rows.push({item:'R²', value:r2, detail:'coeficiente de determinação'});
  if(metrics){
    rows.push({item:'RMSE', value:metrics.rmse, detail:'raiz do erro quadrático médio'});
    rows.push({item:'MAE', value:metrics.mae, detail:'erro absoluto médio'});
    rows.push({item:'SSE', value:metrics.sse, detail:'soma dos erros quadráticos'});
  }
  if(Array.isArray(fit.coeffs)){
    fit.coeffs.forEach((value,index)=>{
      rows.push({item:'a'+index, value, detail:polyTermLabel(index)});
    });
  } else if(model==='fitexp'||model==='fitpow'||model==='fitlog'){
    rows.push({item:'a', value:fit.a, detail:model==='fitlog'?'intercepto':'escala'});
    rows.push({item:'b', value:fit.b, detail:model==='fitpow'?'expoente':(model==='fitexp'?'taxa no expoente':'coeficiente de ln(x)')});
  } else if(model==='fitsig'){
    rows.push({item:'y0', value:fit.y0, detail:'assíntota inferior'});
    rows.push({item:'L', value:fit.L, detail:'amplitude'});
    rows.push({item:'k', value:fit.k, detail:'inclinação'});
    rows.push({item:'x0', value:fit.x0, detail:'centro'});
  }
  return rows.filter(row=>row.value!==undefined && row.value!==null &&
    (typeof row.value!=='number' || Number.isFinite(row.value)));
}

function fitMetricsLabel(metrics){
  if(!metrics) return '';
  const parts=['RMSE='+fmt(metrics.rmse), 'MAE='+fmt(metrics.mae), 'SSE='+fmt(metrics.sse)];
  if(metrics.r2!=null) parts.unshift('R²='+fmt(metrics.r2));
  return parts.join(' · ');
}

function pointSourceSignature(points){
  return points.map(p=>fmt(p.x)+','+fmt(p.y)).join(';');
}

function compilePointSource(src, params){
  const explicit=parsePoints(src);
  if(explicit) return {names:[], points:explicit, getPoints:()=>explicit};
  const names=extractParams(src);
  const fn=compile(src, params);
  const getPoints=()=>{
    const points=fn(0);
    return validPoints(points) ? points : null;
  };
  const points=getPoints();
  return points ? {names, points, getPoints} : null;
}

function compileHistogramValues(src, params){
  const nums=[];
  let allNumeric=true;
  for(const piece of splitTop(src, ',')){
    const v=Number(piece.trim());
    if(Number.isFinite(v)) nums.push(v);
    else allNumeric=false;
  }
  if(nums.length && allNumeric) return {names:[], values:nums, getValues:()=>nums};
  const names=extractParams(src);
  const fn=compile(src, params);
  const getValues=()=>{
    const value=fn(0);
    if(validPoints(value)) return value.map(p=>p.y);
    if(Array.isArray(value)){
      const values=value.map(Number).filter(Number.isFinite);
      return values.length ? values : null;
    }
    return Number.isFinite(value) ? [value] : null;
  };
  const values=getValues();
  return values?.length ? {names, values, getValues} : null;
}

function dynamicRegression(spec, source){
  let cachedSig=null, cachedFit=null;
  const currentFit=()=>{
    const points=source.getPoints();
    if(!validPoints(points)) return null;
    const sig=pointSourceSignature(points);
    if(sig!==cachedSig){
      cachedSig=sig;
      cachedFit=fitForSpec(spec, points);
    }
    return cachedFit;
  };
  return {currentFit, predict:x=>currentFit()?.predict(x) ?? NaN};
}

// Index of a single top-level '=' that is not part of a comparison (==,<=,>=,!=).
// Depth tracks parentheses and braces, so '=' inside (...) or {...} is ignored.
function findTopLevelEquals(s){
  let depth=0;
  for(let i=0;i<s.length;i++){
    const c=s[i];
    if(c==='('||c==='{') depth++;
    else if(c===')'||c==='}') depth--;
    else if(c==='=' && depth===0){
      const prev=s[i-1], next=s[i+1];
      if(prev!=='<'&&prev!=='>'&&prev!=='!'&&prev!=='='&&next!=='=') return i;
    }
  }
  return -1;
}

// First top-level comparison operator (<,>,<=,>=). Returns {idx, op} or null.
function findTopLevelCompare(s){
  let depth=0;
  for(let i=0;i<s.length;i++){
    const c=s[i];
    if(c==='('||c==='{') depth++;
    else if(c===')'||c==='}') depth--;
    else if(depth===0 && (c==='<'||c==='>')){
      const op = s[i+1]==='=' ? c+'=' : c;
      return {idx:i, op};
    }
  }
  return null;
}

// Symbolic derivatives of a plain y=f(x) body. When the expression is outside
// the differentiable subset this leaves deriv1/deriv2 null and every consumer
// falls back to the numeric derivAt/secondDeriv.
function setupSymbolicDerivatives(eq, body, pred){
  const d1=derivativeText(body);
  if(d1===null) return;
  let f1=null;
  try{ f1=compile(d1, eq.params); }catch(_){ return; }
  if(!f1) return;
  eq.deriv1={text:d1, fn: pred ? x=>pred(x)?f1(x):NaN : f1, src:body};
  const d2=derivativeText(d1);
  if(d2===null) return;
  let f2=null;
  try{ f2=compile(d2, eq.params); }catch(_){ return; }
  if(!f2) return;
  eq.deriv2={text:d2, fn: pred ? x=>pred(x)?f2(x):NaN : f2, src:d1};
}

// Primitiva simbólica de y=f(x) quando o integrando está no repertório de
// integrate.js; fora dele eq.antider fica null e ∫ segue só numérica.
function setupSymbolicIntegral(eq, body){
  const Ft=antiderivativeText(body);
  if(Ft===null) return;
  let F=null;
  try{ F=compile(Ft, eq.params); }catch(_){ return; }
  if(!F) return;
  eq.antider={text:Ft, fn:F, src:body};
}

// Passo a passo (f′, f″, primitiva) num <details> por operação ligada.
// Conteúdo computado lazy no primeiro toggle e cacheado pelo texto-fonte;
// DOM só via createElement/textContent (nada de innerHTML com dado do usuário).
function renderStepsZone(eq, host){
  host.innerHTML='';
  if(!eq.fn || eq.kind!=='function') return;
  const add=(label, src, compute)=>{
    const det=document.createElement('details');
    det.className='steps';
    const sum=document.createElement('summary');
    sum.textContent=label;
    const body=document.createElement('div');
    body.className='steps-body';
    det.append(sum, body);
    det.addEventListener('toggle',()=>{
      if(!det.open || det.dataset.src===src) return;
      det.dataset.src=src;
      body.innerHTML='';
      const st=compute();
      if(!st){ body.textContent='passo a passo indisponível para esta expressão'; return; }
      st.lines.forEach(line=>{
        const row=document.createElement('div');
        row.className='step-line';
        const rule=document.createElement('span');
        rule.className='step-rule';
        rule.textContent=line.title;
        row.appendChild(rule);
        if(line.formula){
          const f=document.createElement('span');
          f.className='step-formula';
          f.textContent=formatMathVisual(line.formula);
          row.appendChild(f);
        }
        if(line.note){
          const n=document.createElement('span');
          n.className='step-note';
          n.textContent=formatMathVisual(line.note);
          row.appendChild(n);
        }
        const ex=document.createElement('div');
        ex.className='step-expr';
        ex.textContent='= '+formatMathVisual(line.expr);
        row.appendChild(ex);
        body.appendChild(row);
      });
    });
    host.appendChild(det);
  };
  if(eq.showD&&eq.deriv1) add('passo a passo de f′', eq.deriv1.src, ()=>derivativeSteps(eq.deriv1.src));
  if(eq.showD2&&eq.deriv2) add('passo a passo de f″', eq.deriv2.src, ()=>derivativeSteps(eq.deriv2.src));
  if(eq.showI&&eq.antider) add('passo a passo da primitiva', eq.antider.src, ()=>{
    const st=integralSteps(eq.antider.src);
    if(st) st.lines.push({title:'Constante de integração',formula:'primitivas diferem por uma constante',note:null,expr:st.result+' + C'});
    return st;
  });
}

// Symbolic derivative when available, numeric fallback otherwise.
function eqDerivFn(eq){
  return eq.deriv1 ? eq.deriv1.fn : x=>derivAt(eq.fn,x);
}

function eqDeriv2Fn(eq){
  return eq.deriv2 ? eq.deriv2.fn : x=>secondDeriv(eq.fn,x);
}

function recompileEq(eq, geometryRegistry=null){
  eq.analysisCache=null;
  eq.intCache=null;
  eq.algebraResult=null; eq.algebraInput=null; eq.errorMessage=null; eq.systemScene=null; eq.systemScene3d=null; eq.transformScene3d=null;
  eq.kind='function'; eq.ineqOp=null; eq.domain=null;
  eq.fn=null; eq.xFn=null; eq.yFn=null; eq.rFn=null; eq.points=null; eq.pointSource=null; eq.pointLabel=null; eq.histSource=null; eq.valueFn=null; eq.fitInfo=null; eq.fitSpec=null; eq.fitSource=null; eq.regInfo=null; eq.defName=null; eq.geometry=null;
  eq.deriv1=null; eq.deriv2=null; eq.antider=null;
  eq.statsInfo=null; eq.statsSource=null; eq.statsKind=null; eq.compareInfo=null; eq.compareSource=null; eq.residualInfo=null;
  const raw=eq.text.trim();
  // Named function definition: name(var) = body → registered for use elsewhere.
  const defM=raw.match(/^([a-zA-Z][a-zA-Z0-9]*)\s*\(\s*[a-zA-Z][a-zA-Z0-9]*\s*\)\s*=\s*.+$/);
  if(defM && isDefinitionLhs(raw.slice(0,raw.indexOf('=')).trim())) eq.defName=defM[1].toLowerCase();
  try{
    const declaration=algebraDeclaration(raw);
    const calculation=raw.match(/^calc\s*:\s*(.*)$/i);
    if(declaration || calculation){
      eq.kind='result';
      const source=declaration ? declaration.body : calculation[1];
      setupParams(eq,extractParams(source));
      if(!source.trim()) throw new Error('Digite uma expressão após calc:.');
      const fn=compile(source,eq.params,{},algebraSymbols.resolve);
      const value=declaration ? algebraSymbols.resolve(declaration.name) : fn(0);
      setComputedResult(eq,value,fn);
      return;
    }
    // Data points / regression: points:/fit:/fitN:/fitexp:/fitpow:/fitlog:/fitsig:/histogram:/hist:/seq:/intersec:
    const fm=raw.match(DATA_COMMAND_RE);
    if(!fm){
      const geometryNames=extractGeometryParams(raw);
      if(geometryNames.length) setupParams(eq, geometryNames);
      const geometry=parseGeometryInput(raw,{params:eq.params,registry:geometryRegistry,symbols:algebraSymbols.resolve,surfacePoint:eq.surfacePoint,surfaceDirection:eq.surfaceDirection});
      if(geometry){
        setupParams(eq, geometryNames);
        eq.kind='geometry';
        eq.geometry=geometry;
        eq.error=!!geometry.error;
        return;
      }
    }
    if(fm){
      const spec=fm[1].toLowerCase();
      if(spec==='histogram' || spec==='hist'){
        const source=compileHistogramValues(fm[2], eq.params);
        if(!source){ eq.fn=null; eq.error=true; eq.paramNames=[]; return; }
        setupParams(eq, source.names);
        const nums=source.getValues();
        if(!nums?.length){ eq.fn=null; eq.error=true; eq.paramNames=[]; return; }
        const {bars, bins}=histBarsFromValues(nums, eq);
        eq.kind='histogram'; eq.histSource=source.getValues; eq.points=bars;
        eq.regInfo={label:'n='+nums.length+' bins='+bins.length+(eq.histDensity?' · freq':''), r2:null};
        eq.error=false; return;
      }
      if(spec==='seq'){
        const src='seq('+fm[2]+')';
        setupParams(eq, extractParams(src));
        const fn=compile(src, eq.params);
        eq.pointSource=()=>fn(0);
        const pts=eq.pointSource();
        if(!Array.isArray(pts)){ eq.fn=null; eq.error=true; eq.paramNames=[]; return; }
        eq.points=pts;
        eq.kind='points'; eq.pointLabel='seq'; eq.regInfo={label:'seq '+pts.length+' pontos', r2:null};
        eq.error=false; return;
      }
      if(spec==='intersec'){
        const parts=splitTop(fm[2], ',');
        if(parts.length<2){ eq.fn=null; eq.error=true; eq.paramNames=[]; return; }
        const names=[...new Set([...extractParams(parts[0]), ...extractParams(parts[1])])];
        setupParams(eq, names);
        const fnA=compile(parts[0], eq.params), fnB=compile(parts[1], eq.params);
        eq.pointSource=()=>{
          const [xmin,xmax]=visibleXRange();
          return computeIntersections(fnA, fnB, xmin, xmax);
        };
        const pts=eq.pointSource();
        if(!Array.isArray(pts)){ eq.fn=null; eq.error=true; eq.paramNames=[]; return; }
        eq.points=pts;
        eq.kind='points'; eq.pointLabel='intersec'; eq.regInfo={label:'intersec '+pts.length+' ptos', r2:null};
        eq.error=false; return;
      }
      if(spec==='stats'){
        const literal=parsePoints(fm[2]);
        if(literal && literal.length>=2){
          setupParams(eq, []);
          eq.kind='stats'; eq.statsKind='xy';
          eq.statsSource=()=>literal;
          updateDynamicStats(eq);
          eq.error=!eq.statsInfo; eq.fn=null; return;
        }
        const source=compileHistogramValues(fm[2], eq.params);
        if(!source){ eq.fn=null; eq.error=true; eq.paramNames=[]; return; }
        setupParams(eq, source.names);
        eq.kind='stats'; eq.statsKind='1var';
        eq.statsSource=source.getValues;
        updateDynamicStats(eq);
        eq.error=!eq.statsInfo; eq.fn=null; return;
      }
      if(spec==='compare'||spec==='comparar'){
        const source=compilePointSource(fm[2], eq.params);
        if(!source){ eq.fn=null; eq.error=true; eq.paramNames=[]; return; }
        setupParams(eq, source.names);
        eq.kind='fitcompare';
        eq.compareSource=source.getPoints;
        updateDynamicCompare(eq);
        eq.error=!eq.compareInfo?.rows?.length; eq.fn=null; return;
      }
      if(spec==='resid'||spec==='residual'){
        const parts=splitTop(fm[2], ',');
        const model=(parts.shift()||'').trim().toLowerCase();
        const sourceText=parts.join(',').trim();
        if(!isFitSpec(model)||!sourceText){ eq.fn=null; eq.error=true; eq.paramNames=[]; return; }
        const source=compilePointSource(sourceText, eq.params);
        if(!source){ eq.fn=null; eq.error=true; eq.paramNames=[]; return; }
        setupParams(eq, source.names);
        eq.pointSource=()=>{
          const result=residualPointsForModel(source.getPoints(), model);
          eq.residualInfo=result ? {model, ...result.metrics} : null;
          eq.regInfo=result
            ? {label:'resíduos '+model+' · '+fitMetricsLabel(result.metrics), r2:null}
            : null;
          return result ? result.points : [];
        };
        const pts=eq.pointSource();
        if(!pts.length){ eq.fn=null; eq.error=true; eq.paramNames=[]; return; }
        eq.points=pts;
        eq.kind='points'; eq.pointLabel='resid';
        eq.error=false; return;
      }
      const source=compilePointSource(fm[2], eq.params);
      if(!source){ eq.fn=null; eq.error=true; eq.paramNames=[]; return; }
      setupParams(eq, source.names);
      const points=source.getPoints();
      if(!validPoints(points)){ eq.fn=null; eq.error=true; eq.paramNames=[]; return; }
      eq.points=points;
      if(spec==='points'){
        eq.kind='points';
        eq.pointSource=source.getPoints;
        eq.pointLabel='points';
        eq.regInfo={label:points.length+' pontos', r2:null};
        eq.error=false; return;
      }
      const regression=dynamicRegression(spec, source);
      const fit=regression.currentFit();
      if(!fit){ eq.fn=null; eq.error=true; eq.paramNames=[]; return; }
      eq.kind='regression'; eq.fn=regression.predict; eq.fitInfo=regression.currentFit; eq.fitSpec=spec; eq.fitSource=source.getPoints; eq.regInfo={label:fit.label, r2:fit.r2};
      eq.error=false; return;
    }
    // Polar: r = f(θ)
    const pm=raw.match(/^r\s*=\s*(.+)$/i);
    if(pm){
      setupParams(eq, extractParams(pm[1]));
      const rFn=compile(pm[1], eq.params);
      if(rFn){ eq.kind='polar'; eq.rFn=rFn; eq.error=false; return; }
    }
    // Parametric: (x(t), y(t))
    if(raw.startsWith('(') && raw.endsWith(')')){
      const parts=splitTop(raw.slice(1,-1), ',');
      if(parts.length===2){
        const names=[...new Set([...extractParams(parts[0]), ...extractParams(parts[1])])];
        setupParams(eq, names);
        const xFn=compile(parts[0], eq.params), yFn=compile(parts[1], eq.params);
        if(xFn&&yFn){ eq.kind='parametric'; eq.xFn=xFn; eq.yFn=yFn; eq.error=false; return; }
      }
    }
    // Implicit relation: A = B (single top-level '=', lhs not a definition)
    const ei=findTopLevelEquals(raw);
    if(ei>=0){
      const lhs=raw.slice(0,ei).trim(), rhs=raw.slice(ei+1).trim();
      if(rhs){
        const implicitBareVar=/^[a-zA-Z]+$/ .test(lhs) && ['x','t','theta'].includes(lhs);
        if(!isDefinitionLhs(lhs) || implicitBareVar){
        const names=[...new Set([...extractParams(lhs), ...extractParams(rhs)])];
        setupParams(eq, names);
        const L=compile(lhs, eq.params), R=compile(rhs, eq.params);
        if(L&&R){
          eq.kind='implicit';
          eq.implicitF=(x,y)=>{ setImplicitY(y); return L(x)-R(x); };
          eq.error=false; return;
        }
      }
      }
    }
    // Implicit inequality: A <op> B (not the simple "y <op> f(x)" form, which is
    // handled as a 1-variable region by parseEquationInput below).
    const ci=findTopLevelCompare(raw);
    if(ci){
      const lhs=raw.slice(0,ci.idx).trim(), rhs=raw.slice(ci.idx+ci.op.length).trim();
      if(lhs!=='y' && rhs){
        const names=[...new Set([...extractParams(lhs), ...extractParams(rhs)])];
        setupParams(eq, names);
        const L=compile(lhs, eq.params), R=compile(rhs, eq.params);
        if(L&&R){
          eq.kind='implicit-ineq';
          eq.ineqOp=ci.op;
          eq.implicitF=(x,y)=>{ setImplicitY(y); return L(x)-R(x); };
          eq.error=false; return;
        }
      }
    }
  }catch(e){ eq.fn=null; eq.error=true; eq.errorMessage=e.message; return; }

  const parsed=parseEquationInput(eq.text);
  const isPiecewise=parsed.domainSrc && parsed.domainSrc.includes(':');
  try{
    if(isPiecewise){
      setupParams(eq, extractBraceParams(parsed.domainSrc));
      eq.fn=compilePiecewise(parsed.domainSrc, eq.params);
      eq.error=false;
      return;
    }
    const body=parsed.body;
    if(!body){ eq.fn=null; eq.error=false; eq.paramNames=[]; return; }
    const names=[...new Set([...extractParams(body), ...(parsed.domainSrc?extractBraceParams(parsed.domainSrc):[])])];
    setupParams(eq, names);
    const baseFn=compile(body, eq.params,{},algebraSymbols.resolve);
    if(!baseFn){ eq.fn=null; eq.error=false; eq.paramNames=[]; return; }
    const sample=baseFn(0);
    if(Array.isArray(sample)||isStructuredResult(sample)){
      setComputedResult(eq,sample,baseFn);
      return;
    }
    let fn=baseFn;
    if(parsed.domainSrc){
      const pred=compileCondition(parsed.domainSrc, eq.params);
      eq.domain=pred;
      fn=x=>pred(x)?baseFn(x):NaN;
    }
    if(parsed.ineqOp){ eq.kind='inequality'; eq.ineqOp=parsed.ineqOp; }
    eq.fn=fn;
    eq.error=false;
    if(eq.kind==='function'){
      setupSymbolicDerivatives(eq, body, eq.domain);
      setupSymbolicIntegral(eq, body);
    }
  }
  catch(e){ eq.fn=null; eq.error=true; eq.errorMessage=e.message; }
}

function setComputedResult(eq,value,fn){
  eq.kind='result'; eq.valueFn=fn;
  eq.algebraResult=resultInfo(value,fn?.inputShapes);
  eq.algebraInput=fn?.inputValues?.find(v=>Array.isArray(v)&&Array.isArray(v[0])) || null;
  if(eq.algebraInput && /\b(inv|linsolve)\s*\(/i.test(eq.text)){
    const warnings=matrixInfo(eq.algebraInput).warnings;
    eq.algebraResult.warnings=[...new Set([...eq.algebraResult.warnings,...warnings])];
  }
  if(eq.algebraResult.kind==='solveinfo' && fn?.inputValues?.length===2){
    const [A,b]=fn.inputValues;
    eq.systemScene=buildSystemScene(A,b,eq.algebraResult.metadata.classification==='unique'?eq.algebraResult.value:null);
    eq.systemScene3d=buildSystemScene3D(A,b,eq.algebraResult.metadata.classification==='unique'?eq.algebraResult.value:null);
  }
  eq.regInfo={label:'resultado = '+formatCalcValue(isStructuredResult(value)?value.value:value),r2:null};
  eq.error=false;
}

function recompileAllEquations(){
  // Parameter objects must exist before evaluating forward references.
  for(const eq of equations){
    const declaration=algebraDeclaration(eq.text);
    if(declaration) try{setupParams(eq,extractParams(declaration.body));}catch(_){}
  }
  algebraSymbols=createAlgebraSymbols(equations);
  const geometryRegistry=new Map();
  equations.forEach(eq=>{
    recompileEq(eq, geometryRegistry);
    if(eq.kind==='geometry'&&!eq.error) addGeometryDefinitions(geometryRegistry,eq.geometry);
  });
  // A free-form surface automatically intersects any visible, separately
  // declared planes. This pass is order-independent (plane before or after).
  const planes=equations.filter(eq=>eq.visible!==false&&!eq.error&&eq.geometry?.type==='plane')
    .flatMap(eq=>(eq.geometry.scene3d||[]).filter(p=>p.kind==='plane'&&p.role==='main'))
    .slice(0,4);
  for(const eq of equations){
    const geometry=eq.geometry,poly=geometry?.generalQuadric?.polynomial,implicit=geometry?.implicitSurface;
    if(!geometry||eq.error)continue;
    if(poly&&planes.length){
      const extent=geometry.generalQuadric.extent;
      const cuts=planes.map((plane,index)=>{
        const cut=intersectGeneralQuadricPlane(poly,plane,{extent:extent*1.6});
        cut.planeIndex=index;
        return {plane,cut};
      });
      const main=cuts[0].cut;
      geometry.section={kind:'quadric-plane',analysis:main,quadricType:'general'};
      geometry.scene3d.push(...cuts.flatMap(({plane,cut},index)=>[
        {kind:'plane',n:plane.n,d:plane.d,alpha:.16,conicSection:true,color:'#daa94d'},
        ...cut.worldSegments.map(({a,b})=>({kind:'segment',a,b,
          color:['#ee5288','#7f9afb','#18bd99','#dea347'][index],weight:2.8,sectionCurve:index===0,conicSection:true}))
      ]));
      geometry.info.push(...cuts.map(({cut},i)=>'Plano '+(i+1)+': seção '+cut.type+' · '+(cut.canonical||cut.equation)));
    }
    else if(implicit&&planes.length){
      const cuts=planes.map(plane=>sampleImplicitPlane(implicit.fn,plane,{extent:implicit.extent*1.5}));
      geometry.section={kind:'implicit-plane',analysis:cuts[0]};
      geometry.scene3d.push(...cuts.flatMap((cut,index)=>[
        {kind:'plane',n:planes[index].n,d:planes[index].d,alpha:.16,conicSection:true,color:'#daa94d'},
        ...cut.worldSegments.map(({a,b})=>({kind:'segment',a,b,
          color:['#ee5288','#7f9afb','#18bd99','#dea347'][index],weight:2.8,
          sectionCurve:index===0,conicSection:true}))
      ]));
      geometry.info.push(...cuts.map((cut,index)=>
        'Plano '+(index+1)+': seção implícita aproximada ('+cut.segments.length+' segmentos)'));
    }
    const side=eq.clipSide===1?1:eq.clipSide===-1?-1:0;
    if(side&&geometry.section){
      const plane=geometry.scene3d.find(p=>p.kind==='plane'&&p.conicSection);
      if(plane)geometry.scene3d=geometry.scene3d.map(p=>p.kind==='mesh'?
        clipTriangleMesh(p,plane,side):p);
    }
  }
}

// --- Parameter animation -------------------------------------------------
// Ping-pong a parameter across its range on a single rAF loop while active.
const animations=new Map();   // `${eq.id}:${name}` -> {eq,name,min,max,dir,range,number}
let animRaf=null;
function animKey(eq,name){ return eq.id+':'+name; }
function toggleAnim(eq,name,limits,range,number){
  const key=animKey(eq,name);
  if(animations.has(key)) animations.delete(key);
  else animations.set(key,{eq,name,min:limits.min,max:limits.max,dir:1,range,number});
  if(animations.size && animRaf===null) animRaf=requestAnimationFrame(animTick);
  return animations.has(key);
}
function animTick(){
  animRaf=null;
  if(!animations.size) return;
  for(const a of animations.values()){
    const span=(a.max-a.min)||1;
    const cur=Number.isFinite(a.eq.params[a.name]) ? a.eq.params[a.name] : a.min;
    let v=cur+a.dir*span/150;
    if(v>=a.max){ v=a.max; a.dir=-1; } else if(v<=a.min){ v=a.min; a.dir=1; }
    a.eq.params[a.name]=v;
    a.eq.analysisCache=null; a.eq.intCache=null;
    if(a.range) a.range.value=v;
    if(a.number) a.number.value=v;
  }
  recompileAllEquations();
  resultRefreshers.forEach(refresh=>refresh());
  render();
  notifyLessonAction('animation');
  animRaf=requestAnimationFrame(animTick);
}

const rowsEl=document.getElementById('rows');

function defaultEqName(eq){
  const n=(eq.ci??0)+1;
  switch(eq.kind){
    case 'parametric': return 'Paramétrica '+n;
    case 'polar': return 'Polar '+n;
    case 'implicit': return 'Implícita '+n;
    case 'implicit-ineq': return 'Região implícita '+n;
    case 'inequality': return 'Inequação '+n;
    case 'regression': return 'Ajuste '+n;
    case 'points': return 'Dados '+n;
    case 'histogram': return 'Histograma '+n;
    case 'stats': return 'Estatística '+n;
    case 'fitcompare': return 'Comparação '+n;
    case 'result': return 'Resultado '+n;
    case 'geometry': return 'Geometria '+n;
    default: return 'Função '+n;
  }
}

function curveTypeLabel(eq){
  switch(eq.kind){
    case 'parametric': return 'paramétrica';
    case 'polar': return 'polar';
    case 'implicit': return 'implícita';
    case 'implicit-ineq': return 'região';
    case 'inequality': return 'inequação';
    case 'regression': return 'ajuste';
    case 'points': return 'dados';
    case 'histogram': return 'histograma';
    case 'stats': return 'estatística';
    case 'fitcompare': return 'modelos';
    case 'result': return 'resultado';
    case 'geometry': return eq.geometry?.label || 'geometria';
    default: return 'explícita';
  }
}

function hasResultTable(eq){
  return eq.kind==='stats' || eq.kind==='histogram' || eq.kind==='regression' || eq.kind==='fitcompare' || (eq.kind==='points' && eq.pointLabel==='resid');
}

function curveSummaryBadges(eq){
  const badges=[];
  if(!eq.visible) badges.push('oculta');
  if(eq.error) badges.push('erro');
  if(eq.paramNames?.length) badges.push(eq.paramNames.length===1 ? '1 parâmetro' : eq.paramNames.length+' parâmetros');
  if(hasResultTable(eq) && eq.showResultTable) badges.push('tabela');
  if(eq.showD) badges.push('f\u2032');
  if(eq.showD2) badges.push('f\u2033');
  if(eq.showNormal) badges.push('normal');
  if(eq.showI) badges.push('\u222b');
  if(eq.showR) badges.push('\u03a3');
  if(eq.showL) badges.push('lim');
  if(eq.showA) badges.push('análise');
  if(eq.kind==='geometry'&&eq.showGeoTriangleClass&&eq.geometry?.triangleClass) badges.push('tipo');
  if(eq.kind==='geometry'&&eq.showGeoAngles!==false&&eq.geometry?.angles?.length) badges.push('âng');
  if(eq.kind==='geometry'&&eq.showGeoSideLengths) badges.push('lados');
  if(eq.kind==='geometry'&&eq.showGeoVectorLengths) badges.push('vetores');
  if(eq.kind==='geometry'&&eq.showGeoXAxisAngles) badges.push('ang x');
  if(eq.kind==='geometry'&&eq.showGeoLabels!==false&&(eq.geometry?.points?.length||eq.geometry?.segments?.length||eq.geometry?.vectors?.length||eq.geometry?.angles?.length||eq.geometry?.polygons?.length||eq.geometry?.lines?.length)) badges.push('rótulo');
  return badges;
}

function renderCurveSummary(target,eq){
  target.innerHTML='';
  const expr=document.createElement('span');
  expr.className='row-summary-expr';
  expr.textContent=formatMathVisual(eq.text) || 'função vazia';
  target.appendChild(expr);

  const badges=curveSummaryBadges(eq);
  if(!badges.length) return;
  const strip=document.createElement('span');
  strip.className='row-summary-badges';
  badges.forEach(label=>{
    const badge=document.createElement('span');
    badge.className='row-badge';
    if(label==='erro') badge.dataset.tone='error';
    if(label==='oculta') badge.dataset.tone='muted';
    badge.textContent=label;
    strip.appendChild(badge);
  });
  target.appendChild(strip);
}

function updateRowSelection(){
  if(!rowsEl) return;
  rowsEl.querySelectorAll('.row').forEach(row=>{
    row.dataset.selected=row.dataset.eqId===String(selectedEquationId) ? '1' : '0';
  });
}

function selectEquation(eq){
  if(!eq) return;
  selectedEquationId=eq.id;
  focusedEquation=eq;
  updateRowSelection();
}

function escapeRegExp(text){
  return String(text).replace(/[.*+?^${}()|[\]\\]/g,'\\$&');
}

function replaceIdentifier(src, from, to){
  const re=new RegExp('(^|[^a-zA-Z0-9\\u03c0])'+escapeRegExp(from)+'(?=$|[^a-zA-Z0-9\\u03c0])','g');
  return String(src).replace(re,(_,prefix)=>prefix+to);
}

function dataCommand(raw){
  const m=String(raw||'').trim().match(DATA_COMMAND_RE);
  return m ? {name:m[1].toLowerCase(), body:m[2].trim()} : null;
}

function parseSeriesArgs(src){
  const parts=splitTop(String(src||''), ',').map(part=>part.trim()).filter(Boolean);
  if(parts.length<4) return null;
  const varName=parts[0];
  if(!/^[a-zA-Z][a-zA-Z0-9]*$/.test(varName)) return null;
  return {varName, from:parts[1], to:parts[2], body:parts.slice(3).join(',')};
}

function parseSeriesCall(src, name){
  const trimmed=String(src||'').trim();
  const re=new RegExp('^'+name+'\\s*\\((.*)\\)$','i');
  const m=trimmed.match(re);
  return m ? parseSeriesArgs(m[1]) : null;
}

function seriesSource(series, varName=series.varName, body=series.body){
  return 'seq('+varName+','+series.from+','+series.to+','+body+')';
}

function seriesCommand(series){
  return 'seq: '+series.varName+','+series.from+','+series.to+','+series.body;
}

function sumCommand(series){
  return 'sum('+series.varName+','+series.from+','+series.to+','+series.body+')';
}

function fitSseCommand(series, fitName='fit2'){
  const innerVar=series.varName==='j' ? 'i' : 'j';
  const innerBody=replaceIdentifier(series.body, series.varName, innerVar);
  const model=fitName+'('+seriesSource(series, innerVar, innerBody)+','+series.varName+')';
  return 'sum('+series.varName+','+series.from+','+series.to+',('+series.body+'-'+model+')^2)';
}

function explicitPointSource(eq){
  if(!validPoints(eq.points)) return null;
  return eq.points.map(p=>'('+fmt(p.x)+','+fmt(p.y)+')').join(',');
}

function histogramSourceForContext(ctx){
  if(ctx.series) return seriesSource(ctx.series);
  if(validPoints(ctx.points)) return ctx.points.map(p=>fmt(p.y)).join(',');
  return null;
}

function statsContext(eq){
  const raw=String(eq.text||'').trim();
  const command=dataCommand(raw);
  if(command){
    if(command.name==='seq'){
      const series=parseSeriesArgs(command.body);
      return series ? {kind:'seq', series, source:seriesSource(series), canFit:true, canSum:true, points:eq.points} : null;
    }
    if(command.name==='points'){
      const series=parseSeriesCall(command.body,'seq');
      const points=parsePoints(command.body) || (validPoints(eq.points) ? eq.points : null);
      return {kind:'points', series, points, source:series ? seriesSource(series) : command.body, canFit:!!series||!!points};
    }
    if(/^fit\d*$/.test(command.name)||['fitexp','fitpow','fitlog','fitsig'].includes(command.name)){
      const series=parseSeriesCall(command.body,'seq');
      const points=parsePoints(command.body) || (series ? null : null);
      return {kind:'fit', model:command.name, series, points, source:series ? seriesSource(series) : command.body, canFit:true};
    }
    if(command.name==='hist'||command.name==='histogram'){
      const series=parseSeriesCall(command.body,'seq');
      return series ? {kind:'hist', series, source:seriesSource(series), canFit:true} : null;
    }
  }
  const sumSeries=parseSeriesCall(raw,'sum');
  if(sumSeries) return {kind:'sum', series:sumSeries, source:seriesSource(sumSeries), canFit:true, canSum:false};
  if(eq.kind==='points'&&validPoints(eq.points)){
    const source=explicitPointSource(eq);
    return source ? {kind:'points', points:eq.points, source, canFit:true} : null;
  }
  return null;
}

function addDerivedEquation(origin, text, options={}){
  const derived=applyEquationOptions(makeEq(text), {
    params:{...(origin?.params||{})},
    style:options.style || 'dashed',
    name:options.name || ''
  });
  const index=equations.indexOf(origin);
  if(index>=0) equations.splice(index+1,0,derived);
  else equations.push(derived);
  selectedEquationId=derived.id;
  focusedEquation=derived;
  recompileAllEquations();
  renderRows();
  draw();
  scheduleSave();
  const row=rowsEl.querySelector('.row[data-eq-id="'+derived.id+'"]');
  const input=row?.querySelector('.field');
  if(input) input.focus();
}

function contextActionsForEq(eq){
  const ctx=statsContext(eq);
  if(!ctx||eq.error) return [];
  const actions=[];
  const push=(label,title,text,style='dashed')=>{
    if(!text) return;
    actions.push({label,title,run:()=>addDerivedEquation(eq,text,{style})});
  };
  if(ctx.kind==='sum'&&ctx.series){
    push('seq','Criar a sequência dos termos',seriesCommand(ctx.series),'solid');
  }
  if(ctx.kind==='seq'&&ctx.series){
    push('\u03a3','Somar os termos da sequência',sumCommand(ctx.series),'solid');
  }
  if(ctx.canFit&&ctx.source){
    push('fit','Criar ajuste linear','fit: '+ctx.source);
    push('fit2','Criar ajuste quadrático','fit2: '+ctx.source);
    push('fit3','Criar ajuste cúbico','fit3: '+ctx.source);
    push('fit4','Criar ajuste polinomial grau 4','fit4: '+ctx.source);
    push('fitexp','Criar ajuste exponencial','fitexp: '+ctx.source);
    push('fitpow','Criar ajuste de potência','fitpow: '+ctx.source);
    push('fitlog','Criar ajuste logarítmico','fitlog: '+ctx.source);
    push('fitsig','Criar ajuste sigmoidal','fitsig: '+ctx.source);
  }
  const histSource=histogramSourceForContext(ctx);
  if(histSource) push('hist','Criar histograma dos valores','hist: '+histSource,'solid');
  if(ctx.source && (ctx.kind==='points'||ctx.kind==='hist'||ctx.kind==='seq')){
    push('stats','Resumo estatístico dos valores','stats: '+ctx.source,'solid');
  }
  if(ctx.source&&ctx.canFit){
    push('cmp','Comparar ajustes por erro','compare: '+ctx.source,'solid');
    push('resid','Desenhar resíduos do ajuste','resid: '+(ctx.model||'fit2')+', '+ctx.source,'dotted');
  }
  if(ctx.series) push('SSE','Somar resíduos quadráticos contra fit2',fitSseCommand(ctx.series),'dotted');
  return actions;
}

function renderContextActions(eq, target){
  target.innerHTML='';
  const actions=contextActionsForEq(eq);
  actions.forEach(action=>{
    const button=document.createElement('button');
    button.type='button';
    button.className='context-action';
    button.textContent=action.label;
    button.title=action.title;
    button.onclick=ev=>{
      ev.preventDefault();
      ev.stopPropagation();
      selectEquation(eq);
      action.run();
      notifyLessonAction('input');
    };
    target.appendChild(button);
  });
}

function renderRows(){
  transformControllers.forEach(controller=>controller.dispose()); transformControllers.clear();
  transform3dControllers.forEach(controller=>controller.dispose()); transform3dControllers.clear();
  resultRefreshers.clear();
  rowsEl.innerHTML='';
  equations.forEach((eq,index)=>{
    const row=document.createElement('div');
    row.className='row';
    row.dataset.eqIndex=String(index);
    row.dataset.eqId=String(eq.id);
    row.dataset.err=eq.error?'1':'0';
    row.dataset.kind=eq.kind;
    row.dataset.collapsed=eq.collapsed?'1':'0';
    row.dataset.selected=selectedEquationId===eq.id?'1':'0';
    row.dataset.hasResultTable=hasResultTable(eq)?'1':'0';
    row.tabIndex=0;
    row.addEventListener('pointerdown',()=>selectEquation(eq));
    row.addEventListener('focusin',()=>selectEquation(eq));

    const head=document.createElement('div');
    head.className='row-head';

    const chip=document.createElement('button');
    chip.className='chip';
    chip.style.background=eqColor(eq);
    chip.dataset.off=eq.visible?'0':'1';
    chip.title="Editar cor e estilo da linha";
    chip.onclick=(ev)=>{ openStyleEditor(eq, chip); ev.stopPropagation(); };

    const eye=document.createElement('button');
    eye.className='eye'; eye.dataset.on=eq.visible?'1':'0';
    eye.title="Ativar/desativar";
    eye.textContent=eq.visible?'\u25c9':'\u25cb';
    eye.onclick=()=>{
      eq.visible=!eq.visible;
      eye.dataset.on=eq.visible?'1':'0';
      eye.textContent=eq.visible?'\u25c9':'\u25cb';
      chip.dataset.off=eq.visible?'0':'1';
      renderCurveSummary(summary,eq);
      // Automatic surface/plane intersections depend on the *visible* planes:
      // rebuilding is required when their eye toggle changes.
      if(eq.geometry?.type==='plane'||equations.some(item=>item.geometry?.generalQuadric||item.geometry?.implicitSurface)){
        recompileAllEquations();
        resultRefreshers.forEach(refresh=>refresh());
      }
      draw();
      scheduleSave();
    };

    const name=document.createElement('input');
    name.className='row-name';
    name.value=eq.name || '';
    name.placeholder=defaultEqName(eq);
    name.spellcheck=false;
    name.autocomplete='off';
    name.title='Nome da curva';
    name.oninput=()=>{
      eq.name=name.value.trim();
      scheduleSave();
    };

    const type=document.createElement('span');
    type.className='row-type';
    type.textContent=curveTypeLabel(eq);

    const toggle=document.createElement('button');
    toggle.className='row-toggle';
    toggle.type='button';
    toggle.title=eq.collapsed?'Expandir curva':'Recolher curva';
    toggle.setAttribute('aria-label',toggle.title);
    toggle.textContent=eq.collapsed?'\u203a':'\u2304';
    toggle.onclick=()=>{
      eq.collapsed=!eq.collapsed;
      renderCurveSummary(summary,eq);
      row.dataset.collapsed=eq.collapsed?'1':'0';
      toggle.title=eq.collapsed?'Expandir curva':'Recolher curva';
      toggle.setAttribute('aria-label',toggle.title);
      toggle.textContent=eq.collapsed?'\u203a':'\u2304';
      scheduleSave();
    };

    const del=document.createElement('button');
    del.className='del'; del.textContent='\u00d7'; del.title="Remover";
    del.onclick=()=>{
      const i=equations.indexOf(eq);
      if(i>=0) equations.splice(i,1);
      if(equations.length===0) equations.push(makeEq(''));
      recompileAllEquations();
      renderRows(); draw();
      scheduleSave();
    };

    head.append(eye,chip,name,type,toggle,del);

    const summary=document.createElement('button');
    summary.className='row-summary';
    summary.type='button';
    summary.title='Expandir curva';
    renderCurveSummary(summary,eq);
    summary.onclick=()=>{
      eq.collapsed=false;
      renderRows();
      scheduleSave();
    };

    const body=document.createElement('div');
    body.className='row-body';

    const wrap=document.createElement('div'); wrap.className='field-wrap';
    const input=document.createElement('input');
    let refreshControls=()=>{};
    input.className='field'; input.value=eq.text;
    input.dataset.lessonField='text';
    input.spellcheck=false; input.autocomplete='off';
    input.placeholder='f(x) = x\u00b2   ou   sin(x)';
    input.onfocus=()=>{ focusedInput=input; focusedEquation=eq; };
    const applyTextChange=(value)=>{
      const before=eq.paramNames.join(',');
      eq.text=value;
      if(input.value!==value) input.value=value;
      recompileAllEquations();
      row.dataset.err=eq.error?'1':'0';
      row.dataset.kind=eq.kind;
      row.dataset.hasResultTable=hasResultTable(eq)?'1':'0';
      type.textContent=curveTypeLabel(eq);
      if(!eq.name) name.placeholder=defaultEqName(eq);
      renderCurveSummary(summary,eq);
      refreshVisual();
      refreshMathInfo();
      if(before!==eq.paramNames.join(',')) refreshParamControls();
      refreshControls();
      refreshConicDemo();
      refreshSurfacePointControls();
      refreshOps();
      renderContextActions(eq, contextActions);
      draw();
      scheduleSave();
      resultRefreshers.forEach((refresh,id)=>{if(id!==eq.id)refresh();});
      notifyLessonAction('input');
    };
    input.oninput=()=>{ applyTextChange(input.value); refreshDataTable(); };
    input.onkeydown=(ev)=>{
      if(ev.key==='Enter'){ addEquation(''); }
    };
    wrap.appendChild(input);
    const visual=document.createElement('output');
    visual.className='math-visual';
    visual.setAttribute('aria-label','Expressão em notação matemática');
    const refreshVisual=()=>{ visual.textContent=formatMathVisual(eq.text); };
    refreshVisual();
    wrap.appendChild(visual);

    const tableHost=document.createElement('div');
    tableHost.className='data-table-host';
    const tableZone=document.createElement('div');
    tableZone.className='data-table-zone';
    const dataModel=()=>{
      const m=String(eq.text||'').match(DATA_COMMAND_RE);
      return m ? tableModel(m[1].toLowerCase(), m[2]) : null;
    };
    const refreshDataTableZone=()=>{
      const model=dataModel();
      const hasTableButton=tableZone.contains(dataTableBtn);
      if(model&&!hasTableButton) tableZone.prepend(dataTableBtn);
      if(!model&&hasTableButton) dataTableBtn.remove();
      tableZone.hidden=!model;
    };
    const refreshDataTable=()=>{
      refreshDataTableZone();
      tableHost.innerHTML='';
      if(!eq.showTable) return;
      const model=dataModel();
      const m=eq.text.match(DATA_COMMAND_RE);
      if(model && m) dataTable.render(tableHost, {
        kind:model.kind,
        rows:model.rows,
        onCommit:body=>applyTextChange(m[1]+': '+body)
      });
    };
    const dataTableBtn=document.createElement('button');
    dataTableBtn.className='calc';
    dataTableBtn.textContent='⊞ tabela';
    dataTableBtn.title='Editar os dados em uma tabela';
    dataTableBtn.dataset.on=eq.showTable?'1':'0';
    dataTableBtn.onclick=()=>{
      eq.showTable=!eq.showTable;
      dataTableBtn.dataset.on=eq.showTable?'1':'0';
      refreshDataTable();
    };
    tableZone.append(tableHost);

    const controls=document.createElement('div');
    controls.className='row-tools';
    const contextActions=document.createElement('div');
    contextActions.className='row-context-actions';
    renderContextActions(eq, contextActions);
    const info=document.createElement('div');
    info.className='row-info';
    const stepsZone=document.createElement('div');
    stepsZone.className='steps-zone';
    const paramControls=document.createElement('div');
    paramControls.className='param-tools';
    const conicDemoZone=document.createElement('div');
    conicDemoZone.className='conic-rotation-demo';
    const refreshConicDemo=()=>{
      conicDemoZone.replaceChildren();
      const demo=eq.geometry?.conics?.[0]?.analysis?.rotationDemo;
      conicDemoZone.hidden=!demo;
      if(!demo)return;
      let sequence=0;
      eq.conicDemoProgress=Number.isFinite(eq.conicDemoProgress)?
        Math.max(0,Math.min(1,eq.conicDemoProgress)):0;
      const caption=document.createElement('strong');
      caption.textContent='Diagonalização · rotação dos eixos principais';
      const slider=document.createElement('input');
      slider.type='range';slider.min='0';slider.max='100';slider.step='1';
      slider.value=String(Math.round(eq.conicDemoProgress*100));
      slider.setAttribute('aria-label','Progresso da rotação dos eixos da cônica');
      const output=document.createElement('output');
      const describe=()=>{
        const data=eq.geometry?.conics?.[0]?.analysis?.rotationDemo||demo;
        const theta=data.angle*Math.PI/180*eq.conicDemoProgress;
        const [A,B,C]=data.coefficients,cos=Math.cos(theta),sin=Math.sin(theta);
        const mixed=2*(C-A)*cos*sin+B*(cos*cos-sin*sin);
        output.textContent='θ = '+(theta*180/Math.PI).toFixed(1)+'° · termo misto B′ = '+(Math.abs(mixed)<1e-9?0:mixed).toFixed(4);
      };
      const play=document.createElement('button');
      play.type='button';play.textContent='▶ animar';
      play.title='Demonstrar a rotação dos eixos até eliminar o termo misto';
      slider.oninput=()=>{
        sequence++;
        eq.conicDemoProgress=Number(slider.value)/100;
        describe();draw();
      };
      play.onclick=()=>{
        const id=++sequence,start=performance.now();
        eq.conicDemoProgress=0;
        const step=time=>{
          if(id!==sequence||!document.body.contains(play)||!equations.includes(eq))return;
          eq.conicDemoProgress=Math.min(1,Math.max(0,(time-start)/2600));
          slider.value=String(Math.round(eq.conicDemoProgress*100));
          describe();draw();
          if(eq.conicDemoProgress<1)requestAnimationFrame(step);
        };
        requestAnimationFrame(step);
      };
      describe();
      conicDemoZone.append(caption,slider,output,play);
    };
    const surfacePointZone=document.createElement('div');
    surfacePointZone.className='surface-point-controls';
    const refreshSurfacePointControls=()=>{
      surfacePointZone.replaceChildren();
      const surface=eq.geometry?.multivar;
      surfacePointZone.hidden=!surface;
      if(!surface)return;
      const header=document.createElement('strong');
      header.textContent='Cálculo multivariável · ponto de inspeção P';
      surfacePointZone.append(header);
      for(const [axis,index] of [['x',0],['y',1]]){
        const line=document.createElement('label');
        line.className='surface-point-axis';
        const title=document.createElement('span');
        title.textContent='P · '+axis;
        const slider=document.createElement('input');
        slider.type='range';slider.min=-surface.extent;slider.max=surface.extent;slider.step='.05';
        slider.value=eq.surfacePoint?.[index]??0;
        slider.setAttribute('aria-label','Coordenada '+axis+' do ponto P');
        const number=document.createElement('input');
        number.type='number';number.min=slider.min;number.max=slider.max;number.step='.05';
        number.value=slider.value;
        const setPoint=value=>{
          if(!Number.isFinite(Number(value)))return;
          const v=Math.max(-surface.extent,Math.min(surface.extent,Number(value)));
          eq.surfacePoint=Array.isArray(eq.surfacePoint)?[...eq.surfacePoint]:[0,0];
          eq.surfacePoint[index]=v;
          slider.value=v;number.value=v;
          recompileAllEquations();
          refreshMathInfo();draw();scheduleSave();
        };
        slider.oninput=()=>setPoint(slider.value);
        number.oninput=()=>setPoint(number.value);
        line.append(title,slider,number);surfacePointZone.append(line);
      }
      const directionLabel=document.createElement('label');
      directionLabel.className='surface-point-axis';
      const angleName=document.createElement('span');
      angleName.textContent='θ · direção';
      const angleSlider=document.createElement('input');
      angleSlider.type='range';angleSlider.min='-180';angleSlider.max='180';angleSlider.step='1';
      angleSlider.value=eq.surfaceDirection||0;
      angleSlider.setAttribute('aria-label','Direção da derivada direcional em graus');
      const angleNumber=document.createElement('input');
      angleNumber.type='number';angleNumber.min='-180';angleNumber.max='180';angleNumber.step='1';
      angleNumber.value=angleSlider.value;
      const setAngle=value=>{
        if(!Number.isFinite(Number(value)))return;
        eq.surfaceDirection=Math.max(-180,Math.min(180,Number(value)));
        angleSlider.value=eq.surfaceDirection;angleNumber.value=eq.surfaceDirection;
        recompileAllEquations();refreshMathInfo();draw();scheduleSave();
      };
      angleSlider.oninput=()=>setAngle(angleSlider.value);
      angleNumber.oninput=()=>setAngle(angleNumber.value);
      directionLabel.append(angleName,angleSlider,angleNumber);
      surfacePointZone.append(directionLabel);
      const note=document.createElement('span');
      note.textContent='Clique na superfície 3D para escolher P · altere θ para a derivada direcional · curvas de nível à direita';
      surfacePointZone.append(note);
    };
    const opTools=document.createElement('div');
    opTools.className='op-tools';
    const transformZone=document.createElement('details');
    const transformSummary=document.createElement('summary'); transformSummary.textContent='transformação 2D';
    const transformHost=document.createElement('div'); transformZone.append(transformSummary,transformHost);
    const transform3dZone=document.createElement('details');
    const transform3dSummary=document.createElement('summary');
    transform3dSummary.textContent='transformação 3D';
    const transform3dHost=document.createElement('div');
    transform3dZone.append(transform3dSummary,transform3dHost);
    let matrix3dSignature='';
    const getTransformMatrix3d=()=>{
      const value=eq.algebraResult?.kind==='svd' ? eq.algebraInput : eq.algebraResult?.value;
      return Array.isArray(value)&&value.length===3&&value.every(row=>
        Array.isArray(row)&&row.length===3&&row.every(Number.isFinite)) ? value : null;
    };
    const refreshTransform3d=()=>{
      const matrix=!eq.error&&getTransformMatrix3d();
      transform3dZone.hidden=!matrix;
      const active=!!matrix&&!!eq.showAlgebraTransform3d;
      transform3dZone.open=active;
      if(!active){
        transform3dControllers.get(eq.id)?.dispose();
        transform3dControllers.delete(eq.id);
        eq.transformScene3d=null;
        return;
      }
      const signature=JSON.stringify(matrix),controller=transform3dControllers.get(eq.id);
      if(controller){
        if(signature!==matrix3dSignature)controller.refresh();
      }else{
        transform3dHost.replaceChildren();
        transform3dControllers.set(eq.id,createTransform3DControls(transform3dHost,{
          getMatrix:getTransformMatrix3d,
          onScene:scene=>{eq.transformScene3d=scene;draw();},
          onChange:()=>notifyLessonAction('transform')
        }));
      }
      matrix3dSignature=signature;
    };
    transform3dZone.addEventListener('toggle',()=>{
      if(!getTransformMatrix3d())return;
      eq.showAlgebraTransform3d=transform3dZone.open;
      refreshTransform3d();
      draw();scheduleSave();
    });
    let matrixSignature='';
    const getTransformMatrix=()=>{
      const value=eq.geometry?.matrix?.values || (eq.algebraResult?.kind==='svd' ? eq.algebraInput : eq.algebraResult?.value);
      return Array.isArray(value)&&value.length===2&&value.every(row=>Array.isArray(row)&&row.length===2) ? value : null;
    };
    const refreshTransform=()=>{
      const matrix=!eq.error&&getTransformMatrix();
      transformZone.hidden=!matrix;
      if(!matrix){transformControllers.get(eq.id)?.dispose();transformControllers.delete(eq.id);eq.transformScene=null;return;}
      const active=eq.kind==='geometry'||!!eq.showAlgebraTransform;
      transformZone.open=active;
      if(!active){transformControllers.get(eq.id)?.dispose();transformControllers.delete(eq.id);eq.transformScene=null;return;}
      const signature=JSON.stringify(matrix), controller=transformControllers.get(eq.id);
      if(controller){if(signature!==matrixSignature)controller.refresh();}
      else {
        transformHost.replaceChildren();
        transformControllers.set(eq.id,createTransformControls(transformHost,{
          getMatrix:getTransformMatrix,
          onScene:scene=>{eq.transformScene=scene;draw();},
          onChange:t=>{eq.transformT=t;notifyLessonAction('transform');}
        }));
      }
      matrixSignature=signature;
    };
    transformZone.addEventListener('toggle',()=>{
      if(eq.kind==='geometry') return;
      eq.showAlgebraTransform=transformZone.open; refreshTransform(); draw(); scheduleSave();
    });
    const renderInformationLines=value=>{
      info.replaceChildren();
      for(const line of splitInfoLines(value)){
        const {label,value:text}=infoLabelValue(line);
        const item=document.createElement('div');
        item.className='row-info-line';
        if(label){
          const key=document.createElement('strong');
          key.className='row-info-key';
          key.textContent=formatMathVisual(label)+':';
          item.append(key,document.createTextNode(' '));
        }
        const detail=document.createElement('span');
        detail.textContent=formatMathVisual(text);
        item.appendChild(detail);
        info.appendChild(item);
      }
    };
    const refreshMathInfo=()=>{
      info.classList.remove('algebra-result');
      if(eq.error){info.replaceChildren();info.textContent=eq.errorMessage||eq.geometry?.error||'Expressão inválida.';}
      else if(eq.kind==='result' && eq.algebraResult) renderAlgebraResult(info,eq.algebraResult);
      else if(eq.kind==='stats' && eq.showResultTable) renderStatsGrid(eq, info);
      else if(eq.kind==='histogram' && eq.showResultTable) renderHistogramGrid(eq, info);
      else if(eq.kind==='regression' && eq.showResultTable) renderFitParameterGrid(eq, info);
      else if(eq.kind==='fitcompare' && eq.showResultTable) renderCompareGrid(eq, info);
      else if(eq.kind==='points' && eq.pointLabel==='resid' && eq.showResultTable) renderResidualGrid(eq, info);
      else renderInformationLines(mathInfo(eq));
      const notice=viewNotice(eq,view3d.mode);
      if(notice){
        const note=document.createElement('div');
        note.className='row-info-line view-notice';
        note.textContent=notice;
        info.append(note);
      }
      renderStepsZone(eq, stepsZone);
      refreshTransform();
      refreshTransform3d();
    };
    resultRefreshers.set(eq.id,()=>{row.dataset.err=eq.error?'1':'0';row.dataset.kind=eq.kind;refreshMathInfo();renderCurveSummary(summary,eq);});
    const refreshOps=()=>opControls.render(eq, opTools, ()=>{
      refreshMathInfo();
      renderCurveSummary(summary,eq);
    });
    const rowStartParams={...eq.params};
    const refreshParamControls=()=>{
      paramControls.innerHTML='';
      paramControls.dataset.kind='';
      if(!eq.paramNames?.length) return;
      const isSliceRow=/^\s*(?:corte|cortequadrica|quadricsection)\s*:/i.test(eq.text);
      const isSectionRow=/^\s*(?:secao|seccao|secaocone|section)\s*:/i.test(eq.text)||isSliceRow;
      const isTangentRow=/^\s*(?:tangente|tangent|gradiente|gradient)\s*:/i.test(eq.text);
      const isQuadricRow=/^\s*(?:quadrica|quadricas|quadric)\s*:/i.test(eq.text)||isTangentRow;
      const lab=isSectionRow||isQuadricRow;
      paramControls.dataset.kind=isSectionRow?'section':isQuadricRow?'quadric':'';
      const groupNodes=new Map();
      if(lab){
        const groups=isTangentRow?[
          ['ponto','Ponto na superfície',['u','v','r']],
          ['superficie','Escalas da superfície',['a','b','c','d']]
        ]:isSliceRow?[
          ['plano','Plano secante',['q','p','h']],
          ['superficie','Superfície quádrica',['a','b','c','d']]
        ]:isSectionRow?[
          ['plano','Plano secante',['q','k','b','h','p']],
          ['cone','Cone duplo',['a','d']]
        ]:[
          ['escala','Escalas da superfície',['a','b','c']],
          ['posicao','Posição',['d']]
        ];
        for(const [id,title,names] of groups){
          const details=document.createElement('details');
          details.className='param-group';details.open=true;details.dataset.group=id;
          const summary=document.createElement('summary');summary.textContent=title;
          const wrap=document.createElement('div');wrap.className='param-group-grid';
          details.append(summary,wrap);paramControls.appendChild(details);
          for(const name of names)groupNodes.set(name,wrap);
        }
      }
      eq.paramNames.forEach(name=>{
        // Limits for conic-section parameters must not change the same symbols
        // used in unrelated matrix and function expressions.
        const isSection=/^\s*(?:secao|seccao|secaocone|section)\s*:/i.test(eq.text);
        const sectionControls={
          h:{min:0.25,max:4.5,step:0.05,label:'h · altura do plano ao vértice'},
          k:{min:-3,max:3,step:0.05,label:'k · inclinação (razão)'}, 
          q:{min:-90,max:90,step:1,label:'q · inclinação do plano (°), até vertical'},
          b:{min:-4,max:4,step:0.05,label:'b · afastamento horizontal do plano (±X)'},
          a:{min:0.4,max:2.5,step:0.05,label:'a · abertura do cone'},
          d:{min:-4,max:4,step:0.1,label:'d · altura do vértice'},
          p:{min:-3.14,max:3.14,step:0.05,label:'p · rotação do plano (rad)'}
        };
        const isQuadric=/^\s*(?:quadrica|quadricas|quadric|tangente|tangent|gradiente|gradient)\s*:/i.test(eq.text);
        const sliceControls={
          q:{min:-90,max:90,step:1,label:'q · inclinação do plano (graus)'},
          p:{min:-180,max:180,step:2,label:'p · azimute do plano (graus)'},
          h:{min:-8,max:8,step:.1,label:'h · distância assinada do plano'},
          a:{min:.25,max:5,step:.05,label:'a · escala X'},
          b:{min:.25,max:5,step:.05,label:'b · escala Y'},
          c:{min:.25,max:5,step:.05,label:'c · escala Z'},
          d:{min:-5,max:5,step:.1,label:'d · altura da superfície'}
        };
        const quadricControls={
          a:{min:.25,max:5,step:.05,label:'a · escala X'},
          b:{min:.25,max:5,step:.05,label:'b · escala Y'},
          c:{min:.25,max:5,step:.05,label:'c · escala Z'},
          d:{min:-5,max:5,step:.1,label:'d · altura da superfície'},
          u:{min:0,max:1,step:.01,label:'u · posição paramétrica na superfície'},
          v:{min:0,max:1,step:.01,label:'v · posição paramétrica na superfície'},
          r:{min:-1,max:1,step:2,label:'r · folha (−1 ou +1, hiperboloide duplo)'}
        };
        const limits=(isSliceRow&&sliceControls[name])||(isSection&&sectionControls[name])||(isQuadric&&quadricControls[name])||PARAM_LIMITS[name]||{min:-5,max:5,step:0.1};
        const param=document.createElement('label');
        param.className='param-control';
        param.dataset.param=name;
        param.dataset.lessonField='param';
        const label=document.createElement('span');
        label.textContent=limits.label||name;
        const range=document.createElement('input');
        range.type='range';
        range.min=limits.min;
        range.max=limits.max;
        range.step=limits.step;
        range.value=eq.params[name];
        const number=document.createElement('input');
        number.type='number';
        number.min=limits.min;
        number.max=limits.max;
        number.step=limits.step;
        number.value=eq.params[name];
        const setValue=value=>{
          const numeric=Number(value);
          if(!Number.isFinite(numeric)) return;
          const clamped=Math.min(Math.max(numeric,limits.min),limits.max);
          eq.params[name]=clamped;
          range.value=clamped;
          number.value=clamped;
          eq.analysisCache=null;
          recompileAllEquations();
          resultRefreshers.forEach(refresh=>refresh());
          draw();
          scheduleSave();
          notifyLessonAction('param');
        };
        range.oninput=()=>setValue(range.value);
        number.oninput=()=>setValue(number.value);
        const play=document.createElement('button');
        play.type='button'; play.className='param-play';
        play.title='Animar parâmetro';
        play.textContent = animations.has(animKey(eq,name)) ? '⏸' : '▶';
        play.onclick=(ev)=>{
          ev.preventDefault();
          const on=toggleAnim(eq,name,limits,range,number);
          play.textContent = on ? '⏸' : '▶';
          if(!on) scheduleSave();
        };
        // Rebind an already-running animation to the freshly created controls.
        const a=animations.get(animKey(eq,name));
        if(a){ a.range=range; a.number=number; }
        param.append(label,range,number,play);
        (groupNodes.get(name)||paramControls).appendChild(param);
      });
      if(lab){
        const reset=document.createElement('button');
        reset.type='button';reset.className='param-reset';
        reset.title='Restaurar valores desta construção';
        reset.textContent='↺ restaurar parâmetros';
        reset.onclick=()=>{
          for(const name of eq.paramNames){
            if(Number.isFinite(rowStartParams[name]))eq.params[name]=rowStartParams[name];
          }
          recompileAllEquations();
          refreshParamControls();
          resultRefreshers.forEach(refresh=>refresh());
          draw();scheduleSave();notifyLessonAction('param');
        };
        paramControls.appendChild(reset);
      }
    };

    const dBtn=document.createElement('button');
    dBtn.className='calc'; dBtn.textContent="f\u2032"; dBtn.title="Derivada: inclinação instantânea";
    dBtn.dataset.calcField='showD';
    dBtn.dataset.on=eq.showD?'1':'0';
    dBtn.onclick=()=>{ eq.showD=!eq.showD; dBtn.dataset.on=eq.showD?'1':'0'; refreshMathInfo(); refreshOps(); renderCurveSummary(summary,eq); draw(); scheduleSave(); };

    const d2Btn=document.createElement('button');
    d2Btn.className='calc'; d2Btn.textContent="f″"; d2Btn.title="Segunda derivada: concavidade";
    d2Btn.dataset.calcField='showD2';
    d2Btn.dataset.on=eq.showD2?'1':'0';
    d2Btn.onclick=()=>{ eq.showD2=!eq.showD2; d2Btn.dataset.on=eq.showD2?'1':'0'; refreshMathInfo(); refreshOps(); renderCurveSummary(summary,eq); draw(); scheduleSave(); };

    const iBtn=document.createElement('button');
    iBtn.className='calc'; iBtn.textContent="\u222b"; iBtn.title="Integral acumulada desde x=0";
    iBtn.dataset.calcField='showI';
    iBtn.dataset.on=eq.showI?'1':'0';
    iBtn.onclick=()=>{ eq.showI=!eq.showI; iBtn.dataset.on=eq.showI?'1':'0'; refreshMathInfo(); refreshOps(); renderCurveSummary(summary,eq); draw(); scheduleSave(); };

    const rBtn=document.createElement('button');
    rBtn.className='calc'; rBtn.textContent="\u03a3"; rBtn.title="Soma de Riemann no intervalo [a,b]";
    rBtn.dataset.calcField='showR';
    rBtn.dataset.on=eq.showR?'1':'0';
    rBtn.onclick=()=>{ eq.showR=!eq.showR; rBtn.dataset.on=eq.showR?'1':'0'; refreshMathInfo(); refreshOps(); renderCurveSummary(summary,eq); draw(); scheduleSave(); };

    const lBtn=document.createElement('button');
    lBtn.className='calc'; lBtn.textContent="lim"; lBtn.title="Limite bilateral e limites laterais";
    lBtn.dataset.calcField='showL';
    lBtn.dataset.on=eq.showL?'1':'0';
    lBtn.onclick=()=>{ eq.showL=!eq.showL; lBtn.dataset.on=eq.showL?'1':'0'; refreshMathInfo(); refreshOps(); renderCurveSummary(summary,eq); draw(); scheduleSave(); };

    const aBtn=document.createElement('button');
    aBtn.className='calc'; aBtn.textContent="\u2315"; aBtn.title="Analisar domínio, interceptos, extremos e assíntotas";
    aBtn.dataset.calcField='showA';
    aBtn.dataset.on=eq.showA?'1':'0';
    aBtn.onclick=()=>{ eq.showA=!eq.showA; aBtn.dataset.on=eq.showA?'1':'0'; refreshMathInfo(); renderCurveSummary(summary,eq); draw(); scheduleSave(); };

    const statsPopBtn=document.createElement('button');
    statsPopBtn.className='calc';
    statsPopBtn.dataset.opField='statsPop';
    statsPopBtn.textContent=eq.statsPop?'população':'amostra';
    statsPopBtn.title='Alternar desvio amostral (n−1) e populacional (n)';
    statsPopBtn.dataset.on=eq.statsPop?'1':'0';
    statsPopBtn.onclick=()=>{
      eq.statsPop=!eq.statsPop;
      statsPopBtn.dataset.on=eq.statsPop?'1':'0';
      statsPopBtn.textContent=eq.statsPop?'população':'amostra';
      refreshMathInfo();
      renderCurveSummary(summary,eq);
      draw();
      scheduleSave();
      notifyLessonAction('op');
    };

    const resultTableBtn=document.createElement('button');
    resultTableBtn.className='calc';
    resultTableBtn.textContent='tabela';
    resultTableBtn.title='Mostrar/ocultar tabela desta análise';
    resultTableBtn.dataset.on=eq.showResultTable?'1':'0';
    resultTableBtn.onclick=()=>{
      eq.showResultTable=!eq.showResultTable;
      resultTableBtn.dataset.on=eq.showResultTable?'1':'0';
      refreshMathInfo();
      renderCurveSummary(summary,eq);
      scheduleSave();
      notifyLessonAction('op');
    };

    const refreshGeometryControls=()=>{
      const hasTriangleClass=!!eq.geometry?.triangleClass;
      const hasAngles=!!eq.geometry?.angles?.length;
      const hasSegments=!!eq.geometry?.segments?.length;
      const hasVectors=!!eq.geometry?.vectors?.length;
      const hasLines=!!eq.geometry?.lines?.length;
      const hasXAxisAngle=hasLines||hasVectors;

      const typeBtn=document.createElement('button');
      typeBtn.className='calc';
      typeBtn.textContent='tipo';
      typeBtn.title=hasTriangleClass ? 'Mostrar classificação do triângulo no gráfico' : 'Esta construção não é um triângulo classificado';
      typeBtn.disabled=!hasTriangleClass;
      typeBtn.dataset.on=hasTriangleClass&&eq.showGeoTriangleClass?'1':'0';
      typeBtn.onclick=()=>{
        if(!hasTriangleClass) return;
        eq.showGeoTriangleClass=!eq.showGeoTriangleClass;
        typeBtn.dataset.on=eq.showGeoTriangleClass?'1':'0';
        renderCurveSummary(summary,eq);
        draw();
        scheduleSave();
      };

      const angleBtn=document.createElement('button');
      angleBtn.className='calc';
      angleBtn.textContent='âng';
      angleBtn.title=hasAngles ? 'Mostrar ângulos no gráfico' : 'Esta construção não tem ângulos calculados';
      angleBtn.disabled=!hasAngles;
      angleBtn.dataset.on=hasAngles&&eq.showGeoAngles!==false?'1':'0';
      angleBtn.onclick=()=>{
        if(!hasAngles) return;
        eq.showGeoAngles=eq.showGeoAngles===false;
        angleBtn.dataset.on=eq.showGeoAngles!==false?'1':'0';
        renderCurveSummary(summary,eq);
        draw();
        scheduleSave();
      };

      const angleExtBtn=document.createElement('button');
      angleExtBtn.className='calc';
      angleExtBtn.textContent='âng ext';
      angleExtBtn.title=hasAngles ? 'Separar ângulo externo (complementar externo)' : 'Esta construção não tem ângulos calculados';
      angleExtBtn.disabled=!hasAngles;
      angleExtBtn.dataset.on=hasAngles&&eq.showGeoAnglesExternal?'1':'0';
      angleExtBtn.onclick=()=>{
        if(!hasAngles) return;
        eq.showGeoAnglesExternal=!eq.showGeoAnglesExternal;
        angleExtBtn.dataset.on=eq.showGeoAnglesExternal?'1':'0';
        renderCurveSummary(summary,eq);
        draw();
        scheduleSave();
      };

      const angleCompBtn=document.createElement('button');
      angleCompBtn.className='calc';
      angleCompBtn.textContent='âng reflex';
      angleCompBtn.title=hasAngles ? 'Ângulo reflexo (360° − ângulo interno), completando 360°' : 'Esta construção não tem ângulos calculados';
      angleCompBtn.disabled=!hasAngles;
      angleCompBtn.dataset.on=hasAngles&&eq.showGeoAnglesComplement?'1':'0';
      angleCompBtn.onclick=()=>{
        if(!hasAngles) return;
        eq.showGeoAnglesComplement=!eq.showGeoAnglesComplement;
        angleCompBtn.dataset.on=eq.showGeoAnglesComplement?'1':'0';
        renderCurveSummary(summary,eq);
        draw();
        scheduleSave();
      };

      const sidesBtn=document.createElement('button');
      sidesBtn.className='calc';
      sidesBtn.textContent='lado';
      sidesBtn.title=hasSegments ? 'Mostrar comprimentos de lados e segmentos' : 'Esta construção não tem lados ou segmentos';
      sidesBtn.disabled=!hasSegments;
      sidesBtn.dataset.on=hasSegments&&eq.showGeoSideLengths?'1':'0';
      sidesBtn.onclick=()=>{
        if(!hasSegments) return;
        eq.showGeoSideLengths=!eq.showGeoSideLengths;
        sidesBtn.dataset.on=eq.showGeoSideLengths?'1':'0';
        refreshMathInfo();
        renderCurveSummary(summary,eq);
        draw();
        scheduleSave();
      };

      const vectorsBtn=document.createElement('button');
      vectorsBtn.className='calc';
      vectorsBtn.textContent='vetor';
      vectorsBtn.title=hasVectors ? 'Mostrar módulo/comprimento dos vetores (|v|)' : 'Esta construção não tem vetores; use em vetor, produto ou projeção';
      vectorsBtn.disabled=!hasVectors;
      vectorsBtn.dataset.on=hasVectors&&eq.showGeoVectorLengths?'1':'0';
      vectorsBtn.onclick=()=>{
        if(!hasVectors) return;
        eq.showGeoVectorLengths=!eq.showGeoVectorLengths;
        vectorsBtn.dataset.on=eq.showGeoVectorLengths?'1':'0';
        refreshMathInfo();
        renderCurveSummary(summary,eq);
        draw();
        scheduleSave();
      };

      const labelsBtn=document.createElement('button');
      labelsBtn.className='calc';
      labelsBtn.textContent='rótulo';
      labelsBtn.title='Mostrar/ocultar rótulos e medidas da geometria';
      labelsBtn.dataset.on=eq.showGeoLabels?'1':'0';
      labelsBtn.onclick=()=>{
        eq.showGeoLabels=!eq.showGeoLabels;
        labelsBtn.dataset.on=eq.showGeoLabels?'1':'0';
        renderCurveSummary(summary,eq);
        draw();
        scheduleSave();
      };

      const xAxisAngleBtn=document.createElement('button');
      xAxisAngleBtn.className='calc';
      xAxisAngleBtn.textContent='ang x';
      xAxisAngleBtn.title=hasXAxisAngle ? 'Mostrar ângulo em relação ao eixo x' : 'Esta construção não tem retas ou vetores';
      xAxisAngleBtn.disabled=!hasXAxisAngle;
      xAxisAngleBtn.dataset.on=hasXAxisAngle&&eq.showGeoXAxisAngles?'1':'0';
      xAxisAngleBtn.onclick=()=>{
        if(!hasXAxisAngle) return;
        eq.showGeoXAxisAngles=!eq.showGeoXAxisAngles;
        xAxisAngleBtn.dataset.on=eq.showGeoXAxisAngles?'1':'0';
        refreshMathInfo();
        renderCurveSummary(summary,eq);
        draw();
        scheduleSave();
      };

      controls.append(typeBtn,angleBtn,angleExtBtn,angleCompBtn,sidesBtn,vectorsBtn,labelsBtn);
      // 3D point rows: dashed guides to the xy plane and the x, y axes (on by default).
      if(hasGuidesChip(eq)){
        const guidesBtn=document.createElement('button');
        guidesBtn.className='calc';
        guidesBtn.textContent='guias';
        guidesBtn.title='Mostrar/ocultar as linhas-guia do ponto até o plano xy e os eixos';
        guidesBtn.dataset.on=eq.showGeoGuides!==false?'1':'0';
        guidesBtn.onclick=()=>{
          eq.showGeoGuides=eq.showGeoGuides===false;
          guidesBtn.dataset.on=eq.showGeoGuides?'1':'0';
          draw();
          scheduleSave();
        };
        controls.append(guidesBtn);
      }
      controls.append(xAxisAngleBtn);
      if(eq.geometry?.section&&eq.geometry?.scene3d?.some(p=>p.kind==='mesh')){
        const clipBtn=document.createElement('button');
        clipBtn.className='calc';
        const syncClip=()=>{
          clipBtn.dataset.on=eq.clipSide?'1':'0';
          clipBtn.textContent=eq.clipSide===1?'corte +':eq.clipSide===-1?'corte −':'recorte';
          clipBtn.title='Alternar superfície completa → metade positiva → metade negativa';
        };
        syncClip();
        clipBtn.onclick=()=>{
          eq.clipSide=eq.clipSide===1?-1:eq.clipSide===-1?0:1;
          recompileAllEquations();
          syncClip();resultRefreshers.forEach(refresh=>refresh());
          draw();scheduleSave();
        };
        controls.append(clipBtn);
      }
    };
    refreshControls=()=>{
      controls.innerHTML='';
      if(eq.kind==='result'){
        if(eq.systemScene||eq.systemScene3d){
          const show=document.createElement('button');show.type='button';show.className='calc';show.textContent=eq.systemScene3d?'ver planos 3D':'ver retas';
          show.dataset.on=eq.showAlgebraSystem?'1':'0';
          show.onclick=()=>{eq.showAlgebraSystem=!eq.showAlgebraSystem;show.dataset.on=eq.showAlgebraSystem?'1':'0';draw();scheduleSave();};
          controls.appendChild(show);
        }
        return;
      }
      if(eq.kind==='geometry') refreshGeometryControls();
      else if(hasResultTable(eq)){
        resultTableBtn.dataset.on=eq.showResultTable?'1':'0';
        controls.append(resultTableBtn);
        if(eq.statsKind==='1var'){
          statsPopBtn.textContent=eq.statsPop?'população':'amostra';
          statsPopBtn.dataset.on=eq.statsPop?'1':'0';
          controls.append(statsPopBtn);
        }
      } else {
        controls.append(dBtn,d2Btn,iBtn,rBtn,lBtn,aBtn);
      }
    };
    refreshControls();
    refreshMathInfo();
    refreshParamControls();
    refreshConicDemo();
    refreshSurfacePointControls();
    refreshOps();
    refreshDataTable();
    body.append(wrap,contextActions,controls,info,stepsZone,paramControls,conicDemoZone,surfacePointZone,transformZone,transform3dZone,opTools,tableZone);
    row.append(head,summary,body);
    rowsEl.appendChild(row);
  });
  // Drop animations for equations that no longer exist (e.g. after undo/delete).
  for(const [k,a] of animations){ if(!equations.includes(a.eq)) animations.delete(k); }
  refreshGeoBuilder();
  refreshLessonHighlight({scroll:false});
}


function formatCalcValue(value){
  if(isStructuredResult(value)) return value.kind;
  if(value==null) return '';
  if(Array.isArray(value)) return '['+value.map(formatCalcValue).join(', ')+']';
  return Number.isFinite(value) ? fmt(value) : 'indefinido';
}

function updateDynamicPoints(eq){
  if(typeof eq.pointSource!=='function') return;
  const pts=eq.pointSource();
  eq.points=Array.isArray(pts) ? pts : [];
  if(eq.pointLabel==='seq') eq.regInfo={label:'seq '+eq.points.length+' pontos', r2:null};
  else if(eq.pointLabel==='intersec') eq.regInfo={label:'intersec '+eq.points.length+' ptos', r2:null};
  else if(eq.pointLabel==='points') eq.regInfo={label:eq.points.length+' pontos', r2:null};
}

function histBarsFromValues(nums, eq){
  const bins=computeHistogramBins(nums, eq.histBins||12, !!eq.histBins);
  const n=nums.length;
  const bars=bins.map(b=>({x:b.center, min:b.min, max:b.max, count:b.count,
                           y: eq.histDensity ? b.count/n : b.count}));
  return {bars, bins};
}

function updateDynamicHistogram(eq){
  if(typeof eq.histSource!=='function') return;
  const nums=eq.histSource();
  if(!Array.isArray(nums)||!nums.length){ eq.points=[]; eq.regInfo=null; return; }
  const {bars, bins}=histBarsFromValues(nums, eq);
  eq.points=bars;
  eq.regInfo={label:'n='+nums.length+' bins='+bins.length+(eq.histDensity?' · freq':''), r2:null};
}

function updateDynamicCompare(eq){
  if(typeof eq.compareSource!=='function'){ eq.compareInfo=null; eq.regInfo=null; return; }
  const points=eq.compareSource();
  const rows=compareFitModels(points);
  if(!rows.length){ eq.compareInfo=null; eq.regInfo=null; return; }
  eq.compareInfo={rows, n:finiteDataPoints(points).length};
  const best=rows[0];
  eq.regInfo={label:'melhor '+best.spec+' · '+fitMetricsLabel(best), r2:best.r2};
}

// Linear label as a degree-1 polynomial, so a `stats:` regression line reads
// identically to a `fit:` line (single sign-aware formatting source).
export function linearLabel(slope, intercept){
  return polyLabel([intercept, slope]);
}
function statsLine1var(d){
  const sd = d.sd==null ? '—' : fmt(d.sd);
  return 'n='+d.n+' · x̄='+fmt(d.mean)+' · s='+sd+' · med='+fmt(d.median);
}
function statsLineXY(n, corr){
  if(!corr) return 'n='+n;
  return 'n='+n+' · r='+fmt(corr.r)+' · r²='+fmt(corr.r*corr.r)+' · '+linearLabel(corr.slope, corr.intercept);
}
function updateDynamicStats(eq){
  if(typeof eq.statsSource!=='function'){ eq.statsInfo=null; eq.regInfo=null; return; }
  const data=eq.statsSource();
  if(eq.statsKind==='xy'){
    if(!validPoints(data)){ eq.statsInfo=null; eq.regInfo=null; return; }
    const xs=data.map(p=>p.x), ys=data.map(p=>p.y);
    const corr=pearson(data);
    eq.statsInfo={kind:'xy', x:describe(xs), y:describe(ys), corr};
    eq.regInfo={label:statsLineXY(data.length, corr), r2:null};
  } else {
    const values=Array.isArray(data) ? data.filter(Number.isFinite) : [];
    if(!values.length){ eq.statsInfo=null; eq.regInfo=null; return; }
    const d=describe(values, {population:eq.statsPop});
    eq.statsInfo={kind:'1var', ...d};
    eq.regInfo={label:statsLine1var(d), r2:null};
  }
}

function renderStatsGrid(eq, container){
  updateDynamicStats(eq);
  container.innerHTML='';
  const info=eq.statsInfo;
  if(!info){ container.textContent=''; return; }
  const grid=document.createElement('div');
  grid.className='stats-grid';
  const num=v=>v==null?'—':fmt(v);
  const cell=(label,value)=>{
    const c=document.createElement('div'); c.className='stats-cell';
    const k=document.createElement('span'); k.className='stats-k'; k.textContent=label;
    const v=document.createElement('span'); v.className='stats-v'; v.textContent=value;
    c.append(k,v); grid.appendChild(c);
  };
  if(info.kind==='1var'){
    cell('n', String(info.n));
    cell('Σ', num(info.sum));
    cell('x̄', num(info.mean));
    cell('mediana', num(info.median));
    cell('moda', info.mode==null?'—':fmt(info.mode));
    cell(eq.statsPop?'σ':'s', num(info.sd));
    cell(eq.statsPop?'σ²':'s²', num(info.variance));
    cell('mín', num(info.min));
    cell('máx', num(info.max));
    cell('amplitude', num(info.range));
    cell('Q1', num(info.q1));
    cell('Q3', num(info.q3));
    cell('IQR', num(info.iqr));
  } else {
    const c=info.corr;
    cell('n', String(info.x?.n ?? 0));
    cell('x̄', num(info.x?.mean));
    cell('ȳ', num(info.y?.mean));
    cell('s(x)', num(info.x?.sd));
    cell('s(y)', num(info.y?.sd));
    cell('r', c?num(c.r):'—');
    cell('r²', c?num(c.r*c.r):'—');
    cell('cov', c?num(c.covariance):'—');
    cell('reta', c?linearLabel(c.slope,c.intercept):'—');
  }
  container.appendChild(grid);
}

function renderHistogramGrid(eq, container){
  updateDynamicHistogram(eq);
  container.innerHTML='';
  const nums=typeof eq.histSource==='function' ? eq.histSource() : [];
  const rows=histogramTableRows(nums, {histBins:eq.histBins});
  if(!rows.length){
    container.textContent=eq.regInfo?.label || '';
    return;
  }

  const summary=document.createElement('div');
  summary.className='hist-summary';
  summary.textContent=eq.regInfo?.label || ('n='+nums.length+' bins='+rows.length);

  const wrap=document.createElement('div');
  wrap.className='hist-table';
  const header=document.createElement('div');
  header.className='hist-row hist-head';
  ['classe','intervalo','f','fr','F','dens'].forEach(label=>{
    const cell=document.createElement('span');
    cell.textContent=label;
    header.appendChild(cell);
  });
  wrap.appendChild(header);

  const body=document.createElement('div');
  body.className='hist-body';
  rows.forEach((row,index)=>{
    const line=document.createElement('div');
    line.className='hist-row';
    const interval='['+fmt(row.min)+', '+fmt(row.max)+(index===rows.length-1?']':')');
    [
      String(row.index),
      interval,
      String(row.count),
      fmt(row.relative),
      String(row.cumulative),
      row.density==null ? '—' : fmt(row.density)
    ].forEach(value=>{
      const cell=document.createElement('span');
      cell.textContent=value;
      line.appendChild(cell);
    });
    body.appendChild(line);
  });
  wrap.appendChild(body);
  container.append(summary, wrap);
}

function renderFitParameterGrid(eq, container){
  container.innerHTML='';
  const fit=typeof eq.fitInfo==='function' ? eq.fitInfo() : null;
  if(fit) eq.regInfo={label:fit.label, r2:fit.r2};
  const points=typeof eq.fitSource==='function' ? eq.fitSource() : null;
  const metrics=fitMetrics(points, fit);
  const rows=fitParameterRows(eq.fitSpec, fit, metrics);
  if(!rows.length){
    container.textContent=eq.regInfo?.label || '';
    return;
  }

  const summary=document.createElement('div');
  summary.className='fit-param-summary';
  summary.textContent=(eq.regInfo?.label || fit.label || fitModelName(eq.fitSpec)) +
    (metrics ? ' · '+fitMetricsLabel(metrics) : '');

  const wrap=document.createElement('div');
  wrap.className='fit-param-table';
  const header=document.createElement('div');
  header.className='fit-param-row fit-param-head';
  ['item','valor','detalhe'].forEach(label=>{
    const cell=document.createElement('span');
    cell.textContent=label;
    header.appendChild(cell);
  });
  wrap.appendChild(header);

  const body=document.createElement('div');
  body.className='fit-param-body';
  rows.forEach(row=>{
    const line=document.createElement('div');
    line.className='fit-param-row';
    [row.item, row.value, row.detail || ''].forEach(value=>{
      const cell=document.createElement('span');
      cell.textContent=typeof value==='number' ? fmt(value) : String(value);
      line.appendChild(cell);
    });
    body.appendChild(line);
  });
  wrap.appendChild(body);
  container.append(summary, wrap);
}

function renderCompareGrid(eq, container){
  updateDynamicCompare(eq);
  container.innerHTML='';
  const rows=eq.compareInfo?.rows || [];
  if(!rows.length) return;
  const wrap=document.createElement('div');
  wrap.className='fit-compare-table';
  const header=document.createElement('div');
  header.className='fit-compare-row fit-compare-head';
  ['modelo','R²','RMSE','MAE','SSE'].forEach(label=>{
    const cell=document.createElement('span');
    cell.textContent=label;
    header.appendChild(cell);
  });
  wrap.appendChild(header);
  rows.slice(0,8).forEach((row,index)=>{
    const line=document.createElement('div');
    line.className='fit-compare-row';
    if(index===0) line.dataset.best='1';
    [row.spec, row.r2==null?'—':fmt(row.r2), fmt(row.rmse), fmt(row.mae), fmt(row.sse)].forEach(value=>{
      const cell=document.createElement('span');
      cell.textContent=value;
      line.appendChild(cell);
    });
    wrap.appendChild(line);
  });
  container.appendChild(wrap);
}

function renderResidualGrid(eq, container){
  updateDynamicPoints(eq);
  container.innerHTML='';
  const info=eq.residualInfo;
  const rows=residualTableRows(info);
  if(!rows.length){
    container.textContent=eq.regInfo?.label || '';
    return;
  }

  const summary=document.createElement('div');
  summary.className='residual-summary';
  summary.textContent=eq.regInfo?.label || ('resíduos '+info.model+' · '+fitMetricsLabel(info));

  const wrap=document.createElement('div');
  wrap.className='residual-table';
  const header=document.createElement('div');
  header.className='residual-row residual-head';
  ['x','y','ŷ','e','e²','|e|'].forEach(label=>{
    const cell=document.createElement('span');
    cell.textContent=label;
    header.appendChild(cell);
  });
  wrap.appendChild(header);

  const body=document.createElement('div');
  body.className='residual-body';
  rows.forEach(row=>{
    const line=document.createElement('div');
    line.className='residual-row';
    [row.x, row.observed, row.predicted, row.residual, row.squared, row.absolute].forEach(value=>{
      const cell=document.createElement('span');
      cell.textContent=fmt(value);
      line.appendChild(cell);
    });
    body.appendChild(line);
  });
  wrap.appendChild(body);
  container.append(summary, wrap);
}

function mathInfo(eq){
  if(eq.kind==='geometry') return geometryInfo(eq);
  if(eq.kind==='implicit') return 'curva implícita';
  if(eq.kind==='implicit-ineq') return 'região implícita';
  if(eq.kind==='stats'){
    updateDynamicStats(eq);
    return eq.regInfo ? eq.regInfo.label : '';
  }
  if(eq.kind==='fitcompare'){
    updateDynamicCompare(eq);
    return eq.regInfo ? eq.regInfo.label : '';
  }
  if(eq.kind==='regression'||eq.kind==='points'||eq.kind==='histogram'){
    updateDynamicPoints(eq);
    updateDynamicHistogram(eq);
    if(eq.kind==='regression' && typeof eq.fitInfo==='function'){
      const fit=eq.fitInfo();
      eq.regInfo=fit ? {label:fit.label, r2:fit.r2} : null;
    }
    if(!eq.regInfo) return '';
    return eq.regInfo.label + (eq.regInfo.r2!=null ? '  ·  R² = '+fmt(eq.regInfo.r2) : '');
  }
  if(eq.error) return eq.errorMessage || 'Expressão inválida.';
  if(eq.kind==='result') return eq.algebraResult ? 'resultado = '+formatCalcValue(eq.algebraResult.value ?? eq.algebraResult) : '';
  if(!eq.fn) return '';
  const parts=[];
  if(eq.showD){
    const info=derivInfo(eq.fn,eq.dx);
    if(eq.deriv1) parts.push("f′(x) = "+eq.deriv1.text);
    if(!info.differentiable){
      parts.push("f′ não existe em x="+fmt(eq.dx)+(info.reason==='corner' ? " (f′⁻≈"+fmt(info.left)+", f′⁺≈"+fmt(info.right)+")" : ""));
    } else {
      const d=safeEval(eqDerivFn(eq),eq.dx);
      parts.push(Number.isFinite(d) ? "f′("+fmt(eq.dx)+") ≈ "+fmt(d) : "f′: inclinação local");
    }
  }
  if(eq.showD2){
    if(eq.deriv2) parts.push("f″(x) = "+eq.deriv2.text);
    const d2=safeEval(eqDeriv2Fn(eq),eq.dx);
    parts.push(Number.isFinite(d2) ? "f″("+fmt(eq.dx)+") ≈ "+fmt(d2) : "f″: concavidade local");
  }
  if(eq.showI){
    const v=integ(eq.fn,eq.ia,eq.ib);
    parts.push(Number.isFinite(v) ? "∫["+fmt(eq.ia)+","+fmt(eq.ib)+"] ≈ "+fmt(v) : "∫ₐᵇ: indefinida");
    if(eq.antider){
      parts.push("F(x) = "+eq.antider.text+" + C");
      const tfc=safeEval(eq.antider.fn,eq.ib)-safeEval(eq.antider.fn,eq.ia);
      if(Number.isFinite(tfc)) parts.push("TFC: F(b)−F(a) ≈ "+fmt(tfc));
    }
  }
  if(eq.showR){
    const v=riemannEstimate(eq);
    parts.push(Number.isFinite(v) ? "Σ "+riemannModeLabel(eq.riemannMode)+" n="+riemannN(eq)+" ≈ "+fmt(v) : "Σ: indefinida");
  }
  if(eq.showL){
    if(eq.lInf) parts.push(formatLimitInfinity(limitAtInfinity(eq.fn, eq.lInf==='+'?1:-1), eq.lInf));
    else parts.push(formatLimitInfo(limitAt(eq.fn,eq.lx),eq.lx));
  }
  if(eq.showA) parts.push("análise numérica da janela visível");
  return parts.join(' · ');
}

function pointName(point,fallback=''){
  return point?.label || fallback;
}

function geometryDistance(a,b){
  return Math.hypot((b?.x??0)-(a?.x??0),(b?.y??0)-(a?.y??0));
}

function segmentMeasureName(seg,index=0){
  if(seg?.showLabel&&seg.label) return seg.label;
  const pair=pointName(seg?.a)+pointName(seg?.b);
  return pair || seg?.label || 'lado '+(index+1);
}

function segmentMeasureText(seg,index=0){
  return segmentMeasureName(seg,index)+' = '+fmt(seg?.length ?? geometryDistance(seg?.a,seg?.b));
}

function vectorMeasureName(vec,index=0){
  return '|'+(vec?.label || 'v'+(index+1))+'|';
}

function vectorMeasureText(vec,index=0){
  return vectorMeasureName(vec,index)+' = '+fmt(geometryDistance(vec?.from,vec?.to));
}

function geometryInfo(eq){
  const g=eq.geometry;
  if(!g) return '';
  const parts=[...(g.info || [])];
  if(eq.showGeoSideLengths&&g.segments?.length){
    parts.push('lados: '+g.segments.map(segmentMeasureText).join(' · '));
  }
  if(eq.showGeoVectorLengths&&g.vectors?.length){
    parts.push('vetores: '+g.vectors.map(vectorMeasureText).join(' · '));
  }
  if(eq.showGeoXAxisAngles&&g.lines?.length){
    const lineParts = g.lines.map(line => {
      let angleRad = Math.atan2(-line.a, line.b);
      if(angleRad < 0) angleRad += Math.PI;
      const deg = angleRad * 180 / Math.PI;
      return 'θ(' + (line.label || 'r') + ') = ' + fmt(deg) + '°';
    });
    parts.push(lineParts.join(' · '));
  }
  if(eq.showGeoXAxisAngles&&g.vectors?.length){
    const vecParts = g.vectors.map(vec => {
      const dx = vec.to.x - vec.from.x;
      const dy = vec.to.y - vec.from.y;
      const angleRad = Math.atan2(dy, dx);
      let deg = angleRad * 180 / Math.PI;
      if (deg < 0) deg += 360;
      return 'θ(' + (vec.label || 'v') + ') = ' + fmt(deg) + '°';
    });
    parts.push(vecParts.join(' · '));
  }
  return parts.join(' · ');
}

function riemannN(eq){
  return Number.isInteger(eq.riemannN) ? Math.min(Math.max(eq.riemannN,1),120) : 8;
}

function riemannModeLabel(mode){
  return mode==='left'?'esq' : mode==='right'?'dir' : mode==='trap'?'trap' : 'meio';
}

function riemannEstimate(eq){
  if(!eq.fn) return NaN;
  const n=riemannN(eq);
  const a=eq.ia, b=eq.ib;
  if(!Number.isFinite(a)||!Number.isFinite(b)) return NaN;
  if(a===b) return 0;
  const dx=(b-a)/n;
  let total=0;
  for(let i=0;i<n;i++){
    const x0=a+i*dx, x1=x0+dx;
    if(!Number.isFinite(segmentIntegral(eq.fn,x0,x1))) return NaN;
    if(eq.riemannMode==='trap'){
      const y0=safeEval(eq.fn,x0), y1=safeEval(eq.fn,x1);
      if(!Number.isFinite(y0)||!Number.isFinite(y1)) return NaN;
      total+=(y0+y1)*0.5*dx;
    } else {
      const sample=eq.riemannMode==='left' ? x0 : eq.riemannMode==='right' ? x1 : (x0+x1)/2;
      const y=safeEval(eq.fn,sample);
      if(!Number.isFinite(y)) return NaN;
      total+=y*dx;
    }
  }
  return total;
}

function addEquation(text){
  equations.push(makeEq(text));
  recompileAllEquations();
  renderRows(); draw();
  scheduleSave();
  const inputs=rowsEl.querySelectorAll('.field');
  if(inputs.length) inputs[inputs.length-1].focus();
}
document.getElementById('add').onclick=()=>addEquation('');

function applyEquationOptions(eq, options={}){
  eq.showAlgebraTransform=!!options.showAlgebraTransform;
  eq.showAlgebraTransform3d=!!options.showAlgebraTransform3d;
  eq.showAlgebraSystem=!!options.showAlgebraSystem;
  eq.name=typeof options.name==='string' ? options.name.trim().slice(0,80) : '';
  eq.collapsed=!!options.collapsed;
  eq.visible=options.visible!==false;
  if(options.showResultTable!==undefined) eq.showResultTable=!!options.showResultTable;
  eq.showD=!!options.showD;
  eq.showI=!!options.showI;
  eq.showR=!!options.showR;
  eq.showL=!!options.showL;
  eq.showA=!!options.showA;
  eq.colorOverride=sanitizeColor(options.colorOverride);
  eq.style=['solid','dashed','dotted'].includes(options.style) ? options.style : 'solid';
  eq.lw=Number.isFinite(options.lw) ? Math.min(Math.max(options.lw,1),5) : 2;
  eq.params=sanitizeParams(options.params);
  eq.clipSide=[-1,0,1].includes(options.clipSide)?options.clipSide:0;
  eq.surfaceDirection=Number.isFinite(options.surfaceDirection)?Math.max(-180,Math.min(180,options.surfaceDirection)):0;
  eq.surfacePoint=Array.isArray(options.surfacePoint)&&options.surfacePoint.length===2&&
    options.surfacePoint.every(Number.isFinite)?options.surfacePoint.map(v=>Math.max(-12,Math.min(12,v))):[0,0];

  // Geometry toggles (keep defaults from makeEq when undefined).
  if(options.showGeoAngles!==undefined) eq.showGeoAngles=!!options.showGeoAngles;
  if(options.showGeoAnglesExternal!==undefined) eq.showGeoAnglesExternal=!!options.showGeoAnglesExternal;
  if(options.showGeoAnglesComplement!==undefined) eq.showGeoAnglesComplement=!!options.showGeoAnglesComplement;
  if(options.showGeoLabels!==undefined) eq.showGeoLabels=!!options.showGeoLabels;
  if(options.showGeoGuides!==undefined) eq.showGeoGuides=!!options.showGeoGuides;

  applyOpFields(eq, options);
  recompileEq(eq);
  return eq;
}

function makePresetEquation(entry){
  return applyEquationOptions(makeEq(entry.text),entry);
}

function applyPreset(id,mode){
  const preset=getPreset(id);
  if(mode==='replace'){
    equations.splice(0,equations.length);
    nextId=1;
  }
  preset.equations.forEach(entry=>equations.push(makePresetEquation(entry)));
  recompileAllEquations();
  if(mode==='replace'){
    // Presets select a suitable initial dimension, independent of prior scene.
    const has3d=has3dObjects(equations);
    view3d.mode=has3d?'3d':'2d';
    view3d.savedMode=true;
    has3dSeen=has3d;
  }
  if(mode==='replace'&&preset.view){
    view.cx=preset.view.cx;
    view.cy=preset.view.cy;
    view.scale=preset.view.scale;
  }
  renderRows();
  draw();
  scheduleSave();
}

function clearWorkspace(){
  clearState();
  lessonProgress=normalizeLessonProgress();
  applySideWidth(DEFAULT_SIDE_WIDTH,{resizeCanvas:true});
  equations.splice(0,equations.length);
  nextId=1;
  view.cx=0;
  view.cy=0;
  view.scale=38;
  equations.push(makeEq(''));
  recompileAllEquations();
  renderRows();
  refreshLessonUi();
  draw();
  scheduleSave();
}

function setPanelToggle(toggle, collapsed, label){
  if(!toggle) return;
  const action=collapsed ? 'Expandir' : 'Recolher';
  const text=action+' '+label;
  toggle.dataset.collapsed=collapsed?'1':'0';
  toggle.title=text;
  toggle.setAttribute('aria-label',text);
  toggle.setAttribute('aria-expanded',collapsed?'false':'true');
}

// Layout preference, kept separate from mathematical project/history state.
// Closing the keyboard must not clear its active tab or any equation.
function initKeyboardPanel(){
  const panel=document.getElementById('pad');
  const content=document.getElementById('pad-content');
  const toggle=document.getElementById('pad-toggle');
  const summary=document.getElementById('pad-summary');
  const side=document.getElementById('side');
  if(!panel||!content||!toggle||!side)return;
  const key='curva-keyboard-collapsed';
  let collapsed=false;
  try{collapsed=window.localStorage.getItem(key)==='1';}catch(_){}
  const render=()=>{
    panel.dataset.collapsed=collapsed?'1':'0';
    side.dataset.keyboardCollapsed=collapsed?'1':'0';
    content.hidden=collapsed;
    setPanelToggle(toggle,collapsed,'teclado');
    const active=panel.querySelector('#tabs .tab.active');
    if(summary)summary.textContent=(typeof active?.textContent==='string'?active.textContent.trim():'123');
  };
  toggle.addEventListener('click',()=>{
    collapsed=!collapsed;
    render();
    try{window.localStorage.setItem(key,collapsed?'1':'0');}catch(_){}
  });
  panel.addEventListener('click',ev=>{
    if(ev.target.closest?.('#tabs .tab')&&summary)
      summary.textContent=(panel.querySelector('#tabs .tab.active')?.textContent||'123').toString().trim();
  });
  render();
}

function initPresets(){
  const section=document.getElementById('presets');
  const list=document.getElementById('preset-list');
  const load=document.getElementById('preset-load');
  const add=document.getElementById('preset-add');
  const clear=document.getElementById('preset-clear');
  const preview=document.getElementById('preset-preview');
  const toggle=document.getElementById('preset-toggle');
  const summary=document.getElementById('preset-summary');
  let collapsed=true;
  const renderCollapsed=()=>{
    if(!section) return;
    section.dataset.collapsed=collapsed?'1':'0';
    setPanelToggle(toggle,collapsed,'presets');
  };
  const groups=new Map();
  PRESETS.forEach(preset=>{
    const category=preset.category || 'Outros';
    if(!groups.has(category)){
      const group=document.createElement('optgroup');
      group.label=category;
      groups.set(category,group);
      list.appendChild(group);
    }
    const option=document.createElement('option');
    option.value=preset.id;
    option.textContent=preset.label;
    groups.get(category).appendChild(option);
  });
  const refreshPreview=()=>{
    const preset=getPreset(list.value);
    if(summary) summary.textContent=preset.label;
    preview.innerHTML='<span>'+htmlEscape(preset.description || '')+'</span><code>'+htmlEscape(preset.equations.map(eq=>eq.text).join('  ·  '))+'</code>';
  };
  list.onchange=refreshPreview;
  load.onclick=()=>applyPreset(list.value,'replace');
  add.onclick=()=>applyPreset(list.value,'add');
  clear.onclick=()=>clearWorkspace();
  if(toggle){
    toggle.onclick=()=>{
      collapsed=!collapsed;
      renderCollapsed();
    };
  }
  refreshPreview();
  renderCollapsed();
}

function applyLessonScene(step){
  const scene=lessonScene(step);
  animations.clear();
  equations.splice(0,equations.length);
  nextId=1;
  if(scene.view){
    if(Number.isFinite(scene.view.cx)) view.cx=scene.view.cx;
    if(Number.isFinite(scene.view.cy)) view.cy=scene.view.cy;
    if(Number.isFinite(scene.view.scale)) view.scale=Math.min(Math.max(scene.view.scale,0.02),50000);
  }
  scene.equations.forEach(entry=>equations.push(makePresetEquation(entry)));
  if(!equations.length) equations.push(makeEq(''));
  recompileAllEquations();
  // A lesson chooses its own dimensional context, just like a preset:
  // the cone/plane section lessons must always open in 3D.
  const has3d=has3dObjects(equations);
  view3d.mode=has3d?'3d':'2d';
  view3d.savedMode=true;
  has3dSeen=has3d;
  renderRows();
  draw();
  scheduleSave();
}

function initLessons(){
  const section=document.getElementById('lessons');
  const list=document.getElementById('lesson-list');
  const progress=document.getElementById('lesson-progress');
  const toggle=document.getElementById('lesson-toggle');
  const title=document.getElementById('lesson-title');
  const text=document.getElementById('lesson-text');
  const focus=document.getElementById('lesson-focus');
  const checkpointBox=document.getElementById('lesson-checkpoint');
  const checkpointLabel=checkpointBox?.querySelector('span');
  const checkpointText=document.getElementById('lesson-checkpoint-text');
  const checkpointAction=document.getElementById('lesson-checkpoint-action');
  const toast=document.getElementById('lesson-toast');
  const nextInstruction=document.getElementById('lesson-next-instruction');
  const prev=document.getElementById('lesson-prev');
  const apply=document.getElementById('lesson-apply');
  const next=document.getElementById('lesson-next');
  if(!section||!list||!LESSONS.length) return;

  LESSONS.forEach(lesson=>{
    const option=document.createElement('option');
    option.value=lesson.id;
    option.textContent=lesson.label;
    option.title=lesson.summary || lesson.label;
    list.appendChild(option);
  });

  let lessonId=lessonProgress.lessonId;
  let stepIndex=lessonProgress.stepIndex;
  let checkpointIndex=lessonProgress.checkpointIndex;
  let checkpointToastText='';
  let checkpointNextText='';
  let collapsed=true;
  const activeLesson=()=>getLesson(lessonId);
  const activeStep=()=>activeLesson().steps[stepIndex];

  function syncProgress(save=false){
    lessonProgress=normalizeLessonProgress({...lessonProgress,lessonId,stepIndex,checkpointIndex});
    lessonId=lessonProgress.lessonId;
    stepIndex=lessonProgress.stepIndex;
    checkpointIndex=lessonProgress.checkpointIndex;
    list.value=lessonId;
    if(save) scheduleSave();
  }

  function loadStepProgress(save=false){
    checkpointIndex=getLessonCheckpointProgress(lessonProgress,lessonId,stepIndex);
    checkpointToastText='';
    checkpointNextText='';
    syncProgress(save);
  }

  function renderCollapsed(){
    section.dataset.collapsed=collapsed?'1':'0';
    setPanelToggle(toggle,collapsed,'aulas');
    if(collapsed) clearLessonHighlights();
  }

  function clearLessonHighlights(){
    document.querySelectorAll('.lesson-highlight-target').forEach(el=>el.classList.remove('lesson-highlight-target'));
  }

  function rowForCheck(check){
    const index=Number.isInteger(check?.eq) ? check.eq : 0;
    return document.querySelector('.row[data-eq-index="'+index+'"]');
  }

  function firstTargetFromCheck(check){
    if(!check) return null;
    if(check.type==='all'||check.type==='any'){
      const checks=Array.isArray(check.checks) ? check.checks : [];
      for(const item of checks){
        const target=firstTargetFromCheck(item);
        if(target) return target;
      }
      return null;
    }
    if(check.type==='not') return firstTargetFromCheck(check.check);
    if(check.type==='ack') return checkpointAction || checkpointBox;
    const row=rowForCheck(check);
    if(!row) return null;
    const textField=row.querySelector('[data-lesson-field="text"]');
    if(check.type==='number-param'){
      return row.querySelector('[data-lesson-field="param"][data-param="'+check.param+'"]') || textField || row;
    }
    if(check.type==='number-field'){
      return row.querySelector('[data-op-field="'+check.field+'"]') || textField || row;
    }
    if(check.type==='equals'){
      if(check.field==='lInf'&&check.value){
        return row.querySelector('[data-op-field="lInf"][data-op-value="'+check.value+'"]') || row.querySelector('[data-op-field="lInf"]') || textField || row;
      }
      return row.querySelector('[data-op-field="'+check.field+'"]') || row.querySelector('[data-calc-field="'+check.field+'"]') || textField || row;
    }
    if(check.type==='text-contains'||check.type==='geometry-point'||check.type==='geometry-distance'||check.type==='computed-field'||check.type==='function-value'||check.type==='riemann-error'){
      return textField || row;
    }
    return textField || row;
  }

  let lastHighlightKey='';
  function highlightCheckpointTarget({scroll=true}={}){
    clearLessonHighlights();
    if(collapsed) return;
    const step=activeStep();
    const checkpoints=lessonCheckpoints(step);
    if(!checkpoints.length||checkpointIndex>=checkpoints.length) return;
    const checkpoint=checkpoints[checkpointIndex];
    let target=firstTargetFromCheck(checkpoint.check);
    if(!target) return;
    const row=target.closest?.('.row');
    if(row?.dataset.collapsed==='1') target=row.querySelector('.row-summary') || row;
    target.classList.add('lesson-highlight-target');
    const key=lessonId+':'+stepIndex+':'+checkpointIndex+':'+(checkpoint.check?.type||'');
    if(scroll&&key!==lastHighlightKey){
      target.scrollIntoView?.({block:'nearest',inline:'nearest'});
    }
    lastHighlightKey=key;
  }
  refreshLessonHighlight=highlightCheckpointTarget;

  function renderCheckpoint(step){
    const checkpoints=lessonCheckpoints(step);
    if(!checkpoints.length){
      checkpointBox.hidden=true;
      if(checkpointAction) checkpointAction.hidden=true;
      toast.hidden=true;
      nextInstruction.hidden=true;
      return;
    }
    const done=checkpointIndex>=checkpoints.length;
    const current=checkpoints[Math.min(checkpointIndex,checkpoints.length-1)];
    checkpointBox.hidden=false;
    checkpointBox.dataset.done=done?'1':'0';
    if(checkpointLabel) checkpointLabel.textContent='checkpoint '+Math.min(checkpointIndex+1,checkpoints.length)+'/'+checkpoints.length;
    checkpointText.textContent=done ? 'Etapa concluída.' : (current.prompt || '');
    if(checkpointAction){
      const isObservation=current?.check?.type==='ack';
      checkpointAction.hidden=done||!isObservation;
      checkpointAction.textContent=current.action || 'confirmar observação';
    }
    toast.textContent=checkpointToastText;
    toast.hidden=!checkpointToastText;
    nextInstruction.textContent=checkpointNextText;
    nextInstruction.hidden=!checkpointNextText;
  }

  function renderLesson(){
    const lesson=activeLesson();
    stepIndex=clampStepIndex(lesson,stepIndex);
    const step=lesson.steps[stepIndex];
    list.value=lessonId;
    const completed=countCompletedLessonSteps(lessonProgress,lesson);
    progress.textContent=(stepIndex+1)+'/'+lesson.steps.length+' · '+completed+'/'+lesson.steps.length+' feitas';
    title.textContent=step.title;
    text.textContent=step.text;
    focus.textContent=step.focus || '';
    focus.hidden=!step.focus;
    prev.disabled=stepIndex<=0;
    const checkpoints=lessonCheckpoints(step);
    const stepDone=!checkpoints.length||checkpointIndex>=checkpoints.length;
    next.disabled=stepIndex>=lesson.steps.length-1||!stepDone;
    next.title=!stepDone ? 'Conclua os checkpoints desta etapa para avançar.' : '';
    apply.textContent=stepIndex===0 ? 'iniciar' : 'aplicar';
    renderCheckpoint(step);
    renderCollapsed();
    highlightCheckpointTarget({scroll:true});
  }

  function go(delta){
    const lesson=activeLesson();
    stepIndex=clampStepIndex(lesson,stepIndex+delta);
    loadStepProgress(false);
    renderLesson();
    applyLessonScene(lesson.steps[stepIndex]);
  }

  function runCheckpoint(kind){
    const step=activeStep();
    const checkpoints=lessonCheckpoints(step);
    if(!checkpoints.length||checkpointIndex>=checkpoints.length) return;
    if(!checkpointComplete(step,equations,checkpointIndex,{kind})) return;
    const checkpoint=checkpoints[checkpointIndex];
    checkpointIndex=setLessonCheckpointProgress(lessonProgress,lessonId,stepIndex,checkpointIndex+1);
    syncProgress(true);
    checkpointToastText=checkpoint.success || 'Evento executado.';
    checkpointNextText=checkpoint.next || '';
    renderLesson();
    if(typeof CustomEvent==='function'){
      document.dispatchEvent(new CustomEvent('lesson-checkpoint',{detail:{lessonId,stepIndex,checkpointIndex:checkpointIndex-1,complete:checkpointIndex>=checkpoints.length,kind,message:checkpointToastText,next:checkpointNextText}}));
    }
  }

  list.onchange=()=>{
    lessonId=list.value;
    stepIndex=0;
    loadStepProgress(true);
    renderLesson();
  };
  if(toggle){
    toggle.onclick=()=>{
      collapsed=!collapsed;
      renderCollapsed();
      if(!collapsed) highlightCheckpointTarget({scroll:true});
    };
  }
  prev.onclick=()=>go(-1);
  next.onclick=()=>go(1);
  if(checkpointAction) checkpointAction.onclick=()=>runCheckpoint('ack');
  apply.onclick=()=>{
    loadStepProgress(false);
    applyLessonScene(activeStep());
    renderLesson();
  };
  lessonActionHandler=runCheckpoint;
  refreshLessonUi=()=>{
    lessonProgress=normalizeLessonProgress(lessonProgress);
    lessonId=lessonProgress.lessonId;
    stepIndex=lessonProgress.stepIndex;
    checkpointIndex=lessonProgress.checkpointIndex;
    checkpointToastText='';
    checkpointNextText='';
    renderLesson();
  };
  refreshLessonUi();
}

function initHelp(){
  const section=document.getElementById('help');
  const toggle=document.getElementById('help-toggle');
  if(!section||!toggle) return;
  let collapsed=true;
  const renderCollapsed=()=>{
    section.dataset.collapsed=collapsed?'1':'0';
    setPanelToggle(toggle,collapsed,'ajuda');
  };
  toggle.onclick=()=>{
    collapsed=!collapsed;
    renderCollapsed();
  };
  renderCollapsed();
}

const styleEditor=createStyleEditor({
  getPalette:PAL,
  eqColor,
  onChange:()=>{ draw(); scheduleSave(); }
});
function openStyleEditor(eq, anchor){ styleEditor.open(eq, anchor); }

let focusedInput=null;
let focusedEquation=null;
function insertAtFocused(text, caretBack){
  const inp=targetField();
  if(!inp) return;
  inp.focus();
  const s=inp.selectionStart??inp.value.length;
  const e=inp.selectionEnd??inp.value.length;
  inp.value=inp.value.slice(0,s)+text+inp.value.slice(e);
  const pos=s+text.length-(caretBack||0);
  inp.setSelectionRange(pos,pos);
  inp.dispatchEvent(new Event('input'));
}

document.getElementById('pad').addEventListener('click',ev=>{
  const tab=ev.target.closest('.tab');
  if(tab){
    document.querySelectorAll('.tab').forEach(t=>t.classList.toggle('active',t===tab));
    document.getElementById('grid-num').classList.toggle('hidden',tab.dataset.tab!=='num');
    document.getElementById('grid-fn').classList.toggle('hidden',tab.dataset.tab!=='fn');
    document.getElementById('grid-adv').classList.toggle('hidden',tab.dataset.tab!=='adv');
    document.getElementById('grid-stats').classList.toggle('hidden',tab.dataset.tab!=='stats');
    document.getElementById('grid-geo').classList.toggle('hidden',tab.dataset.tab!=='geo');
    document.getElementById('grid-algebra').classList.toggle('hidden',tab.dataset.tab!=='algebra');
    const builder=document.getElementById('geo-builder');
    if(builder) builder.classList.toggle('hidden',tab.dataset.tab!=='geo');
    refreshGeoBuilder();
    return;
  }
  const b=ev.target.closest('button');
  if(!b) return;
  if(b.dataset.geoTool) setGeoTool(b.dataset.geoTool);
  else if(b.dataset.act==='back') backspaceFocused();
  else if(b.dataset.act==='clear') clearFocused();
  else if(b.dataset.algebra){const field=targetField();if(field){field.setSelectionRange(0,field.value.length);insertAtFocused(b.dataset.ins,0);}}
  else if(b.dataset.ins!==undefined) insertAtFocused(b.dataset.ins, b.dataset.caret?+b.dataset.caret:0);
});

function targetField(){ return (focusedInput&&document.contains(focusedInput))?focusedInput:rowsEl.querySelector('.field'); }
function backspaceFocused(){
  const inp=targetField(); if(!inp) return; inp.focus();
  let s=inp.selectionStart, e=inp.selectionEnd;
  if(s==null){ s=e=inp.value.length; }
  if(s!==e){ inp.value=inp.value.slice(0,s)+inp.value.slice(e); inp.setSelectionRange(s,s); }
  else if(s>0){ inp.value=inp.value.slice(0,s-1)+inp.value.slice(s); inp.setSelectionRange(s-1,s-1); }
  inp.dispatchEvent(new Event('input'));
}
function clearFocused(){
  const inp=targetField(); if(!inp) return; inp.focus();
  inp.value=''; inp.dispatchEvent(new Event('input'));
}

function geometryNameItems(){
  const items=[];
  equations.forEach(eq=>{
    if(eq.kind!=='geometry'||eq.error||!eq.geometry) return;
    eq.geometry.definitions?.forEach(def=>{
      if(def?.name) items.push({name:def.name,label:def.name});
    });
    eq.geometry.points?.forEach(point=>{
      if(point?.label) items.push({label:point.label});
    });
  });
  return items;
}

function geometryPointItems(){
  const items=[];
  const seen=new Set();
  equations.forEach(eq=>{
    // 3D points are neither drawn nor selectable in the 2D view: dragging them
    // would rewrite the line with two coordinates and lose z.
    if(eq.kind!=='geometry'||eq.error||!eq.geometry||eq.geometry.dim===3) return;
    const defined=new Set((eq.geometry.definitions||[])
      .filter(def=>def.kind==='point')
      .map(def=>String(def.name||'').toLowerCase()));
    const points=Array.isArray(eq.geometry.points) ? eq.geometry.points : [];
    points.forEach(point=>{
      const p=normalizePoint(point);
      if(point?.dim===3||!p.label||!Number.isFinite(p.x)||!Number.isFinite(p.y)) return;
      const key=p.label.toLowerCase();
      const draggable=eq.geometry.type==='point';
      const selectable=draggable||defined.has(key);
      if(!selectable||seen.has(key)) return;
      seen.add(key);
      items.push({...p,eq,draggable});
    });
  });
  return items;
}

function pointSourceEquation(){
  const items=equations.map(eq=>({
    text:eq.text,
    type:eq.kind==='geometry'&&!eq.error&&eq.geometry?.dim!==3 ? eq.geometry?.type : ''
  }));
  const index=choosePointSourceIndex(items,equations.indexOf(focusedEquation));
  return index>=0 ? equations[index] : null;
}

function cleanSelectedGeoPoints(){
  const available=new Set(geometryPointItems().map(point=>point.label.toLowerCase()));
  selectedGeoPoints=selectedGeoPoints.filter(label=>available.has(String(label).toLowerCase()));
}

function refreshGeoBuilder(){
  const status=document.getElementById('geo-builder-status');
  cleanSelectedGeoPoints();
  const canPair=selectedGeoPoints.length===2;
  const canTriangle=selectedGeoPoints.length===3;
  const canQuadrilateral=selectedGeoPoints.length===4;
  const canPolygon=selectedGeoPoints.length>=3;
  const canConvexHull=selectedGeoPoints.length>=4;
  if(status){
    const selected=selectedGeoPoints.length ? selectedGeoPoints.join(' · ') : 'nenhum ponto';
    status.textContent=(geoTool==='point'?'ponto ativo':'geo visual')+' · '+selected;
  }
  [['geo-build-vector','vector'],['geo-build-distance','distance'],['geo-build-midpoint','midpoint'],['geo-build-line','line']].forEach(([id])=>{
    const button=document.getElementById(id);
    if(button) button.disabled=!canPair;
  });
  const triangle=document.getElementById('geo-build-triangle');
  if(triangle) triangle.disabled=!canTriangle;
  const quadrilateral=document.getElementById('geo-build-quadrilateral');
  if(quadrilateral) quadrilateral.disabled=!canQuadrilateral;
  const polygon=document.getElementById('geo-build-polygon');
  if(polygon) polygon.disabled=!canPolygon;
  const convexHull=document.getElementById('geo-build-convex-hull');
  if(convexHull) convexHull.disabled=!canConvexHull;
  document.querySelectorAll('[data-geo-tool]').forEach(button=>{
    button.dataset.on=button.dataset.geoTool===geoTool?'1':'0';
  });
}

function setCanvasCursor(){
  if(typeof cv==='undefined'||!cv) return;
  if(view3d.mode==='3d'){ cv.style.cursor='grab'; return; }
  if(annotationMode){ cv.style.cursor=annotationHoverId ? 'move' : 'text'; return; }
  cv.style.cursor=geoTool==='point' ? 'copy' : 'crosshair';
}

function setGeoTool(tool){
  geoTool=geoTool===tool ? 'select' : tool;
  setCanvasCursor();
  refreshGeoBuilder();
}

function gridSnapStep(){
  return niceStep(80,view.scale)/5;
}

function pointerWorldPoint(snap=false){
  const wx=px2wx(mouse.px), wy=py2wy(mouse.py);
  if(!snap) return {x:wx,y:wy};
  const step=gridSnapStep();
  return {x:snapToStep(wx,step), y:snapToStep(wy,step)};
}

function selectGeoPoint(label, force=false){
  const clean=String(label||'').trim();
  if(!clean) return;
  const existing=selectedGeoPoints.findIndex(item=>item.toLowerCase()===clean.toLowerCase());
  if(existing>=0){
    if(!force) selectedGeoPoints.splice(existing,1);
    else selectedGeoPoints.splice(existing,1,clean);
  } else {
    selectedGeoPoints.push(clean);
  }
  refreshGeoBuilder();
  draw();
}

function createVisualPoint(wx,wy){
  const source=pointSourceEquation();
  const points=source?.geometry?.points?.map(normalizePoint)
    .filter(point=>point.label&&Number.isFinite(point.x)&&Number.isFinite(point.y)) || [];
  const label=nextPointLabel(geometryPointItems());
  points.push({label,x:wx,y:wy});
  const text=formatPointCommand(points);
  if(source){
    source.text=text;
  } else {
    equations.push(makeEq(text));
  }
  recompileAllEquations();
  renderRows();
  selectGeoPoint(label,true);
  notifyLessonAction('input');
  scheduleSave();
}

function updateVisualPoint(label,wx,wy,{final=false}={}){
  const item=geometryPointItems().find(point=>point.draggable&&point.label.toLowerCase()===String(label||'').toLowerCase());
  if(!item?.eq) return false;
  const points=item.eq.geometry?.points?.map(normalizePoint)
    .filter(point=>point.label&&Number.isFinite(point.x)&&Number.isFinite(point.y)) || [];
  const updated=updatePoint(points,item.label,wx,wy);
  item.eq.text=formatPointCommand(updated);
  recompileAllEquations();
  selectedGeoPoints=selectedGeoPoints.map(selected=>selected.toLowerCase()===item.label.toLowerCase() ? item.label : selected);
  notifyLessonAction('input');
  if(final){
    renderRows();
    refreshGeoBuilder();
    scheduleSave();
  }
  draw();
  return true;
}

function addVisualConstruction(kind){
  const isPolygonKind=kind==='triangle'||kind==='quadrilateral'||kind==='polygon'||kind==='convexHull';
  if(!isPolygonKind&&selectedGeoPoints.length!==2) return;
  if(kind==='triangle'&&selectedGeoPoints.length!==3) return;
  if(kind==='quadrilateral'&&selectedGeoPoints.length!==4) return;
  if(kind==='polygon'&&selectedGeoPoints.length<3) return;
  if(kind==='convexHull'&&selectedGeoPoints.length<4) return;
  const used=usedGeometryNames(geometryNameItems());
  const text=isPolygonKind
    ? constructionExpression(kind,selectedGeoPoints,null,used)
    : constructionExpression(kind,selectedGeoPoints[0],selectedGeoPoints[1],used);
  if(!text) return;
  equations.push(makeEq(text));
  recompileAllEquations();
  renderRows();
  draw();
  notifyLessonAction('input');
  scheduleSave();
}

function hitGeometryPoint(px,py){
  let best=null;
  geometryPointItems().forEach(point=>{
    const d=Math.hypot(w2px(point.x)-px,w2py(point.y)-py);
    if(d<=12&&(!best||d<best.dist)) best={...point,dist:d};
  });
  return best;
}

function drawGeoBuilderOverlay(){
  if(!selectedGeoPoints.length) return;
  const selected=new Set(selectedGeoPoints.map(label=>label.toLowerCase()));
  const color=getCss('--accent');
  ctx.save();
  ctx.strokeStyle=color;
  ctx.lineWidth=2;
  ctx.setLineDash([]);
  geometryPointItems().forEach(point=>{
    if(!selected.has(point.label.toLowerCase())) return;
    const px=w2px(point.x), py=w2py(point.y);
    if(px<-16||px>W+16||py<-16||py>H+16) return;
    ctx.beginPath();
    ctx.arc(px,py,8,0,Math.PI*2);
    ctx.stroke();
  });
  ctx.restore();
}

function initGeoBuilder(){
  const clear=document.getElementById('geo-builder-clear');
  if(clear) clear.onclick=()=>{ selectedGeoPoints=[]; refreshGeoBuilder(); draw(); };
  [
    ['geo-build-vector','vector'],
    ['geo-build-distance','distance'],
    ['geo-build-midpoint','midpoint'],
    ['geo-build-line','line'],
    ['geo-build-triangle','triangle'],
    ['geo-build-quadrilateral','quadrilateral'],
    ['geo-build-polygon','polygon'],
    ['geo-build-convex-hull','convexHull']
  ].forEach(([id,kind])=>{
    const button=document.getElementById(id);
    if(button) button.onclick=()=>addVisualConstruction(kind);
  });
  refreshGeoBuilder();
}

const cv=document.getElementById('cv');
const ctx=cv.getContext('2d');
const stage=document.getElementById('stage');
const sectionElement=document.getElementById('section2d-panel');
const sectionToggle=document.getElementById('section-toggle');
const planeDragButton=document.getElementById('plane-drag-mode');
const surfaceLinesButton=document.getElementById('three-surface-lines');
const SURFACE_LINE_MODES=['normal','detailed','off'];
let threeSurfaceLines='normal';
try{
  const stored=localStorage.getItem('curva-three-surface-lines');
  if(SURFACE_LINE_MODES.includes(stored))threeSurfaceLines=stored;
}catch(_){}
function updateSurfaceLinesButton(){
  if(!surfaceLinesButton)return;
  surfaceLinesButton.hidden=view3d.mode!=='3d'||getActive3DLibrary()!=='threejs';
  const labels={normal:'leves',detailed:'densas',off:'sem'};
  surfaceLinesButton.textContent='linhas: '+labels[threeSurfaceLines];
  surfaceLinesButton.dataset.mode=threeSurfaceLines;
  surfaceLinesButton.setAttribute?.('aria-pressed',threeSurfaceLines==='off'?'false':'true');
  surfaceLinesButton.setAttribute?.('aria-label','Linhas de referência 3D: '+labels[threeSurfaceLines]);
  surfaceLinesButton.title='Linhas que acompanham as superfícies no giro · clique para alternar entre leves, densas e desativadas';
}
surfaceLinesButton?.addEventListener?.('click',()=>{
  const current=SURFACE_LINE_MODES.indexOf(threeSurfaceLines);
  threeSurfaceLines=SURFACE_LINE_MODES[(current+1)%SURFACE_LINE_MODES.length];
  updateSurfaceLinesButton();
  try{localStorage.setItem('curva-three-surface-lines',threeSurfaceLines);}catch(_){}
  draw();
});
const sectionLinkedMarker=document.getElementById('section-linked-marker');
let sectionLinkedWorld=null;
function setSectionLinkedWorld(world){
  sectionLinkedWorld=world;
  if(!sectionLinkedMarker)return;
  if(!world||!stage?.classList?.contains('dual-conic')||view3d.mode!=='3d'||
    getActive3DLibrary()==='plotly'){
    sectionLinkedMarker.hidden=true;return;
  }
  const point=projectPoint(view3d.camera,world,{width:W,height:H});
  if(point.behind||!Number.isFinite(point.x+point.y)||point.x<0||point.x>W||point.y<0||point.y>H){
    sectionLinkedMarker.hidden=true;return;
  }
  sectionLinkedMarker.style.left=point.x+'px';
  sectionLinkedMarker.style.top=point.y+'px';
  sectionLinkedMarker.hidden=false;
}
const sectionPanel=createSectionPanel({
  panel:sectionElement,
  onClose:()=>{dualSection=false;draw();scheduleSave();},
  onHoverPoint:world=>setSectionLinkedWorld(world)
});
// In the tangent laboratory, selecting the surface updates the same u/v
// parameters as the sliders. Vertex picking works in Canvas and Three.js
// without requiring the WebGL renderer to expose its private raycaster.
function pickTangentSurface(e){
  if(view3d.mode!=='3d'||getActive3DLibrary()==='plotly')return;
  const rect=stage.getBoundingClientRect();
  const x=e.clientX-rect.left,y=e.clientY-rect.top;
  if(x<0||x>W||y<0||y>H)return;
  let nearest=null;
  for(const eq of equations){
    if(eq.visible===false||eq.error||(!eq.geometry?.tangent&&!eq.geometry?.multivar)||!eq.geometry?.scene3d)continue;
    const meshes=eq.geometry.scene3d.filter(p=>p.kind==='mesh');
    for(const [sheetIndex,mesh] of meshes.entries()){
      if(eq.geometry.multivar){
        for(const vertex of mesh.vertices||[]){
          if(!vertex.every(Number.isFinite))continue;
          const projected=projectPoint(view3d.camera,vertex,{width:W,height:H});
          if(projected.behind)continue;
          const dist=Math.hypot(projected.x-x,projected.y-y);
          if(dist<18&&(!nearest||dist<nearest.dist))
            nearest={eq,dist,depth:projected.depth,surfacePoint:vertex.slice(0,2),multi:true};
        }
        continue;
      }
      const cols=mesh.vertices.length===33*33?33:45;
      const rows=mesh.vertices.length/cols;
      if(!Number.isInteger(rows))continue;
      for(let k=0;k<mesh.vertices.length;k++){
        const point=projectPoint(view3d.camera,mesh.vertices[k],{width:W,height:H});
        if(point.behind)continue;
        const dist=Math.hypot(point.x-x,point.y-y);
        if(dist>16)continue;
        if(!nearest||dist<nearest.dist-1||Math.abs(dist-nearest.dist)<1&&point.depth<nearest.depth){
          nearest={eq,dist,depth:point.depth,u:Math.floor(k/cols)/(rows-1),
            v:(k%cols)/(cols-1),face:sheetIndex===0?-1:1,sheetCount:meshes.length};
        }
      }
    }
  }
  if(!nearest)return;
  const {eq,u,v,face,sheetCount}=nearest;
  if(nearest.multi){
    eq.surfacePoint=nearest.surfacePoint.map(x=>Number(x.toFixed(3)));
  }else{
    eq.params.u=Number(u.toFixed(3));eq.params.v=Number(v.toFixed(3));
    if(sheetCount>1)eq.params.r=face;
  }
  recompileAllEquations();resultRefreshers.forEach(refresh=>refresh());
  renderRows();draw();scheduleSave();
}
for(const id of ['cv','three-3d-container']){
  const target=document.getElementById(id);
  target?.addEventListener?.('pointermove',e=>{
    if(e.buttons||!stage?.classList?.contains('dual-conic')||view3d.mode!=='3d'||getActive3DLibrary()==='plotly')return;
    const eq=activeSectionEquation();
    const segments=eq?.geometry?.scene3d?.filter(p=>p.sectionCurve&&p.kind==='segment');
    if(!segments?.length)return;
    const rect=stage.getBoundingClientRect();
    const hit=nearestProjectedSection(segments,view3d.camera,{width:W,height:H},
      e.clientX-rect.left,e.clientY-rect.top);
    setSectionLinkedWorld(hit?.world||null);
    sectionPanel.highlightWorld?.(hit?.world||null);
  });
  target?.addEventListener?.('pointerleave',()=>{
    setSectionLinkedWorld(null);
    sectionPanel.highlightWorld?.(null);
  });
  target?.addEventListener?.('click',pickTangentSurface);
}
// Keep the divider position between sessions; using the same ratios for
// rendering and CSS prevents mismatch after responsive layout changes.
const splitHandle=document.getElementById('dual-splitter');
const focus3dButton=document.getElementById('view3d-focus');
const focus2dButton=document.getElementById('section2d-max');
let dualFocus=null; // transient: '3d', '2d' or null; independent of saved pane split
const changeDualFocus=target=>{
  dualFocus=dualFocus===target?null:target;
  draw();
};
if(focus3dButton)focus3dButton.onclick=()=>changeDualFocus('3d');
if(focus2dButton)focus2dButton.onclick=()=>changeDualFocus('2d');
const splitMobile=()=>typeof window.matchMedia==='function'&&window.matchMedia('(max-width:850px)').matches;
const splitClamp=(v,min,max,defaultValue)=>Number.isFinite(v)?Math.max(min,Math.min(max,v)):defaultValue;
function readSplit(key,fallback){
  try { const value=Number(localStorage.getItem(key));return value>0?value:fallback; }
  catch(_) {return fallback;}
}
let split3dWidth=splitClamp(readSplit('curva-split-width',60),30,75,60);
let split3dHeight=splitClamp(readSplit('curva-split-height',56),30,75,56);
function updateSplitLayout(redraw=true){
  stage?.style?.setProperty?.('--dual-3d-width',split3dWidth+'%');
  stage?.style?.setProperty?.('--dual-3d-height',split3dHeight+'%');
  if(splitHandle){
    const mobile=splitMobile(),value=mobile?split3dHeight:split3dWidth;
    splitHandle.setAttribute?.('aria-orientation',mobile?'horizontal':'vertical');
    splitHandle.setAttribute?.('aria-valuenow',String(Math.round(value)));
    splitHandle.setAttribute?.('aria-valuetext',Math.round(value)+'% para o visor 3D');
  }
  if(redraw)resize();
}
updateSplitLayout(false);
if(splitHandle){
  let dragging=false;
  const updateFromPointer=e=>{
    const r=stage.getBoundingClientRect();
    if(splitMobile())split3dHeight=splitClamp(100*(e.clientY-r.top)/Math.max(1,r.height),30,75,56);
    else split3dWidth=splitClamp(100*(e.clientX-r.left)/Math.max(1,r.width),30,75,60);
    updateSplitLayout();
  };
  splitHandle.addEventListener?.('pointerdown',e=>{
    if(e.button!==0)return;
    dragging=true;splitHandle.classList.add('dragging');
    splitHandle.setPointerCapture?.(e.pointerId);updateFromPointer(e);
    e.preventDefault?.();
  });
  splitHandle.addEventListener?.('pointermove',e=>{if(dragging)updateFromPointer(e);});
  const finish=()=>{
    if(!dragging)return;dragging=false;splitHandle.classList.remove('dragging');
    try{localStorage.setItem('curva-split-width',String(split3dWidth));
      localStorage.setItem('curva-split-height',String(split3dHeight));}catch(_){}
  };
  splitHandle.addEventListener?.('pointerup',finish);
  splitHandle.addEventListener?.('pointercancel',finish);
  splitHandle.addEventListener?.('keydown',e=>{
    const delta=e.key==='ArrowRight'||e.key==='ArrowDown'?2:
      e.key==='ArrowLeft'||e.key==='ArrowUp'?-2:0;
    if(delta){
      e.preventDefault?.();
      if(splitMobile())split3dHeight=splitClamp(split3dHeight+delta,30,75,56);
      else split3dWidth=splitClamp(split3dWidth+delta,30,75,60);
      updateSplitLayout();finish();
      try{localStorage.setItem('curva-split-width',String(split3dWidth));
        localStorage.setItem('curva-split-height',String(split3dHeight));}catch(_){}
    } else if(e.key==='Home'||e.key==='End'){
      e.preventDefault?.();
      if(splitMobile())split3dHeight=e.key==='Home'?30:75;
      else split3dWidth=e.key==='Home'?30:75;
      updateSplitLayout();finish();
    }
  });
  window.addEventListener?.('resize',()=>updateSplitLayout(false));
}
function activeSectionEquation(){
  return equations.find(eq=>eq?.visible!==false&&!eq.error&&eq.kind==='geometry'&&eq.geometry?.section&&eq.geometry?.scene3d?.length);
}
function syncSectionLayout(){
  updateSurfaceLinesButton();
  for(const item of equations)
    item.showPlaneGizmo=planeDragMode&&item.visible!==false&&item.geometry?.type==='plane';
  const eq=view3d.mode==='3d'?activeSectionEquation():null;
  const available=!!eq;
  const show=available&&dualSection;
  if(sectionToggle){
    sectionToggle.hidden=!available;
    sectionToggle.dataset.on=show?'1':'0';
    sectionToggle.setAttribute?.('aria-pressed',show?'true':'false');
  }
  if(planeDragButton){
    planeDragButton.hidden=!(getActive3DLibrary()==='threejs'&&view3d.mode==='3d'&&
      (available||equations.some(eq=>eq.visible!==false&&!eq.error&&eq.geometry?.type==='plane')));
    planeDragButton.dataset.on=planeDragMode?'1':'0';
    planeDragButton.setAttribute?.('aria-pressed',planeDragMode?'true':'false');
  }
  if(sectionElement)sectionElement.hidden=!show;
  if(splitHandle)splitHandle.hidden=!show;
  if(!show){setSectionLinkedWorld(null);dualFocus=null;}
  const was=stage?.classList?.contains?.('dual-conic')||false;
  const was3d=stage?.classList?.contains?.('focus-3d')||false;
  const was2d=stage?.classList?.contains?.('focus-2d')||false;
  const focus3d=show&&dualFocus==='3d',focus2d=show&&dualFocus==='2d';
  stage?.classList?.toggle?.('dual-conic',show);
  stage?.classList?.toggle?.('focus-3d',focus3d);
  stage?.classList?.toggle?.('focus-2d',focus2d);
  if(focus3dButton){
    focus3dButton.hidden=!show;
    focus3dButton.setAttribute('aria-pressed',focus3d?'true':'false');
    focus3dButton.title=focus3d?'Restaurar divisão 3D + 2D':'Maximizar visor 3D';
  }
  if(focus2dButton){
    focus2dButton.setAttribute('aria-pressed',focus2d?'true':'false');
    focus2dButton.title=focus2d?'Restaurar divisão 3D + 2D':'Maximizar seção 2D';
  }
  // Attach the 3D engine selector to the 3D toolbar only in the dual view.
  // Its position then follows toolbar wrapping and cannot cover the 2D pane.
  if(was!==show&&stage){
    const selector=document.getElementById('3d-library-selector');
    const toolbar=document.getElementById('view3d-bar');
    if(selector&&toolbar){
      if(show)toolbar.appendChild(selector);
      else stage.insertBefore(selector,stage.firstChild);
    }
  }
  if(show)sectionPanel.draw(eq.geometry,theme==='dark');
  if(was!==show||was3d!==focus3d||was2d!==focus2d){resize();return true;}
  return false;
}
const readout=document.getElementById('readout');
const canvasDescription=document.getElementById('canvas-description');
const lessonGraphToast=document.getElementById('lesson-graph-toast');
const LESSON_GRAPH_TOAST_MS=10000;
let lessonGraphToastTimer=null;

function showLessonGraphToast(text){
  if(!lessonGraphToast||!text) return;
  clearTimeout(lessonGraphToastTimer);
  lessonGraphToast.textContent=text;
  lessonGraphToast.hidden=false;
  lessonGraphToast.dataset.show='1';
  lessonGraphToastTimer=setTimeout(()=>{
    lessonGraphToast.dataset.show='0';
    lessonGraphToastTimer=setTimeout(()=>{ lessonGraphToast.hidden=true; },220);
  },LESSON_GRAPH_TOAST_MS);
}

document.addEventListener('lesson-checkpoint',event=>{
  const detail=event.detail || {};
  showLessonGraphToast(detail.message || 'Checkpoint concluído.');
});

const valueTable=createValueTable({
  equations,
  getTheme:()=>theme,
  getDefaultCenter:()=>mouse.inside ? px2wx(mouse.px) : view.cx,
  eqColor
});

const opControls=createOpControls({
  eqColor,
  onChange:()=>{ draw(); scheduleSave(); notifyLessonAction('op'); }
});
const dataTable=createDataTable();

function resize(){
  dpr=window.devicePixelRatio||1;
  // Use the stage, never the canvas: inactive Plotly/Three.js modes hide it.
  // In side-by-side mode the graph uses the left 60%, or the upper 56% on mobile.
  const r=stage.getBoundingClientRect();
  const dual=stage.classList?.contains?.('dual-conic')||false;
  const focus3d=stage.classList?.contains?.('focus-3d')||false;
  W=r.width*(dual&&!splitMobile()&&!focus3d?split3dWidth/100:1);
  H=r.height*(dual&&splitMobile()&&!focus3d?split3dHeight/100:1);
  cv.width=Math.round(W*dpr); cv.height=Math.round(H*dpr);
  ctx.setTransform(dpr,0,0,dpr,0,0);
  fitCameraToViewport();
  handle3DResize();
  sectionPanel.resize();
  draw();
  if(sectionLinkedWorld)setSectionLinkedWorld(sectionLinkedWorld);
}
function initSideResizer(){
  const resizer=document.getElementById('side-resizer');
  if(!resizer) return;
  let dragging=false;
  let activePointer=null;
  const widthFromClientX=clientX=>clientX-document.body.getBoundingClientRect().left;
  const setWidth=width=>applySideWidth(width,{resizeCanvas:true});
  const stop=ev=>{
    if(!dragging) return;
    dragging=false;
    document.body.dataset.resizingSide='0';
    if(activePointer!==null&&resizer.releasePointerCapture){
      try{ resizer.releasePointerCapture(activePointer); }catch(_){}
    }
    activePointer=null;
    scheduleSave();
    ev?.preventDefault?.();
  };
  resizer.addEventListener('pointerdown',ev=>{
    if(window.innerWidth<=720) return;
    dragging=true;
    activePointer=ev.pointerId;
    document.body.dataset.resizingSide='1';
    if(resizer.setPointerCapture) resizer.setPointerCapture(ev.pointerId);
    setWidth(widthFromClientX(ev.clientX));
    ev.preventDefault();
  });
  resizer.addEventListener('pointermove',ev=>{
    if(!dragging) return;
    setWidth(widthFromClientX(ev.clientX));
    ev.preventDefault();
  });
  resizer.addEventListener('pointerup',stop);
  resizer.addEventListener('pointercancel',stop);
  resizer.addEventListener('keydown',ev=>{
    let next=null;
    if(ev.key==='ArrowLeft') next=sideWidth-(ev.shiftKey?48:16);
    else if(ev.key==='ArrowRight') next=sideWidth+(ev.shiftKey?48:16);
    else if(ev.key==='Home') next=SIDE_WIDTH_MIN;
    else if(ev.key==='End') next=SIDE_WIDTH_MAX;
    if(next===null) return;
    setWidth(next);
    scheduleSave();
    ev.preventDefault();
  });
  applySideWidth(sideWidth);
}
window.addEventListener('resize',()=>{
  applySideWidth(sideWidth);
  resize();
});

function drawGrid(){
  if(gridMode==='log'){
    drawLogGrid();
    return;
  }
  if(gridMode==='polar'){
    drawPolarGrid();
    return;
  }
  const major=niceStep(80,view.scale);
  const minor=major/5;
  ctx.lineWidth=1;
  ctx.strokeStyle=getCss('--grid-minor');
  ctx.beginPath();
  gridlines(minor,(x)=>{const p=Math.round(w2px(x))+.5;ctx.moveTo(p,0);ctx.lineTo(p,H);},
                  (y)=>{const p=Math.round(w2py(y))+.5;ctx.moveTo(0,p);ctx.lineTo(W,p);});
  ctx.stroke();
  ctx.strokeStyle=getCss('--grid-major');
  ctx.beginPath();
  gridlines(major,(x)=>{const p=Math.round(w2px(x))+.5;ctx.moveTo(p,0);ctx.lineTo(p,H);},
                  (y)=>{const p=Math.round(w2py(y))+.5;ctx.moveTo(0,p);ctx.lineTo(W,p);});
  ctx.stroke();
  drawAxes();
}
function drawPolarGrid(){
  const major=niceStep(80,view.scale);
  const minor=major/5;
  ctx.lineWidth=1;
  ctx.strokeStyle=getCss('--grid-minor');
  ctx.beginPath();
  polarCircles(minor, false);
  polarRays(Math.PI/12, false);
  ctx.stroke();
  ctx.strokeStyle=getCss('--grid-major');
  ctx.beginPath();
  polarCircles(major, true);
  polarRays(Math.PI/6, true);
  ctx.stroke();
  drawAxes();
}
function drawLogGrid(){
  const x0=px2wx(0), x1=px2wx(W), y0=py2wy(H), y1=py2wy(0);
  const xMin=Math.max(0.0001, Math.min(x0,x1));
  const xMax=Math.max(x0,x1,1);
  const yMin=Math.max(0.0001, Math.min(y0,y1));
  const yMax=Math.max(y0,y1,1);
  ctx.lineWidth=1;
  ctx.strokeStyle=getCss('--grid-minor');
  ctx.beginPath();
  logGridLines(xMin, xMax, yMin, yMax, false);
  ctx.stroke();
  ctx.strokeStyle=getCss('--grid-major');
  ctx.beginPath();
  logGridLines(xMin, xMax, yMin, yMax, true);
  ctx.stroke();
  drawAxes();
}
function logGridLines(xMin, xMax, yMin, yMax, majorOnly){
  const xStart=Math.max(1e-9, xMin);
  const xEnd=Math.max(xStart, xMax);
  const yStart=Math.max(1e-9, yMin);
  const yEnd=Math.max(yStart, yMax);
  const powMinX=Math.max(-9, Math.floor(Math.log10(xStart)));
  const powMaxX=Math.min(9, Math.ceil(Math.log10(xEnd)));
  const powMinY=Math.max(-9, Math.floor(Math.log10(yStart)));
  const powMaxY=Math.min(9, Math.ceil(Math.log10(yEnd)));
  for(let p=powMinX;p<=powMaxX;p++){
    const base=Math.pow(10,p);
    const nextBase=base*10;
    if(base>=xStart && base<=xEnd){
      const px=Math.round(w2px(base))+.5;
      ctx.moveTo(px,0); ctx.lineTo(px,H);
    }
    if(majorOnly) continue;
    for(let s=2;s<10;s++){
      const v=base*s;
      if(v>=xStart && v<=xEnd){
        const px=Math.round(w2px(v))+.5;
        ctx.moveTo(px,0); ctx.lineTo(px,H);
      }
    }
  }
  for(let p=powMinY;p<=powMaxY;p++){
    const base=Math.pow(10,p);
    if(base>=yStart && base<=yEnd){
      const py=Math.round(w2py(base))+.5;
      ctx.moveTo(0,py); ctx.lineTo(W,py);
    }
    if(majorOnly) continue;
    for(let s=2;s<10;s++){
      const v=base*s;
      if(v>=yStart && v<=yEnd){
        const py=Math.round(w2py(v))+.5;
        ctx.moveTo(0,py); ctx.lineTo(W,py);
      }
    }
  }
}
function visibleWorldBounds(){
  const x0=px2wx(0), x1=px2wx(W), y0=py2wy(H), y1=py2wy(0);
  return {
    xMin:Math.min(x0,x1),
    xMax:Math.max(x0,x1),
    yMin:Math.min(y0,y1),
    yMax:Math.max(y0,y1)
  };
}
function minRadiusToViewport(bounds){
  const dx = bounds.xMin<=0&&bounds.xMax>=0 ? 0 : Math.min(Math.abs(bounds.xMin),Math.abs(bounds.xMax));
  const dy = bounds.yMin<=0&&bounds.yMax>=0 ? 0 : Math.min(Math.abs(bounds.yMin),Math.abs(bounds.yMax));
  return Math.hypot(dx,dy);
}
function maxRadiusToViewport(bounds){
  return Math.max(
    Math.hypot(bounds.xMin,bounds.yMin),
    Math.hypot(bounds.xMin,bounds.yMax),
    Math.hypot(bounds.xMax,bounds.yMin),
    Math.hypot(bounds.xMax,bounds.yMax)
  );
}
function polarCircles(step, majorOnly){
  if(!Number.isFinite(step)||step<=0) return;
  const bounds=visibleWorldBounds();
  const minR=minRadiusToViewport(bounds);
  const maxR=maxRadiusToViewport(bounds)+step;
  const start=Math.max(step, Math.floor(minR/step)*step);
  const cx=w2px(0), cy=w2py(0);
  let guard=0;
  for(let r=start;r<=maxR+1e-9&&guard<360;r+=step,guard++){
    if(!majorOnly && Math.abs(r/step/5-Math.round(r/step/5))<1e-9) continue;
    const pr=r*view.scale;
    if(pr<0.5) continue;
    ctx.moveTo(cx+pr,cy);
    ctx.arc(cx,cy,pr,0,Math.PI*2);
  }
}
function polarRays(step, majorOnly){
  const count=Math.round(Math.PI/step);
  for(let i=0;i<count;i++){
    if(!majorOnly && i%2===0) continue;
    const theta=i*step;
    const segment=lineThroughViewport(w2px(0),w2py(0),Math.cos(theta),-Math.sin(theta));
    if(!segment) continue;
    ctx.moveTo(segment[0].x,segment[0].y);
    ctx.lineTo(segment[1].x,segment[1].y);
  }
}
function lineThroughViewport(x0,y0,dx,dy){
  const pts=[];
  const add=(x,y)=>{
    if(x<-1e-6||x>W+1e-6||y<-1e-6||y>H+1e-6) return;
    if(!pts.some(p=>Math.abs(p.x-x)<1e-5&&Math.abs(p.y-y)<1e-5)) pts.push({x,y});
  };
  if(Math.abs(dx)>1e-12){
    let t=(0-x0)/dx; add(0,y0+t*dy);
    t=(W-x0)/dx; add(W,y0+t*dy);
  }
  if(Math.abs(dy)>1e-12){
    let t=(0-y0)/dy; add(x0+t*dx,0);
    t=(H-y0)/dy; add(x0+t*dx,H);
  }
  if(pts.length<2) return null;
  return pts.slice(0,2);
}
function drawAxes(){
  ctx.strokeStyle=getCss('--axis'); ctx.lineWidth=1.4;
  const ax=Math.round(w2px(0))+.5, ay=Math.round(w2py(0))+.5;
  ctx.beginPath();
  if(ay>=0&&ay<=H){ctx.moveTo(0,ay);ctx.lineTo(W,ay);}
  if(ax>=0&&ax<=W){ctx.moveTo(ax,0);ctx.lineTo(ax,H);}
  ctx.stroke();
  ctx.fillStyle=getCss('--muted');
  ctx.font='11px '+getCss('--mono');
  const lx=Math.min(Math.max(ay,12),H-4);
  const ly=Math.min(Math.max(ax+4,4),W-4);
  ctx.textBaseline='top'; ctx.textAlign='center';
  if(gridMode!=='log'){
    const major=niceStep(80,view.scale);
    forEachTick(major,(x)=>{
      if(Math.abs(x)<major/2) return;
      ctx.fillText(fmt(x), w2px(x), lx+3);
    });
    ctx.textAlign='right'; ctx.textBaseline='middle';
    forEachTick(major,null,(y)=>{
      if(Math.abs(y)<major/2) return;
      ctx.fillText(fmt(y), ly-6, w2py(y));
    });
  } else {
    const x0=px2wx(0), x1=px2wx(W), y0=py2wy(H), y1=py2wy(0);
    const xMin=Math.max(0.0001, Math.min(x0,x1));
    const xMax=Math.max(x0,x1,1);
    const yMin=Math.max(0.0001, Math.min(y0,y1));
    const yMax=Math.max(y0,y1,1);
    const powMinX=Math.max(-9, Math.floor(Math.log10(xMin)));
    const powMaxX=Math.min(9, Math.ceil(Math.log10(xMax)));
    const powMinY=Math.max(-9, Math.floor(Math.log10(yMin)));
    const powMaxY=Math.min(9, Math.ceil(Math.log10(yMax)));
    for(let p=powMinX;p<=powMaxX;p++){
      const v=Math.pow(10,p);
      if(v>=xMin && v<=xMax) ctx.fillText('10^'+p, w2px(v), lx+3);
    }
    ctx.textAlign='right'; ctx.textBaseline='middle';
    for(let p=powMinY;p<=powMaxY;p++){
      const v=Math.pow(10,p);
      if(v>=yMin && v<=yMax) ctx.fillText('10^'+p, ly-6, w2py(v));
    }
  }
}

function gridlines(step,fx,fy){ forEachTick(step,fx,fy); }
function forEachTick(step,fx,fy){
  if(fx){
    const x0=Math.ceil(px2wx(0)/step)*step;
    const x1=px2wx(W);
    for(let x=x0;x<=x1+1e-9;x+=step) fx(x);
  }
  if(fy){
    const y0=Math.ceil(py2wy(H)/step)*step;
    const y1=py2wy(0);
    for(let y=y0;y<=y1+1e-9;y+=step) fy(y);
  }
}

function nextAnnotationId(){ return annotationIdCounter++; }

function restoreAnnotations(saved){
  annotations=[];
  annotationIdCounter=1;
  if(!Array.isArray(saved)) return;
  saved.forEach(item=>{
    const text=String(item?.text || '').trim();
    const x=Number(item?.x), y=Number(item?.y);
    if(!text || !Number.isFinite(x) || !Number.isFinite(y)) return;
    const savedId=Number(item.id);
    const id=Number.isFinite(savedId)&&savedId>0 ? savedId : nextAnnotationId();
    annotations.push({
      id,
      x,
      y,
      text,
      color:sanitizeColor(item.color),
      noBorder:item.noBorder===true
    });
    annotationIdCounter=Math.max(annotationIdCounter,id+1);
  });
}

function fitToView(){
  if(view3d.mode==='3d'){
    const actual=finiteSceneBounds(equations);
    const target=actual?.target||[0,0,0];
    const box=actual||axisBox();
    const fit=fitCameraScale({width:W,height:H},box,.9);
    view3d.camera=createCamera({...view3d.camera,target,scale:fit});
    view3dFit=fit;
    view3dFitAxisRange=activeAxisRange();
    draw(); scheduleSave(); return;
  }
  const pad=60;
  let minX=Infinity,maxX=-Infinity,minY=Infinity,maxY=-Infinity,any=false;
  equations.forEach(eq=>{
    if(!eq.visible || !eq.fn || eq.geometry?.dim===3) return;
    any=true;
    for(let px=0;px<=W;px+=Math.max(1,Math.floor(W/400))){
      const wx=px2wx(px);
      const wy=safeEval(eq.fn,wx);
      if(!Number.isFinite(wy)) continue;
      if(wx<minX) minX=wx; if(wx>maxX) maxX=wx;
      if(wy<minY) minY=wy; if(wy>maxY) maxY=wy;
    }
    if(eq.kind==='geometry' && eq.geometry){
      (eq.geometry.points||[]).forEach(p=>{
        if(p.x<minX) minX=p.x; if(p.x>maxX) maxX=p.x;
        if(p.y<minY) minY=p.y; if(p.y>maxY) maxY=p.y;
      });
      (eq.geometry.segments||[]).forEach(s=>{
        [s.a.x,s.b.x].forEach(v=>{ if(v<minX) minX=v; if(v>maxX) maxX=v; });
        [s.a.y,s.b.y].forEach(v=>{ if(v<minY) minY=v; if(v>maxY) maxY=v; });
      });
      (eq.geometry.vectors||[]).forEach(v=>{
        [v.from.x,v.to.x].forEach(x=>{ if(x<minX) minX=x; if(x>maxX) maxX=x; });
        [v.from.y,v.to.y].forEach(y=>{ if(y<minY) minY=y; if(y>maxY) maxY=y; });
      });
    }
  });
  if(!any || !Number.isFinite(minX)){ view.cx=0; view.cy=0; view.scale=38; draw(); scheduleSave(); return; }
  const spanX=Math.max((maxX-minX)*1.15, 1e-6);
  const spanY=Math.max((maxY-minY)*1.15, 1e-6);
  view.cx=(minX+maxX)/2;
  view.cy=(minY+maxY)/2;
  const sx=(W-pad*2)/spanX;
  const sy=(H-pad*2)/spanY;
  view.scale=Math.min(sx,sy);
  view.scale=Math.min(Math.max(view.scale,0.02),50000);
  draw(); scheduleSave();
}

function toggleGridMode(){
  if(view3d.mode==='3d'){ view3d.grid=!view3d.grid; draw(); scheduleSave(); return; }
  const idx=GRID_MODES.indexOf(gridMode);
  gridMode=GRID_MODES[(idx+1)%GRID_MODES.length] || 'linear';
  updateGridModeButton();
  draw(); scheduleSave();
}

function toggleAnnotationMode(){
  annotationMode=!annotationMode;
  const btn=document.getElementById('annotate');
  if(btn){
    if(annotationMode){
      btn.innerHTML = `<svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 3v18M3 12h18"/><path d="M9 6l3-3 3 3M9 18l3 3 3-3M18 9l3 3-3 3M6 9l-3 3 3 3"/></svg>`;
    } else {
      btn.textContent = 'T';
    }
    btn.setAttribute('aria-pressed', annotationMode?'true':'false');
    btn.title=annotationMode ? 'Modo navegação' : 'Modo anotação';
  }
  setCanvasCursor();
  draw();
}

function drawAnnotations(){
  if(!annotations.length) return;
  ctx.save();
  ctx.font='12px '+getCss('--mono');
  ctx.textBaseline='middle'; ctx.textAlign='center';
  annotations.forEach(a=>{
    const px=w2px(a.x), py=w2py(a.y);
    if(px<-200||px>W+200||py<-200||py>H+200) return;
    const lines = String(a.text||'').split('\n');
    const lineH = 14;
    const w = Math.max(...lines.map(l => ctx.measureText(l).width)) + 14;
    const h = Math.max(22, lines.length*lineH + 6);
    const rx=px-w/2, ry=py-h/2;
    const color=a.color || getCss('--accent');
    ctx.strokeStyle=color;
    ctx.lineWidth=1; ctx.setLineDash([3,3]);
    ctx.beginPath();
    ctx.arc(px,py,6,0,Math.PI*2);
    ctx.stroke();
    ctx.setLineDash([]);
    ctx.fillStyle=getCss('--bg');
    ctx.globalAlpha=0.85;
    ctx.fillRect(rx, ry, w, h);
    ctx.globalAlpha=1;
    if(!a.noBorder){
      ctx.strokeStyle=color;
      ctx.lineWidth=1;
      ctx.strokeRect(rx, ry, w, h);
    }
    ctx.fillStyle=getCss('--ink');
    const startY = py - (lines.length-1)*lineH/2;
    lines.forEach((line, i) => ctx.fillText(line, px, startY + i*lineH));
    const cx=rx+w-8, cy=ry+8;
    if(a.id === annotationHoverId){
      ctx.fillStyle=getCss('--ink');
      ctx.globalAlpha=0.7;
      ctx.beginPath(); ctx.arc(cx, cy, 7, 0, Math.PI*2); ctx.fill();
      ctx.strokeStyle=getCss('--bg');
      ctx.lineWidth=1; ctx.setLineDash([]);
      ctx.beginPath(); ctx.moveTo(cx-3,cy-3); ctx.lineTo(cx+3,cy+3); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(cx+3,cy-3); ctx.lineTo(cx-3,cy+3); ctx.stroke();
      ctx.globalAlpha=1;
    }
    if(a.id === annotationHoverId){
      const cbx=rx+8, cby=ry+h-8, cbr=6;
      ctx.fillStyle=color;
      ctx.beginPath(); ctx.arc(cbx, cby, cbr, 0, Math.PI*2); ctx.fill();
      ctx.strokeStyle=getCss('--bg');
      ctx.lineWidth=1; ctx.setLineDash([]);
      ctx.beginPath(); ctx.arc(cbx, cby, cbr, 0, Math.PI*2); ctx.stroke();
      a._colorBtn={x:cbx,y:cby,r:cbr};
    }
    a._box={x:rx,y:ry,w,h};
    a._hitX={x:cx,y:cy};
  });
  ctx.restore();
}

function addAnnotation(wx, wy, text, color){
  const entry = {id:nextAnnotationId(), x:wx, y:wy, text:String(text||'').trim()};
  if(color) entry.color = color;
  annotations.push(entry);
  draw(); scheduleSave();
}

function closeAnnotationColorEditor(){
  const existing=document.getElementById('annotation-color-editor');
  if(existing) existing.remove();
}

function annotationStage(){
  return document.getElementById('stage');
}

function positionAnnotationOverlay(el, px, py){
  const margin=10;
  const width=el.offsetWidth || 140;
  const height=el.offsetHeight || 30;
  const x=Math.min(Math.max(px,margin+width/2),Math.max(margin+width/2,W-margin-width/2));
  const y=Math.min(Math.max(py,margin+height/2),Math.max(margin+height/2,H-margin-height/2));
  el.style.left=x+'px';
  el.style.top=y+'px';
}

function prepareAnnotationField(input){
  input.id='annotation-input';
  input.style.position='absolute';
  input.style.zIndex='20';
  input.style.width='min(240px, calc(100% - 20px))';
  input.style.minWidth='120px';
  input.style.minHeight='28px';
  input.style.maxHeight='320px';
  input.style.boxSizing='border-box';
  input.style.padding='4px 7px';
  input.style.overflowY='auto';
  input.style.border='1px solid var(--accent)';
  input.style.borderRadius='6px';
  input.style.background='var(--field)';
  input.style.color='var(--ink)';
  input.style.fontFamily='var(--mono)';
  input.style.fontSize='12px';
  input.style.transform='translate(-50%,-50%)';
  input.style.resize='none';
  input.style.lineHeight='1.35';
  input.style.outline='none';
  input.style.boxShadow='0 8px 22px rgba(20,25,35,.16)';
  input.addEventListener('pointerdown',ev=>ev.stopPropagation());
  input.addEventListener('dblclick',ev=>ev.stopPropagation());
  input.addEventListener('contextmenu',ev=>ev.stopPropagation());
}

function finishExistingAnnotationInput(){
  if(annotationDrag?.finish){
    annotationDrag.finish();
    return true;
  }
  const existing=document.getElementById('annotation-input');
  if(existing) existing.remove();
  return false;
}

function openAnnotationColorEditor(a){
  closeAnnotationColorEditor();
  const px=w2px(a.x), py=w2py(a.y);
  const rx=px-a._box.w/2, ry=py-a._box.h/2;
  const pop=document.createElement('div');
  pop.id='annotation-color-editor';
  pop.style.position='absolute';
  pop.style.left=(rx + a._box.w - 8)+'px';
  pop.style.top=(ry + a._box.h + 4)+'px';
  pop.style.zIndex='30';
  pop.style.background='var(--field)';
  pop.style.border='1px solid var(--field-edge)';
  pop.style.borderRadius='6px';
  pop.style.padding='6px';
  pop.style.display='flex';
  pop.style.flexDirection='column';
  pop.style.gap='4px';

  const row=document.createElement('div');
  row.style.display='flex';
  row.style.gap='4px';
  row.style.flexWrap='wrap';
  row.style.maxWidth='180px';

  const palette=PAL();
  const value=a.color || getCss('--accent');
  palette.forEach(c=>{
    const s=document.createElement('button');
    s.style.width='18px'; s.style.height='18px';
    s.style.borderRadius='50%';
    s.style.border='1px solid var(--field-edge)';
    s.style.background=c;
    s.style.cursor='pointer';
    s.title=c;
    s.onclick=()=>{ a.color=c; a.noBorder=false; draw(); scheduleSave(); closeAnnotationColorEditor(); };
    row.appendChild(s);
  });

  const noneBtn=document.createElement('button');
  noneBtn.textContent='Sem borda';
  noneBtn.style.marginTop='4px';
  noneBtn.style.background='var(--field)';
  noneBtn.style.border='1px solid var(--field-edge)';
  noneBtn.style.borderRadius='4px';
  noneBtn.style.color='var(--ink)';
  noneBtn.style.cursor='pointer';
  noneBtn.style.padding='2px 6px';
  noneBtn.title='Remover borda (transparente)';
  noneBtn.onclick=()=>{ a.noBorder=true; draw(); scheduleSave(); closeAnnotationColorEditor(); };
  const normalBtn=document.createElement('button');
  normalBtn.textContent='Normal';
  normalBtn.style.marginTop='4px';
  normalBtn.style.background='var(--field)';
  normalBtn.style.border='1px solid var(--field-edge)';
  normalBtn.style.borderRadius='4px';
  normalBtn.style.color='var(--ink)';
  normalBtn.style.cursor='pointer';
  normalBtn.style.padding='2px 6px';
  normalBtn.title='Restaurar borda';
  normalBtn.onclick=()=>{ a.noBorder=false; draw(); scheduleSave(); closeAnnotationColorEditor(); };

  const optionsRow=document.createElement('div');
  optionsRow.style.display='flex';
  optionsRow.style.gap='4px';
  optionsRow.style.flexWrap='wrap';
  optionsRow.style.maxWidth='180px';
  optionsRow.appendChild(normalBtn);
  optionsRow.appendChild(noneBtn);

  const custom=document.createElement('input');
  custom.type='color';
  custom.value=value;
  custom.style.width='100%';
  custom.style.height='24px';
  custom.style.border='none';
  custom.style.padding='0';
  custom.style.background='transparent';
  custom.oninput=()=>{ a.color=custom.value; draw(); scheduleSave(); };

  pop.appendChild(row);
  pop.appendChild(optionsRow);
  pop.appendChild(custom);
  document.getElementById('stage').appendChild(pop);

  const remove=(e)=>{
    if(!pop.contains(e.target)){ closeAnnotationColorEditor(); document.removeEventListener('pointerdown', remove); }
  };
  setTimeout(()=>document.addEventListener('pointerdown', remove), 0);
}

function startAnnotationInput(px, py){
  const wx=px2wx(px), wy=py2wy(py);
  if(annotationDrag?.input){
    annotationDrag.input.focus();
    return;
  }
  finishExistingAnnotationInput();
  const input=document.createElement('textarea');
  input.placeholder='anotação';
  prepareAnnotationField(input);
  input.rows=1;
  input.value='';
  annotationStage().appendChild(input);
  positionAnnotationOverlay(input,px,py);
  input.focus();
  let finished=false;
  const finish=()=>{
    if(finished) return;
    finished=true;
    const lines = String(input.value).replace(/\n+$/,'').split('\n');
    const t = lines.join('\n').trim();
    input.remove();
    if(t) addAnnotation(wx, wy, t);
    annotationDrag=null;
    draw(); scheduleSave();
  };
  const autoResize=()=>{
    input.style.height='auto';
    input.style.height=input.scrollHeight+'px';
    positionAnnotationOverlay(input,px,py);
  };
  input.addEventListener('input', autoResize);
  input.addEventListener('keydown',ev=>{
    if(ev.key==='Enter'){
      if(ev.shiftKey){
        setTimeout(autoResize,0);
      } else {
        ev.preventDefault(); finish();
      }
    } else if(ev.key==='Escape'){
      ev.preventDefault(); finish();
    }
  });
  input.addEventListener('blur', finish);
  annotationDrag={input, wx, wy, finish};
  setTimeout(autoResize,0);
}

function deleteAnnotationAt(px, py){
  const best=annotations.find(a=>{
    const dx=w2px(a.x)-px, dy=w2py(a.y)-py;
    return Math.hypot(dx,dy)<=18;
  });
  if(!best) return;
  annotations=annotations.filter(a=>a.id!==best.id);
  draw(); scheduleSave();
}

function editAnnotationAt(px, py){
  finishExistingAnnotationInput();
  const best=annotations.find(a=>{
    if(!a._box) return false;
    return px>=a._box.x && px<=a._box.x+a._box.w && py>=a._box.y && py<=a._box.y+a._box.h;
  });
  if(!best) return;
  const apx=w2px(best.x), apy=w2py(best.y);
  const input=document.createElement('textarea');
  input.value=best.text;
  prepareAnnotationField(input);
  input.rows=Math.min(String(best.text).split('\n').length,6);
  annotationStage().appendChild(input);
  positionAnnotationOverlay(input,apx,apy);
  input.focus(); input.select();
  let finished=false;
  const finish=()=>{
    if(finished) return;
    finished=true;
    if(input.value.trim()) best.text=input.value.trim();
    input.remove();
    draw(); scheduleSave();
    annotationDrag=null;
  };
  input.addEventListener('keydown',ev=>{
    if(ev.key==='Enter'&&!ev.shiftKey){ ev.preventDefault(); finish(); }
    else if(ev.key==='Escape'){ ev.preventDefault(); finish(); }
    else if(ev.key==='Enter'&&ev.shiftKey){ setTimeout(autoResize,0); }
  });
  const autoResize=()=>{
    input.style.height='auto';
    input.style.height=input.scrollHeight+'px';
    positionAnnotationOverlay(input,apx,apy);
  };
  input.addEventListener('input', autoResize);
  input.addEventListener('blur', finish);
  annotationDrag={input, finish};
  setTimeout(autoResize,0);
}

function plotPath(valueAt, opts){
  const {color, width=2, dash=null, alpha=1}=opts;
  ctx.save();
  ctx.globalAlpha=alpha;
  ctx.lineWidth=width;
  ctx.strokeStyle=color;
  ctx.lineJoin='round'; ctx.lineCap='round';
  if(dash) ctx.setLineDash(dash);
  ctx.beginPath();
  let pen=false, prevPy=null, prevWx=null, prevWy=null;
  const limit=H*4;
  for(let px=0;px<=W;px+=1){
    const wx=px2wx(px);
    const wy=safeEval(valueAt,wx);
    if(!Number.isFinite(wy)){ pen=false; prevPy=null; prevWx=null; prevWy=null; continue; }
    const py=w2py(wy);
    if(!pen){ ctx.moveTo(px,py); pen=true; }
    else if(prevPy!==null && (Math.abs(py-prevPy)>limit || !segmentLooksContinuous(valueAt,prevWx,wx,prevWy,wy))){
      ctx.moveTo(px,py);
    }
    else { ctx.lineTo(px,py); }
    prevPy=py; prevWx=wx; prevWy=wy;
  }
  ctx.stroke();
  ctx.restore();
}

function segmentLooksContinuous(f,a,b,fa,fb){
  if(a===null||b===null) return false;
  const mid=(a+b)/2;
  const fm=safeEval(f,mid);
  if(!Number.isFinite(fm)) return false;
  const visibleSpan=Math.max(1,H/Math.max(view.scale,1e-9));
  const jumpLimit=Math.max(visibleSpan*18, 1e5);
  return Math.abs(fm-fa)<=jumpLimit && Math.abs(fm-fb)<=jumpLimit;
}

function plotIntegral(eq){
  const f=eq.fn;
  // The accumulated-area samples depend only on the horizontal view (cx, scale,
  // W) and the function (text + params), not on cy. Reuse them across redraws
  // that don't pan/zoom horizontally (e.g. mouse-move hover), where recomputing
  // the whole cumulative integral every frame is the dominant cost.
  const sig=view.cx+'|'+view.scale+'|'+W+'|'+eq.text+'|'+JSON.stringify(eq.params);
  let values;
  if(eq.intCache && eq.intCache.sig===sig){
    values=eq.intCache.values;
  } else {
    values=new Array(Math.max(0,Math.round(W))+1).fill(NaN);
    const setForward=(startPx,startAcc,step)=>{
      let acc=startAcc;
      values[startPx]=acc;
      for(let px=startPx+step;px>=0&&px<=W;px+=step){
        const a=px2wx(px-step), b=px2wx(px);
        const area=segmentIntegral(f,a,b);
        if(!Number.isFinite(area)) break;
        acc+=area;
        values[px]=acc;
      }
    };
    const anchorPx=Math.round(w2px(0));
    if(anchorPx>=0&&anchorPx<=W){
      setForward(anchorPx,0,1);
      setForward(anchorPx,0,-1);
    } else {
      const xmin=px2wx(0);
      const base=integralAt(f,xmin);
      if(Number.isFinite(base)) setForward(0,base,1);
    }
    eq.intCache={sig,values};
  }
  ctx.save();
  ctx.globalAlpha=0.95; ctx.lineWidth=1.8; ctx.strokeStyle=eqColor(eq);
  ctx.setLineDash([1,5]); ctx.lineCap='round';
  ctx.beginPath();
  let pen=false, prevPy=null;
  const limit=H*4;
  for(let px=0;px<=W;px+=1){
    const acc=values[px];
    if(!Number.isFinite(acc)){ pen=false; prevPy=null; continue; }
    const py=w2py(acc);
    if(!pen){ ctx.moveTo(px,py); pen=true; }
    else if(prevPy!==null && Math.abs(py-prevPy)>limit){ ctx.moveTo(px,py); }
    else { ctx.lineTo(px,py); }
    prevPy=py;
  }
  ctx.stroke();
  ctx.restore();
}

function fillAreaSegment(points,color){
  if(points.length<2) return;
  const baseY=Math.max(-H*2,Math.min(H*3,w2py(0)));
  ctx.beginPath();
  ctx.moveTo(points[0].px,baseY);
  ctx.lineTo(points[0].px,points[0].py);
  for(const p of points) ctx.lineTo(p.px,p.py);
  const last=points[points.length-1];
  ctx.lineTo(last.px,baseY);
  ctx.closePath();
  ctx.fillStyle=color;
  ctx.fill();
}

function drawIntegralArea(eq,wx){
  const a=Math.min(0,wx), b=Math.max(0,wx);
  const lo=Math.max(a,px2wx(0)), hi=Math.min(b,px2wx(W));
  if(!(hi>lo)) return;
  const p0=Math.max(0,Math.floor(w2px(lo)));
  const p1=Math.min(W,Math.ceil(w2px(hi)));
  if(p1<=p0) return;
  ctx.save();
  ctx.globalAlpha=0.13;
  let points=[], prevX=null;
  const flush=()=>{ fillAreaSegment(points,eqColor(eq)); points=[]; };
  for(let px=p0;px<=p1;px+=2){
    const x=px2wx(px);
    const y=safeEval(eq.fn,x);
    const continuous=prevX===null || Number.isFinite(segmentIntegral(eq.fn,prevX,x));
    if(!Number.isFinite(y)||!continuous){
      flush(); prevX=null; continue;
    }
    points.push({px,py:w2py(y)});
    prevX=x;
  }
  if(p1%2!==p0%2){
    const x=px2wx(p1), y=safeEval(eq.fn,x);
    if(Number.isFinite(y)&&(prevX===null||Number.isFinite(segmentIntegral(eq.fn,prevX,x)))) points.push({px:p1,py:w2py(y)});
  }
  flush();
  ctx.restore();
}

function drawTangent(eq,wx,wy,slope){
  if(!Number.isFinite(wy)||!Number.isFinite(slope)) return;
  const half=Math.max(45/view.scale,Math.min((px2wx(W)-px2wx(0))*0.12,140/view.scale));
  const x1=wx-half, x2=wx+half;
  const y1=wy+slope*(x1-wx), y2=wy+slope*(x2-wx);
  if(!Number.isFinite(y1)||!Number.isFinite(y2)) return;
  ctx.save();
  ctx.globalAlpha=0.78;
  ctx.lineWidth=1.5;
  ctx.strokeStyle=eqColor(eq);
  ctx.beginPath();
  ctx.moveTo(w2px(x1),w2py(y1));
  ctx.lineTo(w2px(x2),w2py(y2));
  ctx.stroke();
  ctx.restore();
}

function drawLimitMarker(eq,wx,lim){
  const points=[];
  if(lim.exists&&Number.isFinite(lim.value)) points.push({y:lim.value,alpha:0.95});
  else{
    if(lim.left?.exists&&Number.isFinite(lim.left.value)) points.push({y:lim.left.value,alpha:0.55});
    if(lim.right?.exists&&Number.isFinite(lim.right.value)) points.push({y:lim.right.value,alpha:0.55});
  }
  if(!points.length) return;
  ctx.save();
  ctx.strokeStyle=eqColor(eq);
  ctx.fillStyle=getCss('--bg');
  ctx.lineWidth=1.7;
  for(const point of points){
    const px=w2px(wx), py=w2py(point.y);
    if(py<-20||py>H+20) continue;
    ctx.globalAlpha=point.alpha;
    ctx.beginPath();
    ctx.moveTo(px,py-5);
    ctx.lineTo(px+5,py);
    ctx.lineTo(px,py+5);
    ctx.lineTo(px-5,py);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
  }
  ctx.restore();
}

function marker(px,py,color,kind){
  ctx.save();
  ctx.lineWidth=2;
  if(kind==='zero'){
    ctx.strokeStyle=color; ctx.fillStyle=getCss('--bg');
    ctx.beginPath(); ctx.arc(px,py,4.5,0,Math.PI*2); ctx.fill(); ctx.stroke();
  } else {
    ctx.fillStyle=color; ctx.strokeStyle=getCss('--bg');
    ctx.beginPath(); ctx.arc(px,py,4.5,0,Math.PI*2); ctx.fill(); ctx.stroke();
  }
  ctx.restore();
}

function analysisCtx(){ return {W,H,view,px2wx,fmt}; }
function drawAnalysis(){
  const card=document.getElementById('analysis');
  const active=equations.filter(e=>e.showA&&e.visible&&e.fn);
  if(!active.length){ card.style.display='none'; return; }
  let html='';
  active.forEach(eq=>{
    const col=eqColor(eq);
    const a=analyzeEq(eq,analysisCtx());
    a.zeros.forEach(z=>marker(w2px(z),w2py(0),col,'zero'));
    a.maxs.forEach(p=>marker(w2px(p.x),w2py(p.y),col,'ext'));
    a.mins.forEach(p=>marker(w2px(p.x),w2py(p.y),col,'ext'));
    a.inflex.forEach(p=>marker(w2px(p.x),w2py(p.y),col,'ext'));
    a.holes.forEach(p=>marker(w2px(p.x),w2py(p.y),col,'zero'));
    if(a.yInt!==null) marker(w2px(0),w2py(a.yInt),col,'ext');

    const cap=(arr,n)=>arr.slice(0,n);
    const ptList=arr=>cap(arr,4).map(p=>'('+fmt(p.x)+', '+fmt(p.y)+')').join('  ')+(arr.length>4?' …':'');
    const zList=arr=>cap(arr,5).map(z=>fmt(z)).join('  ')+(arr.length>5?' …':'');
    const line=(label,value)=>'<div class="an-line"><b>'+htmlEscape(label)+'</b> '+htmlEscape(value)+'</div>';
    const vertical=a.vAsym.length?'x≈'+cap(a.vAsym,4).map(fmt).join(', ')+(a.vAsym.length>4?' …':''):'';
    const asym=[vertical,a.hAsym!=='—'?a.hAsym:''].filter(Boolean).join(' · ') || '—';

    html+='<div class="an-block"><div class="an-head"><span class="dot" style="background:'+col+'"></span>'
        +htmlEscape(formatMathVisual(eq.text||'f(x)'))+'</div>';
    html+=line('dom',a.domain);
    html+=line('img',a.range);
    html+=line('zeros',a.zeros.length?zList(a.zeros):'—');
    html+=line('y(0)',a.yInt!==null?fmt(a.yInt):'—');
    html+=line('máx',a.maxs.length?ptList(a.maxs):'—');
    html+=line('mín',a.mins.length?ptList(a.mins):'—');
    html+=line('crit',a.flats.length?ptList(a.flats):'—');
    html+=line('infl',a.inflex.length?ptList(a.inflex):'—');
    html+=line('remov',a.holes.length?ptList(a.holes):'—');
    html+=line('cresc',formatIntervalList(a.inc,fmt,2));
    html+=line('decr',formatIntervalList(a.dec,fmt,2));
    html+=line('conc+',formatIntervalList(a.concUp,fmt,2));
    html+=line('conc-',formatIntervalList(a.concDown,fmt,2));
    html+=line('assínt',asym);
    html+=line('sim',a.parity);
    if(eq.showD){
      if(eq.deriv1) html+=line('f′','f′(x) = '+formatMathVisual(eq.deriv1.text));
      const info=derivInfo(eq.fn,eq.dx);
      if(!info.differentiable){
        if(info.reason==='undefined-point') html+=line('f′','f′('+fmt(eq.dx)+') não existe: f não é definida aí');
        else if(info.reason==='corner') html+=line('f′','não diferenciável em x='+fmt(eq.dx)+' (f′⁻≈'+fmt(info.left)+', f′⁺≈'+fmt(info.right)+')');
        else html+=line('f′','não diferenciável em x='+fmt(eq.dx));
      } else {
        const d=safeEval(eqDerivFn(eq),eq.dx);
        html+=line('f′',Number.isFinite(d)?'f′('+fmt(eq.dx)+')≈'+fmt(d):'indefinida');
      }
    }
    if(eq.showD2){
      if(eq.deriv2) html+=line('f″','f″(x) = '+htmlEscape(eq.deriv2.text));
      const d2=safeEval(eqDeriv2Fn(eq),eq.dx);
      html+=line('f″',Number.isFinite(d2)?'f″('+fmt(eq.dx)+')≈'+fmt(d2):'indefinida');
    }
    if(eq.showI){
      const v=integ(eq.fn,eq.ia,eq.ib);
      html+=line('∫',Number.isFinite(v)?'∫['+fmt(eq.ia)+','+fmt(eq.ib)+']≈'+fmt(v):'indefinida');
      if(eq.antider) html+=line('F','F(x) = '+htmlEscape(eq.antider.text)+' + C');
    }
    if(eq.showR){ const v=riemannEstimate(eq); html+=line('Σ',Number.isFinite(v)?riemannModeLabel(eq.riemannMode)+' n='+riemannN(eq)+' ≈ '+fmt(v):'indefinida'); }
    if(eq.showL){ html+=line('lim', eq.lInf?formatLimitInfinity(limitAtInfinity(eq.fn,eq.lInf==='+'?1:-1),eq.lInf):formatLimitInfo(limitAt(eq.fn,eq.lx),eq.lx)); }
    html+='</div>';
  });
  card.innerHTML=html;
  card.style.display='block';
}

function drawDefiniteArea(eq){
  const a=Math.min(eq.ia,eq.ib), b=Math.max(eq.ia,eq.ib);
  const lo=Math.max(a,px2wx(0)), hi=Math.min(b,px2wx(W));
  if(!(hi>lo)) return;
  const p0=Math.max(0,Math.floor(w2px(lo)));
  const p1=Math.min(W,Math.ceil(w2px(hi)));
  if(p1<=p0) return;
  ctx.save();
  ctx.globalAlpha=0.18;
  let points=[], prevX=null;
  const flush=()=>{ fillAreaSegment(points,eqColor(eq)); points=[]; };
  for(let px=p0;px<=p1;px+=2){
    const x=px2wx(px);
    const y=safeEval(eq.fn,x);
    const continuous=prevX===null || Number.isFinite(segmentIntegral(eq.fn,prevX,x));
    if(!Number.isFinite(y)||!continuous){ flush(); prevX=null; continue; }
    points.push({px,py:w2py(y)});
    prevX=x;
  }
  flush();
  ctx.restore();
}

function clampPlotY(py){
  return Math.max(-H*2,Math.min(H*3,py));
}

function drawRiemann(eq){
  if(!eq.visible||!eq.fn||!eq.showR) return;
  const n=riemannN(eq);
  const a=eq.ia, b=eq.ib;
  if(!Number.isFinite(a)||!Number.isFinite(b)||a===b) return;
  const dx=(b-a)/n;
  const color=eqColor(eq);
  const baseY=clampPlotY(w2py(0));
  ctx.save();
  ctx.fillStyle=color;
  ctx.strokeStyle=color;
  ctx.lineWidth=1;
  for(let i=0;i<n;i++){
    const x0=a+i*dx, x1=x0+dx;
    const left=Math.min(x0,x1), right=Math.max(x0,x1);
    const px0=w2px(left), px1=w2px(right);
    if(px1<0||px0>W) continue;
    if(!Number.isFinite(segmentIntegral(eq.fn,x0,x1))) continue;
    if(eq.riemannMode==='trap'){
      const y0=safeEval(eq.fn,x0), y1=safeEval(eq.fn,x1);
      if(!Number.isFinite(y0)||!Number.isFinite(y1)) continue;
      const py0=clampPlotY(w2py(y0)), py1=clampPlotY(w2py(y1));
      ctx.globalAlpha=0.16;
      ctx.beginPath();
      ctx.moveTo(w2px(x0),baseY);
      ctx.lineTo(w2px(x0),py0);
      ctx.lineTo(w2px(x1),py1);
      ctx.lineTo(w2px(x1),baseY);
      ctx.closePath();
      ctx.fill();
      ctx.globalAlpha=0.42;
      ctx.stroke();
    } else {
      const sample=eq.riemannMode==='left' ? x0 : eq.riemannMode==='right' ? x1 : (x0+x1)/2;
      const y=safeEval(eq.fn,sample);
      if(!Number.isFinite(y)) continue;
      const py=clampPlotY(w2py(y));
      const x=Math.max(-2,Math.min(px0,px1));
      const w=Math.max(1,Math.min(W+2,Math.max(px0,px1))-x);
      const yTop=Math.min(baseY,py);
      const h=Math.max(1,Math.abs(baseY-py));
      ctx.globalAlpha=0.16;
      ctx.fillRect(x,yTop,w,h);
      ctx.globalAlpha=0.42;
      ctx.strokeRect(x+.5,yTop+.5,Math.max(0,w-1),Math.max(0,h-1));
    }
  }
  ctx.restore();
}

function strokePolyline(points){
  // points: array of {x:worldX, y:worldY}; non-finite entries break the line.
  ctx.beginPath();
  let pen=false;
  for(const p of points){
    if(!Number.isFinite(p.x)||!Number.isFinite(p.y)){ pen=false; continue; }
    const px=w2px(p.x), py=w2py(p.y);
    if(!pen){ ctx.moveTo(px,py); pen=true; } else ctx.lineTo(px,py);
  }
  ctx.stroke();
}

function curveStyle(eq){
  ctx.lineWidth=eq.lw; ctx.strokeStyle=eqColor(eq);
  ctx.lineJoin='round'; ctx.lineCap='round';
  const dash = eq.style==='dashed'?[7,5] : eq.style==='dotted'?[1,4] : null;
  if(dash) ctx.setLineDash(dash);
}

function drawParametric(eq){
  if(!eq.visible||!eq.xFn||!eq.yFn) return;
  const t0=Math.min(eq.tmin,eq.tmax), t1=Math.max(eq.tmin,eq.tmax);
  const steps=2000;
  const pts=[];
  for(let i=0;i<=steps;i++){
    const t=t0+(t1-t0)*i/steps;
    pts.push({x:safeEval(eq.xFn,t), y:safeEval(eq.yFn,t)});
  }
  ctx.save(); curveStyle(eq); strokePolyline(pts); ctx.restore();
}

function drawPolar(eq){
  if(!eq.visible||!eq.rFn) return;
  const a0=Math.min(eq.thmin,eq.thmax), a1=Math.max(eq.thmin,eq.thmax);
  const steps=2000;
  const pts=[];
  for(let i=0;i<=steps;i++){
    const th=a0+(a1-a0)*i/steps;
    const r=safeEval(eq.rFn,th);
    pts.push({x:r*Math.cos(th), y:r*Math.sin(th)});
  }
  ctx.save(); curveStyle(eq); strokePolyline(pts); ctx.restore();
}

function implicitStepForViewport(){
  // Step in screen pixels for marching squares. view.scale is pixels per world
  // unit; keep zoomed-in views detailed and coarsen when zoomed far out.
  const fit=Math.max(W,H);
  const base=fit/120;
  const scaleFactor=1/Math.sqrt(Math.max(view.scale,1e-9));
  const step=Math.round(Math.max(3, Math.min(10, base*scaleFactor)));
  return step;
}

// Stroke the zero contour of f(x,y) with marching squares.
// caller may pass an explicit step, otherwise use an adaptive one.
function traceImplicit(f, step){
  const s = Number.isFinite(step) && step>0 ? step : implicitStepForViewport();
  const cols=Math.ceil(W/s), rows=Math.ceil(H/s);
  const valAt=(i,j)=>f(px2wx(i*s), py2wy(j*s));
  ctx.beginPath();

  let prev=new Array(cols+1);
  for(let i=0;i<=cols;i++) prev[i]=valAt(i,0);

  for(let j=1;j<=rows;j++){
    const cur=new Array(cols+1);
    for(let i=0;i<=cols;i++) cur[i]=valAt(i,j);

    for(let i=0;i<cols;i++){
      const tl=prev[i], tr=prev[i+1], bl=cur[i], br=cur[i+1];
      // Conservative fallback:
      // - If we can't evaluate enough corners, we can't reliably infer sign changes.
      // - Otherwise, compute intersection candidates only on edges where we have
      //   a sign change between the two finite endpoints.
      const fin = (v)=>Number.isFinite(v);
      const x0=i*s, x1=x0+s, y0=(j-1)*s, y1=j*s;

      const pts=[];
      const edge = (a,b, ax,ay, bx,by)=>{
        if(!fin(a) || !fin(b)) return;
        if((a<0)!==(b<0)){
          // Linear interpolation along the edge
          const denom=a-b;
          if(!Number.isFinite(denom) || Math.abs(denom)<1e-14) return;
          const t = a/denom; // because a/(a-b)
          pts.push([ax+(bx-ax)*t, ay+(by-ay)*t]);
        }
      };

      edge(tl,tr, x0, y0, x1, y0); // top
      edge(bl,br, x0, y1, x1, y1); // bottom
      edge(tl,bl, x0, y0, x0, y1); // left
      edge(tr,br, x1, y0, x1, y1); // right

      if(pts.length===2){
        ctx.moveTo(pts[0][0],pts[0][1]); ctx.lineTo(pts[1][0],pts[1][1]);
      } else if(pts.length===4){
        // marching squares ambiguity: draw two disjoint segments.
        // Order doesn't matter much for visuals; keep deterministic order.
        ctx.moveTo(pts[0][0],pts[0][1]); ctx.lineTo(pts[1][0],pts[1][1]);
        ctx.moveTo(pts[2][0],pts[2][1]); ctx.lineTo(pts[3][0],pts[3][1]);
      }
    }
    prev=cur;
  }
  ctx.stroke();
}

function drawImplicit(eq){
  if(!eq.visible||!eq.implicitF) return;
  ctx.save();
  ctx.lineWidth=eq.lw; ctx.strokeStyle=eqColor(eq);
  ctx.lineJoin='round'; ctx.lineCap='round';
  const dash = eq.style==='dashed'?[7,5] : eq.style==='dotted'?[1,4] : null;
  if(dash) ctx.setLineDash(dash);
  traceImplicit(eq.implicitF);
  ctx.restore();
}

function drawImplicitRegion(eq){
  if(!eq.visible||!eq.implicitF) return;
  const f=eq.implicitF;
  const holds = (eq.ineqOp==='<'||eq.ineqOp==='<=') ? (v=>v<0) : (v=>v>0);
  const step=implicitStepForViewport();
  ctx.save();
  ctx.globalAlpha=0.15; ctx.fillStyle=eqColor(eq);
  for(let px=0;px<W;px+=step){
    for(let py=0;py<H;py+=step){
      const v=f(px2wx(px+step/2), py2wy(py+step/2));
      if(Number.isFinite(v)&&holds(v)) ctx.fillRect(px,py,step,step);
    }
  }
  ctx.restore();
  // boundary: dashed when strict (<,>), solid for <=,>=
  ctx.save();
  ctx.lineWidth=eq.lw; ctx.strokeStyle=eqColor(eq);
  ctx.lineJoin='round'; ctx.lineCap='round';
  if(eq.ineqOp==='<'||eq.ineqOp==='>') ctx.setLineDash([6,4]);
  traceImplicit(f);
  ctx.restore();
}

function drawDataPoints(eq){
  updateDynamicPoints(eq);
  if(!eq.points) return;
  ctx.save();
  ctx.fillStyle=eqColor(eq);
  ctx.strokeStyle=getCss('--bg'); ctx.lineWidth=1.5;
  for(const p of eq.points){
    const px=w2px(p.x), py=w2py(p.y);
    if(px<-10||px>W+10||py<-10||py>H+10) continue;
    ctx.beginPath(); ctx.arc(px,py,3.5,0,Math.PI*2); ctx.fill(); ctx.stroke();
  }
  ctx.restore();
}

function dashForStyle(style){
  return style==='dashed'?[7,5] : style==='dotted'?[1,4] : null;
}

function setDash(style){
  const dash=dashForStyle(style);
  if(dash) ctx.setLineDash(dash);
}

function drawWorldLabel(text,wx,wy,color,opts={}){
  if(!text) return;
  const px=w2px(wx), py=w2py(wy);
  if(px<-30||px>W+30||py<-30||py>H+30) return;
  const offset=opts.offsetPx || [8,-18];
  ctx.save();
  ctx.font='10.5px '+getCss('--mono');
  ctx.textBaseline='top';
  ctx.textAlign='left';
  const padX=4, padY=2;
  const h=15;
  const w=Math.ceil(ctx.measureText(text).width);
  let x=px+offset[0], y=py+offset[1];
  if(opts.center){
    x-=w/2;
    y-=h/2;
  }
  x=Math.max(3+padX,Math.min(W-w-padX-3,x));
  y=Math.max(3+padY,Math.min(H-h-padY-3,y));
  ctx.fillStyle=getCss('--bg');
  ctx.globalAlpha=0.92;
  ctx.fillRect(x-padX,y-padY,w+padX*2,h+padY*2);
  ctx.globalAlpha=1;
  ctx.strokeStyle=getCss('--panel-edge');
  ctx.lineWidth=1;
  ctx.strokeRect(x-padX+.5,y-padY+.5,w+padX*2-1,h+padY*2-1);
  ctx.fillStyle=color;
  ctx.fillText(text,x,y);
  ctx.restore();
}

function screenSegmentDistance(px,py,a,b){
  const ax=w2px(a.x), ay=w2py(a.y), bx=w2px(b.x), by=w2py(b.y);
  const dx=bx-ax, dy=by-ay;
  const den=dx*dx+dy*dy;
  if(den<1e-9) return {dist:Math.hypot(px-ax,py-ay), normal:[0,-1]};
  const t=Math.max(0,Math.min(1,((px-ax)*dx+(py-ay)*dy)/den));
  const qx=ax+t*dx, qy=ay+t*dy;
  let nx=-dy, ny=dx;
  const len=Math.hypot(nx,ny)||1;
  nx/=len; ny/=len;
  if(nx*8+ny*(-18)<0){ nx=-nx; ny=-ny; }
  return {dist:Math.hypot(px-qx,py-qy), normal:[nx,ny]};
}

function screenLineDistance(px,py,line){
  const wx=px2wx(px), wy=py2wy(py);
  const den=Math.hypot(line.a,line.b)||1;
  const dist=Math.abs(line.a*wx+line.b*wy+line.c)/den*view.scale;
  let nx=line.a, ny=-line.b;
  const len=Math.hypot(nx,ny)||1;
  nx/=len; ny/=len;
  if(nx*8+ny*(-18)<0){ nx=-nx; ny=-ny; }
  return {dist, normal:[nx,ny]};
}

function labelOffsetForPoint(point,geometry){
  const px=w2px(point.x), py=w2py(point.y);
  let best={dist:Infinity, normal:null};
  geometry?.lines?.forEach(line=>{
    const candidate=screenLineDistance(px,py,line);
    if(candidate.dist<best.dist) best=candidate;
  });
  geometry?.segments?.forEach(seg=>{
    const candidate=screenSegmentDistance(px,py,seg.a,seg.b);
    if(candidate.dist<best.dist) best=candidate;
  });
  geometry?.vectors?.forEach(vec=>{
    const candidate=screenSegmentDistance(px,py,vec.from,vec.to);
    if(candidate.dist<best.dist) best=candidate;
  });
  if(best.normal&&best.dist<14) return [best.normal[0]*20,best.normal[1]*20];
  return [8,-18];
}

function segmentNormalOffset(x0,y0,x1,y1,distance=16){
  const dx=x1-x0, dy=y1-y0;
  const len=Math.hypot(dx,dy)||1;
  let nx=-dy/len, ny=dx/len;
  if(ny>0){ nx=-nx; ny=-ny; }
  return [nx*distance,ny*distance];
}

function drawGeometryPoint(point,color,geometry,eq){
  const px=w2px(point.x), py=w2py(point.y);
  if(px<-14||px>W+14||py<-14||py>H+14) return;
  marker(px,py,color,'ext');
  if(eq.showGeoLabels!==false){
    drawWorldLabel(point.label,point.x,point.y,color,{offsetPx:labelOffsetForPoint(point,geometry)});
  }
}

function drawGeometrySegment(seg,color,showLength=false,index=0,eq){
  const ax=w2px(seg.a.x), ay=w2py(seg.a.y);
  const bx=w2px(seg.b.x), by=w2py(seg.b.y);
  ctx.save();
  ctx.lineWidth=1.4;
  ctx.strokeStyle=color;
  ctx.globalAlpha=seg.opacity ?? (seg.style ? 0.55 : 0.82);
  setDash(seg.style);
  ctx.beginPath();
  ctx.moveTo(ax,ay);
  ctx.lineTo(bx,by);
  ctx.stroke();
  ctx.restore();
  const showMeasure = showLength && eq.showGeoSideLengths !== false;
  const showName = !!(seg.showLabel && eq.showGeoLabels !== false && seg.label);
  const label = showMeasure ? segmentMeasureText(seg,index) : (showName ? seg.label : '');
  if(label){
    const dx=bx-ax, dy=by-ay;
    const len=Math.hypot(dx,dy)||1;
    let nx=-dy/len, ny=dx/len;
    if(ny>0){ nx=-nx; ny=-ny; }
    drawWorldLabel(label,(seg.a.x+seg.b.x)/2,(seg.a.y+seg.b.y)/2,color,{offsetPx:[nx*16,ny*16],center:true});
  }
}

function drawXAxisAngleArc(vx, vy, angleRad, color, isVector=false, showLabel=true) {
  let deg = angleRad * 180 / Math.PI;
  if (isVector) {
    if (deg < 0) deg += 360;
  } else {
    if (deg < 0) deg += 180;
    if (deg >= 180) deg -= 180;
  }

  const radius = 40;
  const dashedLineLength = 55;

  ctx.save();
  ctx.strokeStyle = color;
  ctx.lineWidth = 1;
  ctx.setLineDash([3, 3]);
  ctx.beginPath();
  ctx.moveTo(vx, vy);
  ctx.lineTo(vx + dashedLineLength, vy);
  ctx.stroke();
  ctx.restore();

  if (Math.abs(angleRad) > 1e-9 && (!isVector || Math.abs(deg - 360) > 1e-9)) {
    const screenAngle = -angleRad;
    const ccw = screenAngle < 0;

    // 1. Draw transparent fill (sector)
    ctx.save();
    ctx.fillStyle = color;
    ctx.globalAlpha = 0.16;
    ctx.beginPath();
    ctx.moveTo(vx, vy);
    ctx.arc(vx, vy, radius, 0, screenAngle, ccw);
    ctx.closePath();
    ctx.fill();
    ctx.restore();

    // 3. Draw label text directly without background outside the arc with offset
    if(showLabel){
      ctx.save();
      ctx.font = '10.5px ' + getCss('--mono');
      ctx.fillStyle = color;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      const midAngle = screenAngle / 2.6;
      const labelRadius = radius + 28;
      const lx = vx + Math.cos(midAngle) * labelRadius;
      const ly = vy + Math.sin(midAngle) * labelRadius;
      ctx.fillText(fmt(deg) + '°', lx, ly);
      ctx.restore();
    }
  } else {
    if(showLabel){
      ctx.save();
      ctx.font = '10.5px ' + getCss('--mono');
      ctx.fillStyle = color;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'bottom';
      ctx.fillText('0°', vx, vy - 8);
      ctx.restore();
    }
  }
}

function drawGeometryLine(line,color,eq){
  const xmin=px2wx(0), xmax=px2wx(W), ymin=py2wy(H), ymax=py2wy(0);
  let p1,p2;
  if(Math.abs(line.b)>Math.abs(line.a)){
    p1={x:xmin,y:(-line.a*xmin-line.c)/line.b};
    p2={x:xmax,y:(-line.a*xmax-line.c)/line.b};
  } else if(Math.abs(line.a)>1e-12){
    p1={x:(-line.b*ymin-line.c)/line.a,y:ymin};
    p2={x:(-line.b*ymax-line.c)/line.a,y:ymax};
  } else {
    return;
  }
  ctx.save();
  ctx.lineWidth=line.style ? 1.25 : eq.lw;
  ctx.strokeStyle=color;
  ctx.globalAlpha=line.style ? 0.58 : 0.9;
  setDash(line.style || eq.style);
  ctx.beginPath();
  ctx.moveTo(w2px(p1.x),w2py(p1.y));
  ctx.lineTo(w2px(p2.x),w2py(p2.y));
  ctx.stroke();
  ctx.restore();

  if(eq && eq.showGeoXAxisAngles){
    let drawPt = null;
    if(Math.abs(line.a) > 1e-12){
      const xi = -line.c / line.a;
      if(xi >= xmin && xi <= xmax && ymin <= 0 && ymax >= 0){
        drawPt = {x: xi, y: 0};
      }
    }
    if(!drawPt){
      drawPt = {x: (p1.x + p2.x) / 2, y: (p1.y + p2.y) / 2};
    }

    const vx = w2px(drawPt.x);
    const vy = w2py(drawPt.y);

    let angleRad = Math.atan2(-line.a, line.b);
    if(angleRad < 0) angleRad += Math.PI;

    drawXAxisAngleArc(vx, vy, angleRad, color, false, eq.showGeoXAxisAngles);
  }
}

function drawArrowHead(fromPx,fromPy,toPx,toPy,color){
  const dx=toPx-fromPx, dy=toPy-fromPy;
  const len=Math.hypot(dx,dy);
  if(len<8) return;
  const ux=dx/len, uy=dy/len;
  const size=8;
  ctx.save();
  ctx.fillStyle=color;
  ctx.beginPath();
  ctx.moveTo(toPx,toPy);
  ctx.lineTo(toPx-ux*size-uy*size*0.55,toPy-uy*size+ux*size*0.55);
  ctx.lineTo(toPx-ux*size+uy*size*0.55,toPy-uy*size-ux*size*0.55);
  ctx.closePath();
  ctx.fill();
  ctx.restore();
}

function drawGeometryVector(vec,color,showLength=false,index=0,showXAxisAngle=false,eq){
  const x0=w2px(vec.from.x), y0=w2py(vec.from.y);
  const x1=w2px(vec.to.x), y1=w2py(vec.to.y);
  ctx.save();
  ctx.lineWidth=2;
  ctx.strokeStyle=color;
  ctx.globalAlpha=0.9;
  ctx.lineCap='round';
  ctx.beginPath();
  ctx.moveTo(x0,y0);
  ctx.lineTo(x1,y1);
  ctx.stroke();
  ctx.restore();
  drawArrowHead(x0,y0,x1,y1,color);
  const midX=(vec.from.x+vec.to.x)/2;
  const midY=(vec.from.y+vec.to.y)/2;
  if(eq.showGeoLabels!==false){
    drawWorldLabel(vec.label,midX,midY,color,{offsetPx:segmentNormalOffset(x0,y0,x1,y1,16),center:true});
  }
  if(showLength){
    drawWorldLabel(vectorMeasureText(vec,index),midX,midY,color,{offsetPx:segmentNormalOffset(x0,y0,x1,y1,34),center:true});
  }
  if(showXAxisAngle){
    const dx = vec.to.x - vec.from.x;
    const dy = vec.to.y - vec.from.y;
    const len = Math.hypot(dx, dy);
    if(len > 1e-9){
      const angleRad = Math.atan2(dy, dx);
      drawXAxisAngleArc(x0, y0, angleRad, color, true, showXAxisAngle && eq.showGeoXAxisAngles);
    }
  }
}

function normalizedAngleDelta(delta){
  while(delta<=-Math.PI) delta+=Math.PI*2;
  while(delta>Math.PI) delta-=Math.PI*2;
  return delta;
}

function drawAngleSector(vx,vy,radius,start,delta,color,alpha){
  const end=start+delta;
  const clockwise=delta>=0;
  ctx.save();
  ctx.fillStyle=color;
  ctx.globalAlpha=alpha;
  ctx.beginPath();
  ctx.moveTo(vx,vy);
  ctx.arc(vx,vy,radius,start,end,!clockwise);
  ctx.closePath();
  ctx.fill();
  ctx.restore();
}

function drawGeometryAngle(eq,angle,color){
  if(!angle?.vertex||!angle?.a||!angle?.b) return;
  const showInternal = eq.showGeoAngles!==false;
  const showExternal = !!eq.showGeoAnglesExternal;
  const showComplement = !!eq.showGeoAnglesComplement;

  const vx=w2px(angle.vertex.x), vy=w2py(angle.vertex.y);
  const ax=w2px(angle.a.x), ay=w2py(angle.a.y);
  const bx=w2px(angle.b.x), by=w2py(angle.b.y);
  const lenA=Math.hypot(ax-vx,ay-vy), lenB=Math.hypot(bx-vx,by-vy);
  if(lenA<8||lenB<8) return;

  const start=Math.atan2(ay-vy,ax-vx);
  const endAngle=Math.atan2(by-vy,bx-vx);

  let delta=normalizedAngleDelta(endAngle-start);
  if(Number.isFinite(angle.rad)&&angle.rad>Math.PI+1e-5){
    delta=delta>=0 ? delta-Math.PI*2 : delta+Math.PI*2;
  }

  const radius=Math.max(18,Math.min(48,lenA*.32,lenB*.32));

  // External label + sector (opposite of internal start)
  let externalLabelData=null;
  if(showExternal && Number.isFinite(angle.externalRad)&&angle.externalRad>1e-5){
    const externalStart=start+Math.PI;
    const externalDelta=normalizedAngleDelta(endAngle-externalStart);
    drawAngleSector(vx,vy,radius,externalStart,externalDelta,color,0.075);
    const externalMid=externalStart+externalDelta/2;
    const externalDeg=Number.isFinite(angle.externalDeg) ? angle.externalDeg : Math.abs(externalDelta)*180/Math.PI;
    const externalLabel='ext '+fmt(externalDeg)+'°';
    const ex=vx+Math.cos(externalMid)*(radius+12);
    const ey=vy+Math.sin(externalMid)*(radius+12);
    externalLabelData={label:externalLabel,x:px2wx(ex),y:py2wy(ey)};
  }

  // Reflex angle: 360° − internal (computed from internal rad)
  let complementLabelData=null;
  if(showComplement && Number.isFinite(angle.rad)){
    const reflexRad=2*Math.PI-angle.rad;
    if(reflexRad>1e-5){
      // Force the “other side” (long way around) by flipping the direction.
      // Internal is drawn with delta; reflex must go the opposite direction
      // while spanning the remaining angle up to 360°.
      const reflexDelta=(delta>=0 ? -reflexRad : reflexRad);
      drawAngleSector(vx,vy,radius,start,start+reflexDelta - start,color,0.10);
      const compMid=start+reflexDelta/2;
      const compDeg=reflexRad*180/Math.PI;
      complementLabelData={label:'reflex '+fmt(compDeg)+'°',x:px2wx(vx+Math.cos(compMid)*(radius+12)),y:py2wy(vy+Math.sin(compMid)*(radius+12))};
    }
  }

  if(showInternal){
    drawAngleSector(vx,vy,radius,start,delta,color,0.18);
    if(eq.showGeoAngles!==false){
      const mid=start+delta/2;
      const label=Number.isFinite(angle.deg) ? fmt(angle.deg)+'°' : (angle.label || 'θ');
      const lx=vx+Math.cos(mid)*(radius+12);
      const ly=vy+Math.sin(mid)*(radius+12);
      drawWorldLabel(label,px2wx(lx),py2wy(ly),color,{offsetPx:[0,0]});
    }
  }

  if(showExternal){
    drawAngleSector(vx,vy,radius,externalStart,externalDelta,color,0.075);
    if(eq.showGeoAnglesExternal && externalLabelData){
      drawWorldLabel(externalLabelData.label,externalLabelData.x,externalLabelData.y,color,{offsetPx:[0,0]});
    }
  }

  if(showComplement && Number.isFinite(angle.rad) && reflexRad > 1e-5){
    drawAngleSector(vx,vy,radius,start,start+reflexDelta - start,color,0.10);
    if(eq.showGeoAnglesComplement && complementLabelData){
      drawWorldLabel(complementLabelData.label,complementLabelData.x,complementLabelData.y,color,{offsetPx:[0,0]});
    }
  }
}

function drawGeometryPolygon(poly,color,showCaption=true,eq){
  if(!poly.points?.length) return;
  ctx.save();
  ctx.globalAlpha=0.14;
  ctx.fillStyle=color;
  ctx.beginPath();
  poly.points.forEach((p,i)=>{
    const px=w2px(p.x), py=w2py(p.y);
    if(i===0) ctx.moveTo(px,py); else ctx.lineTo(px,py);
  });
  ctx.closePath();
  ctx.fill();
  ctx.globalAlpha=0.7;
  ctx.lineWidth=1.4;
  ctx.strokeStyle=color;
  ctx.setLineDash([4,3]);
  ctx.stroke();
  ctx.restore();
  if(showCaption && poly.caption && eq.showGeoLabels!==false){
    const center=poly.points.reduce((acc,p)=>({x:acc.x+p.x,y:acc.y+p.y}),{x:0,y:0});
    center.x/=poly.points.length;
    center.y/=poly.points.length;
    drawWorldLabel(poly.caption,center.x,center.y,color,{offsetPx:[0,0],center:true});
  }
}

function drawGeometry(eq){
  if(!eq.visible||!eq.geometry||eq.geometry.dim===3) return;
  const g=eq.transformScene || eq.geometry;
  const color=eqColor(eq);
  g.polygons?.forEach(poly=>drawGeometryPolygon(poly,color,eq.showGeoTriangleClass!==false,eq));
  g.conics?.forEach(conic=>{
    if(!conic.implicitF) return;
    ctx.save();
    curveStyle(eq);
    traceImplicit(conic.implicitF,6);
    ctx.restore();
  });
  g.lines?.forEach(line=>drawGeometryLine(line,color,eq));
  g.segments?.forEach((seg,index)=>drawGeometrySegment(seg,color,eq.showGeoSideLengths,index,eq));
  g.vectors?.forEach((vec,index)=>drawGeometryVector(vec,color,eq.showGeoVectorLengths,index,eq.showGeoXAxisAngles,eq));
  if(g.angles?.length) g.angles?.forEach(angle=>drawGeometryAngle(eq,angle,color));
  if(g.type!=='vector') g.points?.forEach(point=>drawGeometryPoint(point,color,g,eq));
  const rotation=g.conics?.[0]?.analysis?.rotationDemo;
  if(rotation&&Number.isFinite(eq.conicDemoProgress)){
    const theta=rotation.angle*Math.PI/180*Math.max(0,Math.min(1,eq.conicDemoProgress));
    const center=rotation.center,extent=Math.max(10,Math.hypot(W,H)/Math.max(view.scale,.02));
    ctx.save();
    ctx.strokeStyle='#12bfa5';ctx.lineWidth=2.2;ctx.setLineDash([7,5]);
    for(let i=0;i<2;i++){
      const angle=theta+i*Math.PI/2,ux=Math.cos(angle),uy=Math.sin(angle);
      ctx.beginPath();
      ctx.moveTo(w2px(center[0]-ux*extent),w2py(center[1]-uy*extent));
      ctx.lineTo(w2px(center[0]+ux*extent),w2py(center[1]+uy*extent));
      ctx.stroke();
    }
    ctx.restore();
  }
}

function drawRegression(eq){
  if(!eq.visible) return;
  if(eq.fn){
    const dash = eq.style==='dashed'?[7,5] : eq.style==='dotted'?[1,4] : null;
    plotPath(eq.fn, {color:eqColor(eq), width:eq.lw, dash});
  }
  drawDataPoints(eq);
}

function drawPoints(eq){
  if(!eq.visible) return;
  drawDataPoints(eq);
}

export function computeHistogramBins(data, targetBins=12, exact=false){
  if(!data.length) return [];
  const n = exact
    ? Math.max(1, Math.min(50, Math.round(targetBins)))
    : Math.max(4, Math.min(targetBins, Math.ceil(Math.sqrt(data.length))));
  const lo=Math.min(...data), hi=Math.max(...data);
  if(Math.abs(hi-lo)<1e-12) return [{min:lo, max:hi, center:lo, count:data.length}];
  const step=(hi-lo)/n;
  const bins=Array.from({length:n}, (_,i)=>({
    min: lo+i*step, max: lo+(i+1)*step, count:0
  }));
  for(const v of data){
    let idx=Math.floor((v-lo)/step);
    if(idx>=n) idx=n-1; else if(idx<0) idx=0;
    bins[idx].count++;
  }
  return bins.map(b=>({...b, center: (b.min+b.max)/2}));
}

function visibleXRange(){
  if(!Number.isFinite(W)||W<=0){
    const half=10;
    return [view.cx-half, view.cx+half];
  }
  return [px2wx(0), px2wx(W)];
}

function bisect(fn, a, b, tol=1e-8){
  let fa=fn(a), fb=fn(b);
  if(!Number.isFinite(fa)) fa=fn(a+1e-12);
  if(!Number.isFinite(fb)) fb=fn(b-1e-12);
  if(!Number.isFinite(fa)||!Number.isFinite(fb)||fa*fb>0) return null;
  for(let i=0;i<80;i++){
    const m=(a+b)/2; const fm=fn(m);
    if(!Number.isFinite(fm)||Math.abs(fm)<tol) return m;
    if(fa*fm<0){ b=m; fb=fm; }
    else { a=m; fa=fm; }
    if(b-a<tol) return (a+b)/2;
  }
  return (a+b)/2;
}

function pushUniquePoint(out, point, minDx){
  if(!Number.isFinite(point.x)||!Number.isFinite(point.y)) return;
  const tol=Math.max(minDx*2, 1e-5);
  if(out.some(p=>Math.abs(p.x-point.x)<=tol && Math.abs(p.y-point.y)<=tol)) return;
  out.push(point);
}

function computeIntersections(fnA, fnB, xmin, xmax, N=4000, tol=1e-6){
  if(!Number.isFinite(xmin)||!Number.isFinite(xmax)||xmin>=xmax) return [];
  const dx=(xmax-xmin)/N;
  const out=[];
  const diff=x=>fnA(x)-fnB(x);
  let prevX=xmin, prevD=diff(xmin);
  for(let i=1;i<=N;i++){
    const x=xmin+i*dx;
    const d=diff(x);
    if(!Number.isFinite(d)){
      prevX=x; prevD=d; continue;
    }
    if(Number.isFinite(prevD) && Math.abs(prevD)<tol){
      pushUniquePoint(out, {x:prevX, y:fnA(prevX)}, dx);
    }
    if(Number.isFinite(prevD) && prevD*d<0){
      const r=bisect(diff, prevX, x, tol);
      if(r!==null) pushUniquePoint(out, {x:r, y:fnA(r)}, dx);
    }
    else if(Math.abs(d)<tol){
      pushUniquePoint(out, {x, y:fnA(x)}, dx);
    }
    prevX=x; prevD=d;
  }
  return out;
}

function drawNormalOverlay(mean, sd, scale, color){
  if(!(sd>0)) return;
  ctx.save();
  ctx.strokeStyle=color; ctx.lineWidth=2; ctx.globalAlpha=0.9;
  ctx.beginPath();
  const k=1/(sd*Math.sqrt(2*Math.PI));
  let started=false;
  for(let px=0;px<=W;px+=2){
    const x=px2wx(px);
    const y=k*Math.exp(-((x-mean)*(x-mean))/(2*sd*sd))*scale;
    const py=w2py(y);
    if(!started){ ctx.moveTo(px,py); started=true; } else ctx.lineTo(px,py);
  }
  ctx.stroke();
  ctx.restore();
}

function drawHistogram(eq){
  if(!eq.visible || !Array.isArray(eq.points)) return;
  updateDynamicHistogram(eq);
  const pts=eq.points;
  if(!pts.length) return;
  const xVals=pts.map(p=>p.x), yVals=pts.map(p=>p.y);
  const xLo=Math.min(...xVals), xHi=Math.max(...xVals);
  const yMax=Math.max(...yVals);
  if(!Number.isFinite(xLo)||!Number.isFinite(xHi)||!Number.isFinite(yMax)||yMax<=0) return;
  const color=eqColor(eq);
  ctx.save();
  ctx.fillStyle=color;
  ctx.strokeStyle=color;
  ctx.globalAlpha=0.85;
  for(const p of pts){
    const fallbackWidth=Math.max((xHi-xLo)/Math.max(pts.length,1), 0.8);
    let min=Number.isFinite(p.min) ? p.min : p.x-fallbackWidth*0.45;
    let max=Number.isFinite(p.max) ? p.max : p.x+fallbackWidth*0.45;
    if(!Number.isFinite(min)||!Number.isFinite(max)||max<=min){
      min=p.x-fallbackWidth*0.45;
      max=p.x+fallbackWidth*0.45;
    }
    const px=w2px(min), py=w2py(p.y);
    const pw=Math.max(w2px(max)-px, 2);
    const basePy=w2py(0);
    const topPy=py;
    const barH=Math.max(basePy-topPy, 1);
    ctx.fillRect(px, topPy, pw, barH);
  }
  if(eq.histNormal && typeof eq.histSource==='function'){
    const nums=eq.histSource();
    if(Array.isArray(nums) && nums.length>1){
      const d=describe(nums, {population:true});
      const bw=(Number.isFinite(pts[0].max)&&Number.isFinite(pts[0].min))
        ? (pts[0].max-pts[0].min)
        : (xHi-xLo)/Math.max(pts.length,1);
      const scale=eq.histDensity ? bw : nums.length*bw;
      if(d) drawNormalOverlay(d.mean, d.sd, scale, color);
    }
  }
  ctx.restore();
}

function drawInequality(eq){
  const below = eq.ineqOp==='<'||eq.ineqOp==='<=';
  const edge = below ? H : 0;   // viewport bottom / top in pixels
  ctx.save();
  ctx.globalAlpha=0.15;
  ctx.fillStyle=eqColor(eq);
  let pts=[];
  const flush=()=>{
    if(pts.length>=2){
      ctx.beginPath();
      ctx.moveTo(pts[0].px, edge);
      for(const p of pts) ctx.lineTo(p.px, p.py);
      ctx.lineTo(pts[pts.length-1].px, edge);
      ctx.closePath();
      ctx.fill();
    }
    pts=[];
  };
  for(let px=0;px<=W;px++){
    const y=safeEval(eq.fn, px2wx(px));
    if(!Number.isFinite(y)){ flush(); continue; }
    const py=Math.max(-H, Math.min(2*H, w2py(y)));
    pts.push({px,py});
  }
  flush();
  ctx.restore();
}

function drawCurve(eq){
  if(!eq.visible||!eq.fn) return;
  if(eq.kind==='inequality') drawInequality(eq);
  if(eq.showR) drawRiemann(eq);
  const strict = eq.ineqOp==='<'||eq.ineqOp==='>';
  const dash = eq.kind==='inequality'&&strict ? [6,4]
             : eq.style==='dashed'?[7,5] : eq.style==='dotted'?[1,4] : null;
  plotPath(eq.fn, {color:eqColor(eq), width:eq.lw, dash});
  if(eq.showD) plotPath(x=>safeEval(eqDerivFn(eq),x), {color:eqColor(eq), width:1.7, dash:[7,5], alpha:0.85});
  if(eq.showD2) plotPath(x=>safeEval(eqDeriv2Fn(eq),x), {color:eqColor(eq), width:1.4, dash:[2,4], alpha:0.7});
  if(eq.showI){ drawDefiniteArea(eq); plotIntegral(eq); }
  if(eq.showD){
    const y=safeEval(eq.fn,eq.dx);
    const slope=safeEval(eqDerivFn(eq),eq.dx);
    if(Number.isFinite(y)){
      drawTangent(eq,eq.dx,y,slope);
      if(eq.showNormal) drawNormal(eq,eq.dx,y,slope);
      marker(w2px(eq.dx),w2py(y),eqColor(eq),'ext');
    }
  }
  if(eq.showL) drawLimitPoint(eq);
}

function drawNormal(eq,wx,wy,slope){
  if(!Number.isFinite(wy)||!Number.isFinite(slope)) return;
  // Screen tangent direction is (1,-slope); the normal is perpendicular: (slope,1).
  const len=Math.hypot(slope,1);
  const ux=slope/len, uy=1/len;
  const L=Math.max(45, Math.min(W*0.12, 140));
  const cx=w2px(wx), cy=w2py(wy);
  ctx.save();
  ctx.globalAlpha=0.78; ctx.lineWidth=1.5; ctx.strokeStyle=eqColor(eq);
  ctx.setLineDash([4,3]);
  ctx.beginPath();
  ctx.moveTo(cx-ux*L, cy-uy*L);
  ctx.lineTo(cx+ux*L, cy+uy*L);
  ctx.stroke();
  ctx.restore();
}

function drawLimitPoint(eq){
  if(eq.lInf){
    const lim=limitAtInfinity(eq.fn, eq.lInf==='+'?1:-1);
    if(lim.exists && Number.isFinite(lim.value)){
      const py=w2py(lim.value);
      if(py>=-20 && py<=H+20){
        ctx.save();
        ctx.setLineDash([2,5]); ctx.lineWidth=1.3; ctx.globalAlpha=0.65;
        ctx.strokeStyle=eqColor(eq);
        ctx.beginPath(); ctx.moveTo(0,py); ctx.lineTo(W,py); ctx.stroke();
        ctx.restore();
      }
    }
    return;
  }
  const px=w2px(eq.lx);
  if(px>=0 && px<=W){
    ctx.save();
    ctx.setLineDash([2,4]); ctx.lineWidth=1; ctx.globalAlpha=0.5;
    ctx.strokeStyle=getCss('--faint');
    ctx.beginPath(); ctx.moveTo(px,0); ctx.lineTo(px,H); ctx.stroke();
    ctx.restore();
  }
  drawLimitMarker(eq, eq.lx, limitAt(eq.fn, eq.lx));
}

function drawTrace(){
  if(!mouse.inside){ readout.style.display='none'; return; }
  const wx=px2wx(mouse.px);
  equations.forEach(eq=>{
    if(eq.visible&&eq.fn&&eq.showI) drawIntegralArea(eq,wx);
  });
  ctx.save();
  ctx.setLineDash([3,4]); ctx.lineWidth=1; ctx.strokeStyle=getCss('--faint');
  const gx=Math.round(mouse.px)+.5;
  ctx.beginPath(); ctx.moveTo(gx,0); ctx.lineTo(gx,H); ctx.stroke();
  ctx.restore();

  let html='<span class="coord">x = '+fmt(wx)+'&nbsp; y = '+fmt(py2wy(mouse.py))+'</span>';
  equations.forEach(eq=>{
    if(!eq.visible||!eq.fn) return;
    const wy=safeEval(eq.fn,wx);
    const d=eq.showD ? safeEval(eqDerivFn(eq),wx) : NaN;
    const lim=eq.showL ? limitAt(eq.fn,wx) : null;
    if(eq.showD) drawTangent(eq,wx,wy,d);
    if(eq.showL) drawLimitMarker(eq,wx,lim);
    if(Number.isFinite(wy)){
      const py=w2py(wy);
      if(py>=-20&&py<=H+20){
        ctx.beginPath(); ctx.fillStyle=eqColor(eq);
        ctx.arc(mouse.px,py,3.5,0,Math.PI*2); ctx.fill();
        ctx.lineWidth=1.5; ctx.strokeStyle=getCss('--bg'); ctx.stroke();
      }
      html+='<div class="fx"><span class="dot" style="background:'+eqColor(eq)+'"></span>f = '+fmt(wy)+'</div>';
    }
    if(eq.showD){
      if(Number.isFinite(d)) html+='<div class="fx"><span class="dot" style="background:'+eqColor(eq)+';opacity:.55"></span>f\u2032 = '+fmt(d)+'</div>';
    }
    if(eq.showI){
      const F=integralAt(eq.fn,wx);
      if(Number.isFinite(F)) html+='<div class="fx"><span class="dot" style="background:'+eqColor(eq)+';opacity:.3"></span>\u222bf = '+fmt(F)+'</div>';
    }
    if(eq.showL&&lim){
      const value=lim.exists ? fmtLimitNumber(lim.value) : 'esq '+(lim.left?.exists?fmtLimitNumber(lim.left.value):'—')+', dir '+(lim.right?.exists?fmtLimitNumber(lim.right.value):'—');
      html+='<div class="fx"><span class="dot" style="background:'+eqColor(eq)+';opacity:.75"></span>lim = '+value+'</div>';
    }
  });
  readout.innerHTML=html;
  readout.style.display='block';
}

function syncUserFunctions(){
  const map={};
  for(const eq of equations){ if(eq.defName && eq.fn) map[eq.defName]=eq.fn; }
  setUserFunctions(map);
}

function syncViewMode(){
  const now=has3dObjects(equations);
  let mode=view3d.mode;
  const first=has3dSeen===null;
  if(first){ if(!view3d.savedMode) mode=now?'3d':'2d'; }
  else mode=decideViewMode({previousHas3d:has3dSeen,nowHas3d:now,current:mode});
  has3dSeen=now;
  const changed=mode!==view3d.mode;
  view3d.mode=mode;
  updateView3dUi(now);
  if(changed||first) viewModeChanged();
}

// Annotations live in 2D world coordinates: leave that mode when entering 3D.
function viewModeChanged(){
  if(view3d.mode==='3d'&&annotationMode) toggleAnnotationMode();
  cv.title=view3d.mode==='3d' ? CAMERA_HINT : '';
  setCanvasCursor();
  resultRefreshers.forEach(refresh=>refresh());
}

let view3dUiSignature='';
function updateView3dUi(has3d){
  const on=view3d.mode==='3d';
  const range=activeAxisRange();
  const signature=[on,has3d,view3d.camera.projection,view3d.grid,view3d.axisTickStep,view3d.autoAxisRange,view3d.axisRange,range].join();
  if(signature===view3dUiSignature) return;
  view3dUiSignature=signature;
  document.body.dataset.view=on?'3d':'2d';
  const toggle=document.getElementById('view-mode');
  if(toggle){
    // The 3D view is useful even for 2D geometry promoted into the XY plane.
    // Never strand users in 2D after loading a purely 2D preset.
    toggle.hidden=false;
    toggle.dataset.mode=on?'3d':'2d';
    toggle.setAttribute('aria-pressed',on?'true':'false');
    toggle.title=on?'Voltar para a vista 2D':'Abrir a vista 3D';
  }
  document.body.dataset.viewToggle=toggle&&!toggle.hidden?'1':'0';
  const controls=document.getElementById('view3d-controls');
  if(controls) controls.hidden=!on;
  const rangeInput=document.getElementById('view-axis-range');
  if(rangeInput){
    rangeInput.value=String(view3d.autoAxisRange ? range : view3d.axisRange);
    rangeInput.disabled=view3d.autoAxisRange;
  }
  const autoInput=document.getElementById('view-axis-auto');
  if(autoInput) autoInput.checked=view3d.autoAxisRange;
  const tickStepSelect=document.getElementById('view-axis-ticks');
  if(tickStepSelect) tickStepSelect.value=view3d.axisTickStep;
  const proj=document.getElementById('view-proj');
  if(proj){
    const persp=view3d.camera.projection==='perspective';
    proj.textContent=persp?'persp':'orto';
    proj.title=persp?'Projeção em perspectiva (alternar para ortográfica)':'Projeção ortográfica (alternar para perspectiva)';
  }
  const gridBtn=document.getElementById('grid-mode');
  if(gridBtn){
    if(on){
      gridBtn.dataset.on=view3d.grid?'1':'0';
      gridBtn.title=view3d.grid?'Ocultar grade 3D':'Mostrar grade 3D';
      gridBtn.setAttribute('aria-label',gridBtn.title);
    }else updateGridModeButton();
  }
}

function setViewMode(mode){
  view3d.mode=mode==='3d'?'3d':'2d';
  updateView3dUi(has3dObjects(equations));
  viewModeChanged();
  draw(); scheduleSave();
}

function render3d(){
  const range=activeAxisRange();
  if(range!==view3dFitAxisRange) fitCameraToViewport();
  const colors=colorsFromTheme(getCss);
  
  // Show library selector when in 3D mode
  show3DLibrarySelector();
  
  const box=axisBox(range);
  const primitives=[...axesPrimitives(box,{grid:view3d.grid,axisTickStep:view3d.axisTickStep}),...scenePrimitives(equations,{colorOf:eqColor,box})];

  if(getActive3DLibrary()==='plotly'||getActive3DLibrary()==='threejs'){
    // Render with Plotly.js or Three.js (WebGL)
    render3DScene(primitives, {
      theme,
      colors,
      range,
      box,
      grid:view3d.grid,
      surfaceLines:threeSurfaceLines,
      camera:view3d.camera
    });
  } else {
    // Render with native Curva 3D
    ctx.save();
    ctx.fillStyle=colors.bg;
    ctx.fillRect(0,0,W,H);
    ctx.restore();
    drawScene3d(ctx,buildDrawList(primitives,view3d.camera,{width:W,height:H},{systemPlaneBox:box}),colors);
  }
  
  readout.style.display='none';
  const card=document.getElementById('analysis');
  if(card) card.style.display='none';
  valueTable.update();
  if(canvasDescription) canvasDescription.textContent=describeCanvas({view3d,width:W,height:H,equations});
  if(sectionLinkedWorld)setSectionLinkedWorld(sectionLinkedWorld);
}

function render(){
  syncUserFunctions();
  syncViewMode();
  if(syncSectionLayout())return;
  ctx.clearRect(0,0,W,H);
  if(view3d.mode==='3d'){ render3d(); return; }
  
  // Hide library selector when not in 3D mode
  hide3DLibrarySelector();
  
  drawGrid();
  equations.forEach(eq=>{
    if(eq.kind==='parametric') drawParametric(eq);
    else if(eq.kind==='polar') drawPolar(eq);
    else if(eq.kind==='regression') drawRegression(eq);
    else if(eq.kind==='points') drawPoints(eq);
    else if(eq.kind==='histogram') drawHistogram(eq);
    else if(eq.kind==='implicit') drawImplicit(eq);
    else if(eq.kind==='implicit-ineq') drawImplicitRegion(eq);
    else if(eq.kind==='geometry') drawGeometry(eq);
    else if(eq.kind==='result'){const scene=eq.transformScene||(eq.showAlgebraSystem?eq.systemScene:null);if(scene) drawGeometry({...eq,geometry:scene});}
    else drawCurve(eq);
  });
  // The window analysis (domain/extrema/asymptotes + canvas markers) is the
  // heaviest pass; skip it mid-drag and restore it once the gesture settles.
  if(!dragging) drawAnalysis();
  drawGeoBuilderOverlay();
  drawTrace();
  drawAnnotations();
  valueTable.update();
  if(canvasDescription){
    canvasDescription.textContent=describeCanvas({gridMode,view,width:W,height:H,equations});
  }
}

// Coalesce the many interactive draw() calls (pointermove can fire well above
// 60Hz) into one render per animation frame.
let drawScheduled=false;
function draw(){
  if(drawScheduled) return;
  drawScheduled=true;
  requestAnimationFrame(()=>{ drawScheduled=false; render(); });
}

// getComputedStyle is comparatively expensive and runs many times per frame
// (grid, axes, markers). The CSS custom properties only change with the theme,
// so cache resolved values and clear on theme switch.
let cssCache=Object.create(null);
function getCss(v){
  const hit=cssCache[v];
  if(hit!==undefined) return hit;
  return (cssCache[v]=getComputedStyle(document.body).getPropertyValue(v).trim());
}
function invalidateCssCache(){ cssCache=Object.create(null); }

let dragging=false, pointerIntent=null, last={x:0,y:0};
function updateMouseFromEvent(e){
  const r=cv.getBoundingClientRect();
  mouse.inside=true;
  mouse.px=e.clientX-r.left;
  mouse.py=e.clientY-r.top;
}
cv.addEventListener('pointerdown',e=>{
  if(view3d.mode==='3d') return;
  updateMouseFromEvent(e);
  last={x:e.clientX,y:e.clientY};
  const hit=hitGeometryPoint(mouse.px,mouse.py);
  if(hit){
    pointerIntent={type:'geo-hit',label:hit.label,draggable:hit.draggable,dragging:false,lastWorld:null};
    cv.setPointerCapture(e.pointerId);
    return;
  }
  if(geoTool==='point'){
    pointerIntent='geo-point';
    cv.setPointerCapture(e.pointerId);
    return;
  }
  if(annotationMode){
    e.preventDefault();
    if(annotationDrag?.finish){
      annotationDrag.finish(); annotationDrag=null; return;
    }
    if(annotationDrag) return;
    for(const a of annotations){
      if(a._box && mouse.px>=a._box.x && mouse.px<=a._box.x+a._box.w && mouse.py>=a._box.y && mouse.py<=a._box.y+a._box.h){
        if(a.id===annotationHoverId && a._colorBtn){
          const dx=mouse.px-a._colorBtn.x, dy=mouse.py-a._colorBtn.y;
          if(dx*dx+dy*dy <= (a._colorBtn.r+2)*(a._colorBtn.r+2)){
            openAnnotationColorEditor(a); return;
          }
        }
        if(a.id===annotationHoverId && a._hitX && Math.hypot(a._hitX.x-mouse.px, a._hitX.y-mouse.py)<=8){
          annotations=annotations.filter(x=>x.id!==a.id);
          annotationHoverId=null;
          draw(); scheduleSave();
          return;
        }
        annotationDragStart={id:a.id, startPx:mouse.px, startPy:mouse.py, startX:a.x, startY:a.y};
        cv.setPointerCapture(e.pointerId);
        return;
      }
    }
    pointerIntent='annotation';
    startAnnotationInput(mouse.px, mouse.py);
    cv.setPointerCapture(e.pointerId);
    return;
  }
  pointerIntent='pan';
  dragging=true;
  cv.setPointerCapture(e.pointerId); cv.style.cursor='grabbing';
});
cv.addEventListener('pointermove',e=>{
  if(view3d.mode==='3d') return;
  updateMouseFromEvent(e);
  const moved=Math.hypot(e.clientX-last.x,e.clientY-last.y);
  if(pointerIntent?.type==='geo-hit'&&pointerIntent.draggable&&moved>=6){
    if(!pointerIntent.dragging) selectGeoPoint(pointerIntent.label,true);
    pointerIntent.dragging=true;
    cv.style.cursor='move';
    const point=pointerWorldPoint(e.ctrlKey);
    pointerIntent.lastWorld=point;
    updateVisualPoint(pointerIntent.label,point.x,point.y);
    return;
  }
  if(annotationMove){
    const a=annotations.find(x=>x.id===annotationMove.id);
    if(a){
      const wxNow=px2wx(mouse.px), wyNow=py2wy(mouse.py);
      const wxStart=px2wx(annotationMove.startPx), wyStart=py2wy(annotationMove.startPy);
      a.x=annotationMove.startX+(wxNow-wxStart);
      a.y=annotationMove.startY+(wyNow-wyStart);
    } else {
      annotationMove=null;
    }
    draw();
    return;
  }
  if(dragging){
    const dx=e.clientX-last.x, dy=e.clientY-last.y;
    view.cx-=dx/view.scale; view.cy+=dy/view.scale;
    last={x:e.clientX,y:e.clientY};
    draw();
    return;
  }
  if(annotationDragStart){
    const moved=Math.hypot(e.clientX-last.x, e.clientY-last.y);
    if(moved>=4){
      annotationMove=annotationDragStart;
      annotationDragStart=null;
    }
    draw();
    return;
  }
  if(annotationMode){
    let hover=null;
    for(const a of annotations){
      if(a._box && mouse.px>=a._box.x && mouse.px<=a._box.x+a._box.w && mouse.py>=a._box.y && mouse.py<=a._box.y+a._box.h){
        hover=a.id; break;
      }
    }
    if(annotationHoverId!==hover){ annotationHoverId=hover; setCanvasCursor(); draw(); }
    return;
  }
  draw();
});
cv.addEventListener('pointerup',e=>{
  if(view3d.mode==='3d') return;
  updateMouseFromEvent(e);
  const moved=Math.hypot(e.clientX-last.x,e.clientY-last.y);
  if(pointerIntent==='geo-point'&&moved<6){
    const hit=hitGeometryPoint(mouse.px,mouse.py);
    if(hit) selectGeoPoint(hit.label);
    else createVisualPoint(px2wx(mouse.px),py2wy(mouse.py));
  } else if(pointerIntent?.type==='geo-hit'&&pointerIntent.dragging){
    const point=pointerWorldPoint(e.ctrlKey);
    pointerIntent.lastWorld=point;
    updateVisualPoint(pointerIntent.label,point.x,point.y,{final:true});
    selectGeoPoint(pointerIntent.label,true);
  } else if(pointerIntent?.type==='geo-hit'&&moved<6){
    selectGeoPoint(pointerIntent.label);
  } else if(dragging){
    scheduleSave();
  } else if(pointerIntent==='annotation'){
    // finish is handled by blur/enter on the input
  }
  pointerIntent=null;
  dragging=false;
  if(annotationMove){ annotationMove=null; scheduleSave(); }
  annotationDragStart=null;
  setCanvasCursor();
  draw();
});
cv.addEventListener('pointerleave',()=>{
  if(view3d.mode==='3d'){ mouse.inside=false; return; }
  if(pointerIntent?.type==='geo-hit'&&pointerIntent.dragging){
    const point=pointerIntent.lastWorld || pointerWorldPoint(false);
    updateVisualPoint(pointerIntent.label,point.x,point.y,{final:true});
  }
  if(dragging) scheduleSave();
  pointerIntent=null;
  dragging=false;
  annotationMove=null;
  annotationDragStart=null;
  annotationHoverId=null;
  mouse.inside=false;
  setCanvasCursor();
  draw();
});
cv.addEventListener('wheel',e=>{
  if(view3d.mode==='3d') return;
  e.preventDefault();
  const r=cv.getBoundingClientRect();
  const mx=e.clientX-r.left, my=e.clientY-r.top;
  const wxBefore=px2wx(mx), wyBefore=py2wy(my);
  const factor=Math.pow(1.0015,-e.deltaY);
  view.scale=Math.min(Math.max(view.scale*factor,0.02),50000);
  view.cx=wxBefore-(mx-W/2)/view.scale;
  view.cy=wyBefore+(my-H/2)/view.scale;
  draw();
  scheduleSave();
},{passive:false});
cv.addEventListener('dblclick',e=>{
  if(view3d.mode==='3d') return;
  updateMouseFromEvent(e);
  if(annotationMode){ editAnnotationAt(mouse.px, mouse.py); return; }
});
cv.addEventListener('contextmenu',e=>{
  if(view3d.mode==='3d') return;
  e.preventDefault();
  updateMouseFromEvent(e);
  if(annotationMode) deleteAnnotationAt(mouse.px, mouse.py);
});

function zoomBy(f){
  if(view3d.mode==='3d'){ view3d.camera=zoomCamera(view3d.camera,f); draw(); scheduleSave(); return; }
  const wx=px2wx(W/2), wy=py2wy(H/2);
  view.scale=Math.min(Math.max(view.scale*f,0.02),50000);
  view.cx=wx; view.cy=wy; draw(); scheduleSave();
}
document.getElementById('zin').onclick=()=>zoomBy(1.4);
document.getElementById('zout').onclick=()=>zoomBy(1/1.4);
document.getElementById('reset').onclick=()=>{
  if(view3d.mode==='3d') view3d.camera=defaultCamera3d(view3d.camera);
  else { view.cx=0;view.cy=0;view.scale=38; }
  draw(); scheduleSave();
};
attachCameraControls(cv,()=>view3d.camera,camera=>{ view3d.camera=camera; },draw,{
  isActive:()=>view3d.mode==='3d'&&getActive3DLibrary()==='default',
  onCommit:scheduleSave,
  defaultCamera:()=>defaultCamera3d(view3d.camera)
});
initThree3DControls(()=>view3d.camera,camera=>{view3d.camera=camera;},draw,{
  isActive:()=>view3d.mode==='3d'&&getActive3DLibrary()==='threejs',
  onCommit:scheduleSave,
  defaultCamera:()=>defaultCamera3d(view3d.camera)
});
const viewModeBtn=document.getElementById('view-mode');
if(viewModeBtn) viewModeBtn.onclick=()=>setViewMode(view3d.mode==='3d'?'2d':'3d');
if(sectionToggle)sectionToggle.onclick=()=>{
  dualSection=!dualSection;
  draw();scheduleSave();
};
if(planeDragButton)planeDragButton.onclick=()=>{
  planeDragMode=!planeDragMode;
  equations.forEach(eq=>{eq.showPlaneGizmo=planeDragMode&&eq.geometry?.type==='plane';});
  draw();
};
initThreePlaneDragging({
  isEnabled:()=>view3d.mode==='3d'&&getActive3DLibrary()==='threejs'&&planeDragMode,
  onDrag:({phase,eqId,kind,axis,shiftKey,ctrlKey,dx,dy})=>{
    const eq=equations.find(item=>item.id===eqId);
    if(!eq)return;
    // Real XYZ gizmos on explicitly written planes. Drag a colored axis
    // arrow to translate along it, the plane to translate normally, or
    // Shift+drag the plane to rotate around its original anchor point.
    if(eq.geometry?.type==='plane'){
      const plane=eq.geometry.scene3d?.find(p=>p.kind==='plane'&&p.role==='main');
      if(phase==='start'){
        if(!plane)return;
        const n=[...plane.n],d=plane.d,norm2=n.reduce((acc,x)=>acc+x*x,0);
        planeDragStart={eqId,general:true,n,d,anchor:n.map(x=>x*d/norm2)};
        return;
      }
      if(!planeDragStart?.general||planeDragStart.eqId!==eqId)return;
      if(phase==='end'){
        planeDragStart=null;renderRows();scheduleSave();return;
      }
      if(phase!=='move')return;
      const start=planeDragStart,{n:source,anchor}=start;
      let n=[...source],point=[...anchor],d=start.d;
      if(kind==='handle'&&Number.isInteger(axis)&&axis>=0&&axis<3){
        point[axis]+=(dx-dy)*.023;
        d=n.reduce((acc,x,i)=>acc+x*point[i],0);
      }else if(shiftKey){
        const yaw=dx*.006,pitch=-dy*.006;
        const cy=Math.cos(yaw),sy=Math.sin(yaw),cx=Math.cos(pitch),sx=Math.sin(pitch);
        n=[cy*source[0]+sy*source[2],source[1],-sy*source[0]+cy*source[2]];
        n=[n[0],cx*n[1]-sx*n[2],sx*n[1]+cx*n[2]];
        d=n.reduce((acc,x,i)=>acc+x*anchor[i],0);
      }else{
        d+=(dx-dy)*.023*Math.hypot(...n);
      }
      const fmt=value=>String(Number((Math.abs(value)<1e-11?0:value).toPrecision(7)));
      eq.text='plano: '+n.map((x,i)=>fmt(x)+'*'+'xyz'[i]).join(' + ')+' = '+fmt(d);
      recompileAllEquations();
      resultRefreshers.forEach(refresh=>refresh());
      draw();
      return;
    }
    if(!eq.geometry?.section||!eq.text.includes('angulo('))return;
    if(phase==='start'){
      planeDragStart={eqId,q:eq.params.q,b:eq.params.b,a:eq.params.a,d:eq.params.d};
      return;
    }
    if(!planeDragStart||planeDragStart.eqId!==eqId)return;
    if(phase==='move'){
      const next=kind==='plane'?dragPlaneParameters(planeDragStart,{dx,dy})
        :dragConeParameters(planeDragStart,{dx,dy},{kind});
      Object.assign(eq.params,next);
      recompileAllEquations();
      resultRefreshers.forEach(refresh=>refresh());
      draw();
    }else if(phase==='end'){
      planeDragStart=null;renderRows();scheduleSave();
    }
  }
});
['xy','xz','yz','iso'].forEach(name=>{
  const button=document.getElementById('view-'+name);
  if(button) button.onclick=()=>{
    view3d.camera=createCamera({...view3d.camera,...presetView(name)});
    if(getActive3DLibrary()==='plotly'){
      updatePlotlyCamera(view3d.camera);
    }
    draw();
    scheduleSave();
  };
});
const viewProjBtn=document.getElementById('view-proj');
if(viewProjBtn) viewProjBtn.onclick=()=>{
  view3d.camera=createCamera({...view3d.camera,projection:view3d.camera.projection==='perspective'?'ortho':'perspective'});
  draw(); scheduleSave();
};
const axisRangeInput=document.getElementById('view-axis-range');
const autoAxisInput=document.getElementById('view-axis-auto');
const axisTicksInput=document.getElementById('view-axis-ticks');
if(axisTicksInput) axisTicksInput.addEventListener('change',()=>{
  view3d.axisTickStep=axisTicksInput.value==='1'?'1':'auto';
  draw(); scheduleSave();
});
if(autoAxisInput) autoAxisInput.addEventListener('change',()=>{
  view3d.autoAxisRange=autoAxisInput.checked;
  if(!view3d.autoAxisRange){
    const range=Number(axisRangeInput?.value);
    if(Number.isFinite(range)&&range>0) view3d.axisRange=range;
  }
  view3dFitAxisRange=null;
  draw(); scheduleSave();
});
if(axisRangeInput) axisRangeInput.addEventListener('change',()=>{
  const range=Number(axisRangeInput.value);
  if(!Number.isFinite(range)||range<=0){
    axisRangeInput.setCustomValidity('Informe um limite dos eixos maior que zero.');
    axisRangeInput.reportValidity();
    return;
  }
  axisRangeInput.setCustomValidity('');
  view3d.axisRange=range;
  view3d.autoAxisRange=false;
  if(autoAxisInput) autoAxisInput.checked=false;
  view3dFitAxisRange=null;
  draw(); scheduleSave();
});
const fitBtn=document.getElementById('fit');
if(fitBtn) fitBtn.onclick=fitToView;
const installBtn=document.getElementById('install-app');
let deferredInstall=null;
window.addEventListener('beforeinstallprompt',event=>{
  event.preventDefault();deferredInstall=event;
  if(installBtn)installBtn.hidden=false;
});
if(installBtn)installBtn.onclick=async()=>{
  if(!deferredInstall)return;
  const prompt=deferredInstall;deferredInstall=null;installBtn.hidden=true;
  await prompt.prompt();
};
window.addEventListener('appinstalled',()=>{deferredInstall=null;if(installBtn)installBtn.hidden=true;});
const exportGraphicBtn=document.getElementById('export-graphic');
const combinedExportBtn=document.getElementById('section2d-combined');
if(combinedExportBtn)combinedExportBtn.onclick=async()=>{
  const status=document.getElementById('export-graphic-status');
  try{await exportCombinedPng();if(status)status.textContent='Composição 3D + 2D exportada.';}
  catch(error){if(status)status.textContent='Falha ao exportar composição: '+error.message;
    combinedExportBtn.title='Falha: '+error.message;}
};
const shareSceneBtn=document.getElementById('share-scene');
if(shareSceneBtn)shareSceneBtn.onclick=async()=>{
  const status=document.getElementById('export-graphic-status');
  try{
    const url=new URL(window.location.href);
    url.search='';url.searchParams.set('scene',encodeSharedScene(plainState()));
    if(navigator.clipboard?.writeText)await navigator.clipboard.writeText(url.href);
    else if(typeof window.prompt==='function')window.prompt('Copie o link da cena:',url.href);
    else throw new Error('Área de transferência indisponível.');
    if(status)status.textContent='Link da cena copiado.';
    shareSceneBtn.title='Link copiado · inclui vista 3D e parâmetros';
  }catch(error){
    if(status)status.textContent='Falha ao compartilhar: '+error.message;
    shareSceneBtn.title='Falha: '+error.message;
  }
};
if(exportGraphicBtn)exportGraphicBtn.onclick=async()=>{
  const status=document.getElementById('export-graphic-status');
  try{
    await exportGraphPng({viewMode:view3d.mode,canvas:cv});
    if(status)status.textContent='Imagem PNG exportada.';
  }catch(error){
    if(status)status.textContent='Não foi possível exportar: '+error.message;
    exportGraphicBtn.title='Falha: '+error.message;
  }
};
const fullscreenBtn=document.getElementById('fullscreen');
if(fullscreenBtn){
  fullscreenBtn.onclick=async()=>{
    try{if(document.fullscreenElement)await document.exitFullscreen();else await document.documentElement.requestFullscreen();}
    catch{fullscreenBtn.title='Use F11 para tela cheia';}
  };
  document.addEventListener('fullscreenchange',()=>{
    fullscreenBtn.textContent=document.fullscreenElement?'⤢':'⛶';
    fullscreenBtn.setAttribute('aria-label',document.fullscreenElement?'Sair da tela cheia':'Tela cheia');
  });
}
const gridBtn=document.getElementById('grid-mode');
if(gridBtn){
  gridBtn.onclick=toggleGridMode;
  updateGridModeButton();
}
const annotateBtn=document.getElementById('annotate');
if(annotateBtn) annotateBtn.onclick=toggleAnnotationMode;

const undoBtn=document.getElementById('undo');
const redoBtn=document.getElementById('redo');
if(undoBtn) undoBtn.onclick=undo;
if(redoBtn) redoBtn.onclick=redo;

document.addEventListener('keydown',ev=>{
  if(!(ev.ctrlKey||ev.metaKey)) return;
  const tag=ev.target&&ev.target.tagName;
  if(tag==='INPUT'||tag==='TEXTAREA') return;   // leave field-level undo to the browser
  const key=ev.key.toLowerCase();
  if(key==='z'&&!ev.shiftKey){ ev.preventDefault(); undo(); }
  else if(key==='y'||(key==='z'&&ev.shiftKey)){ ev.preventDefault(); redo(); }
});

document.getElementById('theme').onclick=function(){
  theme = theme==='light' ? 'dark' : 'light';
  applyTheme();
  renderRows();
  draw();
  scheduleSave();
};

// Theme is a user preference, independent of the scene supplied by a URL.
const initialState=loadState();
const savedTheme=initialState?.theme;
theme=savedTheme==='dark'||savedTheme==='light' ? savedTheme
  : window.matchMedia?.('(prefers-color-scheme: dark)')?.matches ? 'dark' : 'light';

// URL commands define the initial scene; reuse the normal compilation below
// so geometry and algebra references resolve just like manually entered rows.
const initialQuery=new URLSearchParams(window.location?.search || '');
const initialCommands=initialQuery.getAll('cmd').filter(command=>command.trim());
let initialShare=null;
if(initialQuery.has('scene')){
  try{initialShare=decodeSharedScene(initialQuery.get('scene'));}
  catch(error){
    const status=document.getElementById('export-graphic-status');
    if(status)status.textContent='Link de cena inválido: '+error.message;
  }
}
if(initialShare){
  restoreState(initialShare);
}else if(initialCommands.length){
  initialCommands.forEach(command=>equations.push(makeEq(command)));
}else if(!restoreState(initialState)) equations.push(makeEq('sin(x)'));
initPresets();
initKeyboardPanel();
initProjectControls({
  getState:plainState,
  importState:(state)=>{
    flushPending();
    applyState(JSON.stringify(state));
    commitHistory();
  }
});
initLessons();
initHelp();
initGeoBuilder();
initAlgebraWorkbench({insert:(command)=>{
  const target=focusedEquation&&equations.includes(focusedEquation)&&!focusedEquation.text.trim()?focusedEquation:null;
  if(target)target.text=command;else equations.push(makeEq(command));
  recompileAllEquations();renderRows();draw();scheduleSave();
}});
initSideResizer();
init3DLibrarySelector();
onActive3DLibraryChange(()=>{
  resize();
  scheduleSave();
});
recompileAllEquations();
applyTheme();
updateGridModeButton();
renderRows();
setCanvasCursor();
resize();
commitHistory();   // seed history with the initial state
if('serviceWorker' in navigator&&location.protocol!=='file:')
  window.addEventListener('load',()=>navigator.serviceWorker.register('./sw.js').catch(()=>{}));
