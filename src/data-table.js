"use strict";

// Pure text<->grid logic for the editable data table. The command text
// (eq.text) stays the source of truth; this module converts between the
// command body and a grid of raw string cells. No DOM here.

import { splitTop } from './parser.js';

function isNumStr(s){
  const t=String(s).trim();
  return t!=='' && Number.isFinite(Number(t));
}

// Split a command body into a grid of verbatim string cells.
// Returns null on structural mismatch (an xy token that is not `(a,b)`).
export function textToGrid(kind, body){
  const tokens=splitTop(String(body||''), ',').map(t=>t.trim()).filter(t=>t!=='');
  if(kind==='xy'){
    const rows=[];
    for(const tok of tokens){
      if(!(tok.startsWith('(') && tok.endsWith(')'))) return null;
      const parts=tok.slice(1,-1).split(',').map(s=>s.trim());
      if(parts.length!==2) return null;
      rows.push(parts);
    }
    return rows;
  }
  return tokens.map(t=>[t]);
}

// Build {kind, rows} for a literal data command, or null when the body is a
// formula/expression (not a concrete number list) or the command is unsupported.
export function tableModel(name, body){
  const b=String(body||'').trim();
  if(!b) return null;
  let kind;
  if(name==='points') kind='xy';
  else if(name==='hist' || name==='histogram') kind='1var';
  else if(name==='stats') kind = b.startsWith('(') ? 'xy' : '1var';
  else return null;
  const rows=textToGrid(kind, b);
  if(!rows || !rows.length) return null;
  for(const r of rows) for(const c of r) if(!isNumStr(c)) return null;
  return { kind, rows };
}

// Regenerate the command body from the grid, dropping incomplete rows.
export function gridToBody(kind, rows){
  if(kind==='xy'){
    return rows
      .filter(r=>String(r[0]??'').trim()!=='' && String(r[1]??'').trim()!=='')
      .map(r=>'('+String(r[0]).trim()+','+String(r[1]).trim()+')')
      .join(',');
  }
  return rows
    .filter(r=>String(r[0]??'').trim()!=='')
    .map(r=>String(r[0]).trim())
    .join(',');
}

// Parse pasted spreadsheet/CSV text into grid rows (tab- or comma-separated).
export function parsePaste(kind, text){
  const lines=String(text||'').split(/\r?\n/).map(l=>l.trim()).filter(l=>l!=='');
  if(kind==='xy'){
    const rows=[];
    for(const line of lines){
      const nums=line.split(/[\t,]/).map(s=>s.trim()).filter(isNumStr);
      if(nums.length>=2) rows.push([nums[0], nums[1]]);
    }
    return rows;
  }
  const out=[];
  for(const line of lines){
    for(const s of line.split(/[\t,]/).map(x=>x.trim())){
      if(isNumStr(s)) out.push([s]);
    }
  }
  return out;
}

// DOM widget. Touches the DOM only inside render(); container is owned by the
// caller. The grid model is a mutable copy of the passed rows for this render.
export function createDataTable(){
  function render(container, { kind, rows, onCommit }){
    const model=rows.map(r=>r.slice());
    const commit=()=>onCommit(gridToBody(kind, model));
    const ncol=kind==='xy' ? 2 : 1;

    function build(){
      container.innerHTML='';
      const table=document.createElement('div');
      table.className='data-table';

      const head=document.createElement('div');
      head.className='dt-row dt-head';
      (kind==='xy' ? ['x','y'] : ['valor']).forEach(label=>{
        const h=document.createElement('span');
        h.className='dt-cell dt-h'; h.textContent=label;
        head.appendChild(h);
      });
      head.appendChild(document.createElement('span')); // spacer above the del column
      table.appendChild(head);

      model.forEach((r, i)=>{
        const tr=document.createElement('div');
        tr.className='dt-row';
        for(let c=0;c<ncol;c++){
          const inp=document.createElement('input');
          inp.type='number'; inp.step='any'; inp.className='dt-cell'; inp.value=r[c]??'';
          inp.oninput=()=>{ model[i][c]=inp.value; commit(); };
          tr.appendChild(inp);
        }
        const del=document.createElement('button');
        del.type='button'; del.className='dt-del'; del.textContent='🗑'; del.title='Remover linha';
        del.onclick=()=>{ model.splice(i,1); build(); commit(); };
        tr.appendChild(del);
        table.appendChild(tr);
      });

      const add=document.createElement('button');
      add.type='button'; add.className='dt-add'; add.textContent='＋ linha';
      add.title='Adicionar linha';
      add.onclick=()=>{ model.push(kind==='xy' ? ['',''] : ['']); build(); };
      table.appendChild(add);

      container.appendChild(table);
    }

    container.onpaste=(ev)=>{
      const text=ev.clipboardData ? ev.clipboardData.getData('text') : '';
      const pasted=parsePaste(kind, text);
      if(pasted.length){
        if(ev.preventDefault) ev.preventDefault();
        model.length=0;
        pasted.forEach(r=>model.push(r));
        build();
        commit();
      }
    };

    build();
  }
  return { render };
}
