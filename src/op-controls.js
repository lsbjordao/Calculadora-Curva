"use strict";

const num=(v,d)=>Number.isFinite(v)?v:d;
const RIEMANN_MODES=new Set(['left','right','mid','trap']);

// Normalize/seed the per-equation calculus fields. Pure: operates on plain
// objects, no DOM, so it is shared by makeEq, applyEquationOptions, restore and
// undo/redo, and is unit-testable.
export function applyOpFields(eq, src={}){
  eq.showD2 = !!src.showD2;
  eq.showR = !!src.showR;
  eq.dx = num(src.dx, 0);
  eq.ia = num(src.ia, 0);
  eq.ib = num(src.ib, 1);
  eq.riemannN = Number.isInteger(src.riemannN) && src.riemannN>=1 && src.riemannN<=120 ? src.riemannN : 8;
  eq.riemannMode = RIEMANN_MODES.has(src.riemannMode) ? src.riemannMode : 'mid';
  eq.lx = num(src.lx, 0);
  eq.lInf = (src.lInf==='+'||src.lInf==='-') ? src.lInf : null;
  eq.dp = (Number.isInteger(src.dp) && src.dp>=0 && src.dp<=6) ? src.dp : 1;
  eq.showNormal = !!src.showNormal;
  eq.tmin = num(src.tmin, -10);
  eq.tmax = num(src.tmax, 10);
  eq.thmin = num(src.thmin, 0);
  eq.thmax = num(src.thmax, 2*Math.PI);
  eq.showGeoSideLengths = !!src.showGeoSideLengths;
  eq.showGeoVectorLengths = !!src.showGeoVectorLengths;
  eq.showGeoTriangleClass = src.showGeoTriangleClass !== false;
  eq.showGeoAngles = src.showGeoAngles !== false;
  eq.showGeoXAxisAngles = !!src.showGeoXAxisAngles;
  eq.histBins = (Number.isInteger(src.histBins) && src.histBins>=1 && src.histBins<=50) ? src.histBins : null;
  eq.histDensity = !!src.histDensity;
  eq.histNormal = !!src.histNormal;
  eq.statsPop = !!src.statsPop;
  return eq;
}

// Inline numeric controls for the calculus operations. DOM is only touched
// inside render()/handlers, never at import time.
export function createOpControls({ eqColor, onChange }){
  function numberInput(value, step, on, field){
    const inp=document.createElement('input');
    inp.type='number'; inp.step=step; inp.className='op-num'; inp.value=value;
    if(field) inp.dataset.opField=field;
    inp.oninput=()=>{ const v=Number(inp.value); if(Number.isFinite(v)) on(v); };
    return inp;
  }
  function integerInput(value, min, max, on, field){
    const inp=document.createElement('input');
    inp.type='number'; inp.step='1'; inp.min=String(min); inp.max=String(max); inp.className='op-num op-int'; inp.value=value;
    if(field) inp.dataset.opField=field;
    inp.oninput=()=>{
      const v=Math.round(Number(inp.value));
      if(Number.isFinite(v)) on(Math.min(Math.max(v,min),max));
    };
    return inp;
  }
  // Step selector (decimal places) appended to the right of the first field row.
  function dpSelect(eq, rerender, notify){
    const sel=document.createElement('select');
    sel.className='op-dp'; sel.title='Casas decimais do passo';
    for(let n=0;n<=4;n++){
      const o=document.createElement('option');
      o.value=String(n); o.textContent=n+' casas';
      if((eq.dp ?? 1)===n) o.selected=true;
      sel.appendChild(o);
    }
    sel.onchange=()=>{ eq.dp=Number(sel.value); notify(); rerender(); };
    return sel;
  }
  function group(...nodes){
    const wrap=document.createElement('div'); wrap.className='op-field';
    wrap.append(...nodes);
    return wrap;
  }
  function span(text){ const s=document.createElement('span'); s.textContent=text; return s; }
  function toggleBtn(label, on, field, handler){
    const b=document.createElement('button');
    b.type='button'; b.className='op-inf'; b.textContent=label;
    b.dataset.opField=field; b.dataset.sel=on?'1':'0';
    b.onclick=handler;
    return b;
  }

  function render(eq, container, onLocalChange=()=>{}){
    container.innerHTML='';
    const notify=()=>{ onChange(); onLocalChange(); };
    const rerender=()=>render(eq, container, onLocalChange);
    const step=Math.pow(10, -(eq.dp ?? 1));
    let firstGroup=null;
    const add=g=>{ if(!firstGroup) firstGroup=g; container.appendChild(g); };

    if(eq.kind==='parametric'){
      add(group(
        span('t de'), numberInput(eq.tmin, step, v=>{ eq.tmin=v; notify(); }, 'tmin'),
        span('a'),     numberInput(eq.tmax, step, v=>{ eq.tmax=v; notify(); }, 'tmax')
      ));
      if(firstGroup) firstGroup.appendChild(dpSelect(eq, rerender, notify));
      return;
    }
    if(eq.kind==='polar'){
      add(group(
        span('θ de'), numberInput(eq.thmin, step, v=>{ eq.thmin=v; notify(); }, 'thmin'),
        span('a'),     numberInput(eq.thmax, step, v=>{ eq.thmax=v; notify(); }, 'thmax')
      ));
      if(firstGroup) firstGroup.appendChild(dpSelect(eq, rerender, notify));
      return;
    }
    if(eq.kind==='histogram'){
      const binsInput=integerInput(eq.histBins ?? (eq.points?.length||12), 1, 50,
        v=>{ eq.histBins=v; notify(); rerender(); }, 'histBins');
      const g=group(span('bins'), binsInput);
      g.append(toggleBtn('densidade', eq.histDensity, 'histDensity',
        ()=>{ eq.histDensity=!eq.histDensity; notify(); rerender(); }));
      g.append(toggleBtn('normal', eq.histNormal, 'histNormal',
        ()=>{ eq.histNormal=!eq.histNormal; notify(); rerender(); }));
      add(g);
      return;
    }

    if(eq.showD || eq.showD2){
      const g=group(
        span('x ='),
        numberInput(eq.dx, step, v=>{ eq.dx=v; eq.analysisCache=null; notify(); }, 'dx')
      );
      if(eq.showD){
        const nb=document.createElement('button');
        nb.type='button'; nb.className='op-inf'; nb.textContent='normal';
        nb.title='Reta normal (perpendicular à tangente no ponto x)';
        nb.dataset.opField='showNormal';
        nb.dataset.sel = eq.showNormal ? '1':'0';
        nb.onclick=()=>{ eq.showNormal=!eq.showNormal; notify(); rerender(); };
        g.appendChild(nb);
      }
      add(g);
    }
    if(eq.showI || eq.showR){
      add(group(
        span(eq.showI ? '∫ a =' : 'a ='),
        numberInput(eq.ia, step, v=>{ eq.ia=v; eq.intCache=null; eq.analysisCache=null; notify(); }, 'ia'),
        span('b ='),
        numberInput(eq.ib, step, v=>{ eq.ib=v; eq.intCache=null; eq.analysisCache=null; notify(); }, 'ib')
      ));
    }
    if(eq.showR){
      const mode=document.createElement('select');
      mode.className='op-dp op-mode';
      mode.title='Tipo de Soma de Riemann';
      mode.dataset.opField='riemannMode';
      [
        ['left','esq'],
        ['right','dir'],
        ['mid','meio'],
        ['trap','trap']
      ].forEach(([value,label])=>{
        const option=document.createElement('option');
        option.value=value;
        option.textContent=label;
        if(eq.riemannMode===value) option.selected=true;
        mode.appendChild(option);
      });
      mode.onchange=()=>{ eq.riemannMode=mode.value; eq.analysisCache=null; notify(); };
      add(group(
        span('Σ n ='),
        integerInput(eq.riemannN, 1, 120, v=>{ eq.riemannN=v; eq.analysisCache=null; notify(); }, 'riemannN'),
        mode
      ));
    }
    if(eq.showL){
      const point=numberInput(eq.lx, step, v=>{ eq.lx=v; eq.lInf=null; eq.analysisCache=null; notify(); rerender(); }, 'lx');
      point.disabled = eq.lInf!==null;
      const inf=(sign,label)=>{
        const b=document.createElement('button');
        b.type='button'; b.className='op-inf'; b.textContent=label;
        b.dataset.opField='lInf';
        b.dataset.opValue=sign;
        b.dataset.sel = eq.lInf===sign ? '1':'0';
        b.onclick=()=>{ eq.lInf = eq.lInf===sign ? null : sign; eq.analysisCache=null; notify(); rerender(); };
        return b;
      };
      add(group(span('lim x→'), point, inf('+','+∞'), inf('-','−∞')));
    }

    if(firstGroup) firstGroup.appendChild(dpSelect(eq, rerender, notify));
  }

  return { render };
}
