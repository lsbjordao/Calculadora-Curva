"use strict";

import { fmt, fmtLimitNumber } from './coords.js';
import { safeEval, derivAt, integralAt, limitAt } from './numeric.js';

// Value table for the visible functions. Owns its own DOM controls (toggle,
// close, center/step inputs) and renders a ±4-step grid around a center value.
// Dependencies are injected:
//   equations         -> the live equations array
//   getTheme()        -> current theme (only used to invalidate the cache)
//   getDefaultCenter()-> x to center on when the table is opened
//   eqColor(eq)       -> resolved color for an equation
export function createValueTable({equations, getTheme, getDefaultCenter, eqColor}){
  const valueTable=document.getElementById('value-table');
  const toggle=document.getElementById('table-toggle');
  const closeBtn=document.getElementById('table-close');
  const centerInput=document.getElementById('table-center');
  const stepInput=document.getElementById('table-step');
  const wrap=document.getElementById('table-wrap');

  let visible=false;
  let signature='';

  function isVisible(){ return visible; }

  function setVisible(v){
    visible=!!v;
    valueTable.hidden=!visible;
    toggle.dataset.on=visible?'1':'0';
    signature='';
    if(visible){
      centerInput.value=fmt(getDefaultCenter());
      update(true);
    }
  }

  function columns(active){
    const cols=[];
    active.forEach((eq,index)=>{
      const label='f'+(index+1);
      cols.push({eq,kind:'f',label});
      if(eq.showD) cols.push({eq,kind:'d',label:label+'′'});
      if(eq.showI) cols.push({eq,kind:'i',label:'∫'+label});
      if(eq.showL) cols.push({eq,kind:'l',label:'lim '+label});
    });
    return cols;
  }

  function fmtValue(v){
    if(v===Infinity||v===-Infinity) return fmtLimitNumber(v);
    return Number.isFinite(v) ? fmt(v) : '—';
  }

  function fmtLimit(eq,x){
    try{
      const lim=limitAt(eq.fn,x);
      if(lim.exists) return fmtLimitNumber(lim.value);
      const left=lim.left?.exists ? fmtLimitNumber(lim.left.value) : '—';
      const right=lim.right?.exists ? fmtLimitNumber(lim.right.value) : '—';
      return left==='—'&&right==='—' ? '—' : left+' | '+right;
    }catch(_){
      return '—';
    }
  }

  function cell(col,x){
    if(col.kind==='f') return fmtValue(safeEval(col.eq.fn,x));
    if(col.kind==='d') return fmtValue(safeEval(v=>derivAt(col.eq.fn,v),x));
    if(col.kind==='i') return fmtValue(integralAt(col.eq.fn,x));
    if(col.kind==='l') return fmtLimit(col.eq,x);
    return '—';
  }

  function update(force=false){
    if(!visible) return;
    const centerRaw=Number(centerInput.value);
    const stepRaw=Math.abs(Number(stepInput.value));
    const center=Number.isFinite(centerRaw) ? centerRaw : 0;
    const step=Number.isFinite(stepRaw)&&stepRaw>0 ? stepRaw : 1;
    const active=equations.filter(eq=>eq.visible&&eq.fn&&!eq.error);
    const sig=JSON.stringify({
      theme:getTheme(),
      center,
      step,
      equations:active.map(eq=>[
        eq.id,eq.text,eq.showD,eq.showI,eq.showL,eq.colorOverride,eq.ci,eq.style,eq.lw,eq.params
      ])
    });
    if(!force&&sig===signature) return;
    signature=sig;
    wrap.replaceChildren();
    if(!active.length){
      const empty=document.createElement('div');
      empty.className='empty';
      empty.textContent='sem funções visíveis';
      wrap.appendChild(empty);
      return;
    }

    const table=document.createElement('table');
    const thead=document.createElement('thead');
    const header=document.createElement('tr');
    const xHead=document.createElement('th');
    xHead.textContent='x';
    header.appendChild(xHead);
    const cols=columns(active);
    cols.forEach(col=>{
      const th=document.createElement('th');
      th.title=col.eq.text || 'f(x)';
      const dot=document.createElement('span');
      dot.className='dot';
      dot.style.background=eqColor(col.eq);
      th.append(dot,document.createTextNode(col.label));
      header.appendChild(th);
    });
    thead.appendChild(header);
    table.appendChild(thead);

    const tbody=document.createElement('tbody');
    for(let i=-4;i<=4;i++){
      const x=center+i*step;
      const tr=document.createElement('tr');
      const xCell=document.createElement('td');
      xCell.textContent=fmt(x);
      tr.appendChild(xCell);
      cols.forEach(col=>{
        const td=document.createElement('td');
        td.textContent=cell(col,x);
        tr.appendChild(td);
      });
      tbody.appendChild(tr);
    }
    table.appendChild(tbody);
    wrap.appendChild(table);
  }

  toggle.onclick=()=>setVisible(!visible);
  closeBtn.onclick=()=>setVisible(false);
  centerInput.oninput=()=>update(true);
  stepInput.oninput=()=>update(true);

  return { setVisible, update, isVisible };
}
