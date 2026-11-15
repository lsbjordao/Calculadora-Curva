import assert from 'node:assert/strict';
import test from 'node:test';

// Stateful DOM stub: assertions inspect the actual app wiring and rendered data,
// including edits to dependencies, rather than just checking that import works.
const ctx=new Proxy({}, {get:(t,p)=>t[p]??(()=>{}),set:(t,p,v)=>(t[p]=v,true)});
const elements=new Map();
function node(tag='div') {
  const data={tagName:tag.toUpperCase(),children:[],dataset:{},style:{},value:'',className:'',textContent:'',hidden:false};
  data.classList={add(){},remove(){},toggle(){},contains(){return false;}};
  const result=new Proxy(data,{
    get(t,p){
      if(p in t)return t[p];
      if(p==='appendChild')return child=>(t.children.push(child),child);
      if(p==='append')return (...children)=>t.children.push(...children);
      if(p==='replaceChildren')return (...children)=>{t.children=children;};
      if(p==='getContext')return ()=>ctx;
      if(p==='getBoundingClientRect')return ()=>({left:0,top:0,right:1200,bottom:800,width:1200,height:800});
      if(p==='querySelectorAll')return ()=>[];
      if(p==='querySelector')return ()=>node();
      if(p==='closest')return ()=>null;
      if(p==='contains'||p==='matches')return ()=>false;
      if(p==='cloneNode')return ()=>node();
      return ()=>{};
    },
    set(t,p,v){
      if(p==='innerHTML'||p==='textContent')t.children=[];
      t[p]=v;return true;
    }
  });
  return result;
}
globalThis.document={getElementById:id=>{if(!elements.has(id))elements.set(id,node());return elements.get(id);},
  createElement:node,createTextNode:text=>({children:[],textContent:text}),querySelector:()=>node(),querySelectorAll:()=>[],
  addEventListener(){},removeEventListener(){},contains(){return false;},body:node()};
globalThis.window={addEventListener(){},devicePixelRatio:1,innerWidth:1200,innerHeight:800};
globalThis.requestAnimationFrame=()=>0;globalThis.cancelAnimationFrame=()=>{};
globalThis.getComputedStyle=()=>({getPropertyValue:()=>'#000'});
globalThis.Event=class{constructor(type){this.type=type;}};
globalThis.setTimeout=()=>0;globalThis.clearTimeout=()=>{};
const state={version:1,theme:'light',view:{cx:0,cy:0,scale:60},equations:[
  {ci:0,text:'sin(x)',params:{}},
  {ci:1,text:'matriz: [1,b; 0,1]',params:{b:.5}},
  {ci:2,text:'calc: det(@M)',params:{}},
  {ci:3,text:'let M = [[a,0],[0,1]]',params:{a:2}},
  {ci:4,text:'calc: svd([[2,1],[0,1]])',params:{}},
  {ci:5,text:'calc: solveinfo([[1,1],[1,a]],[2,3])',params:{a:2}}
]};
globalThis.localStorage={getItem:k=>k==='curva-state-v1'?JSON.stringify(state):null,setItem(){},removeItem(){}};
const descendants=root=>[root,...root.children.flatMap(descendants)];
const text=root=>[typeof root.textContent==='string'?root.textContent:'',...root.children.map(text)].join(' ');
const field=row=>descendants(row).find(el=>el.className==='field');

test('app loads old and new persisted state, recalculates dependents and removes stale errors/results',async()=>{
  await import('../src/app.js');
  const rows=elements.get('rows').children;
  assert.equal(rows.length,6);assert.equal(rows[0].dataset.kind,'function');assert.equal(rows[1].dataset.kind,'geometry');
  assert.equal(rows[2].dataset.kind,'result');assert.match(text(rows[2]),/Determinante|Resultado/);
  assert.equal(descendants(rows[2]).find(el=>el.className==='algebra-scalar').textContent,'2');
  assert.equal(descendants(rows[4]).filter(el=>el.tagName==='TABLE').length,3);
  assert.match(text(rows[5]),/Solução única/);
  field(rows[3]).value='let M = [[4,0],[0,1]]';field(rows[3]).oninput();
  assert.equal(descendants(rows[2]).find(el=>el.className==='algebra-scalar').textContent,'4');
  field(rows[3]).value='let M = @M';field(rows[3]).oninput();
  assert.equal(rows[2].dataset.err,'1');assert.match(text(rows[2]),/circular/);
  assert.equal(descendants(rows[2]).filter(el=>el.className==='algebra-scalar').length,0);
  field(rows[3]).value='let M = [[5,0],[0,1]]';field(rows[3]).oninput();
  assert.equal(rows[2].dataset.err,'0');assert.equal(descendants(rows[2]).find(el=>el.className==='algebra-scalar').textContent,'5');
  field(rows[4]).value='calc: inv([[1,2],[2,4]])';field(rows[4]).oninput();
  assert.equal(rows[4].dataset.err,'1');assert.match(text(rows[4]),/singular/);
  assert.equal(descendants(rows[4]).filter(el=>el.tagName==='TABLE').length,0);
  field(rows[4]).value='det([[1,2],[3,4]])';field(rows[4]).oninput();
  assert.equal(rows[4].dataset.kind,'function'); // Legacy scalar graph behavior.
});
