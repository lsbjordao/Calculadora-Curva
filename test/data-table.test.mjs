import assert from 'node:assert/strict';
import test from 'node:test';

import { tableModel, textToGrid, gridToBody, parsePaste } from '../src/data-table.js';
import { createDataTable } from '../src/data-table.js';

test('tableModel resolves kind for each command',()=>{
  assert.equal(tableModel('points','(0,1),(1,2)').kind, 'xy');
  assert.equal(tableModel('hist','1,2,3').kind, '1var');
  assert.equal(tableModel('histogram','1,2,3').kind, '1var');
  assert.equal(tableModel('stats','(0,1),(1,2)').kind, 'xy');
  assert.equal(tableModel('stats','4,8,15').kind, '1var');
});

test('tableModel returns null for formula / non-literal / unknown bodies',()=>{
  assert.equal(tableModel('points','seq(i,1,n,i)'), null);
  assert.equal(tableModel('hist','seq(i,1,n,round(i/2))'), null);
  assert.equal(tableModel('stats','2*x'), null);
  assert.equal(tableModel('points',''), null);
  assert.equal(tableModel('fit','(0,1),(1,2)'), null);   // out of scope
});

test('textToGrid parses xy and 1var verbatim',()=>{
  assert.deepEqual(textToGrid('xy','(0,1),(1,2.5)'), [['0','1'],['1','2.5']]);
  assert.deepEqual(textToGrid('1var','4, 8 ,15'), [['4'],['8'],['15']]);
  assert.equal(textToGrid('xy','0,1'), null);            // not (a,b) shaped
});

test('gridToBody round-trips and omits incomplete rows',()=>{
  assert.equal(gridToBody('xy',[['0','1'],['1','2.5']]), '(0,1),(1,2.5)');
  assert.equal(gridToBody('xy',[['0','1'],['','9'],['2','']]), '(0,1)');
  assert.equal(gridToBody('1var',[['4'],['8'],['']]), '4,8');
  assert.equal(gridToBody('xy',[['0.30','1']]), '(0.30,1)');   // verbatim precision
});

test('parsePaste reads spreadsheet/CSV',()=>{
  assert.deepEqual(parsePaste('xy','0\t1\n1\t2\n2\t3'), [['0','1'],['1','2'],['2','3']]);
  assert.deepEqual(parsePaste('xy','0,1\n1,2'), [['0','1'],['1','2']]);
  assert.deepEqual(parsePaste('1var','4\n8\n15'), [['4'],['8'],['15']]);
  assert.deepEqual(parsePaste('1var','4,8,15'), [['4'],['8'],['15']]);
  assert.deepEqual(parsePaste('xy','x\ty\n1\t2'), [['1','2']]);  // header dropped (non-numeric)
});

// Minimal DOM stub: enough for createElement/appendChild/innerHTML and to
// locate the cell inputs and fire their handlers.
function stubDocument(){
  function makeEl(){
    const el={tagName:'', _children:[], style:{}, dataset:{}, _value:'', type:'', className:'', textContent:'', title:''};
    el.appendChild=c=>{ el._children.push(c); return c; };
    el.append=(...cs)=>{ cs.forEach(c=>el._children.push(c)); };
    Object.defineProperty(el,'innerHTML',{ get(){return '';}, set(v){ if(v==='') el._children=[]; } });
    Object.defineProperty(el,'value',{ get(){return el._value;}, set(v){ el._value=String(v); } });
    return el;
  }
  globalThis.document={ createElement:(tag)=>{ const e=makeEl(); e.tagName=String(tag).toUpperCase(); return e; } };
}
function collectInputs(el, out=[]){
  if(el.type==='number') out.push(el);
  (el._children||[]).forEach(c=>collectInputs(c,out));
  return out;
}

test('createDataTable render builds a grid and commits cell edits',()=>{
  stubDocument();
  const container=document.createElement('div');
  let committed=null;
  const dt=createDataTable();
  dt.render(container, { kind:'xy', rows:[['0','1'],['1','2']], onCommit:b=>{ committed=b; } });

  const inputs=collectInputs(container);
  assert.equal(inputs.length, 4);                 // 2 rows x 2 cols
  assert.equal(inputs[0].value, '0');
  assert.equal(inputs[3].value, '2');

  inputs[3].value='9';                            // edit y of 2nd row
  inputs[3].oninput();
  assert.equal(committed, '(0,1),(1,9)');         // regenerated body
});

test('createDataTable render builds a 1var grid',()=>{
  stubDocument();
  const container=document.createElement('div');
  let committed='unset';
  const dt=createDataTable();
  dt.render(container, { kind:'1var', rows:[['4'],['8']], onCommit:b=>{ committed=b; } });
  const inputs=collectInputs(container);
  assert.equal(inputs.length, 2);
  inputs[0].value='5'; inputs[0].oninput();
  assert.equal(committed, '5,8');
});
