import assert from 'node:assert/strict';
import test from 'node:test';

// Boots app.js with persisted stats / histogram equations so recompileEq
// exercises updateDynamicStats, histBarsFromValues, and the normal overlay
// during init (under a DOM stub).

const ctx=new Proxy({}, { get:(t,p)=> p in t ? t[p] : ()=>{}, set:(t,p,v)=>{t[p]=v;return true;} });
function makeProxy(){
  const store={ dataset:{}, style:{}, classList:{toggle(){},add(){},remove(){},contains(){return false;}} };
  return new Proxy(store,{
    get(t,prop){
      if(prop in t) return t[prop];
      switch(prop){
        case 'getBoundingClientRect': return ()=>({left:0,top:0,right:800,bottom:600,width:800,height:600});
        case 'getContext': return ()=>ctx;
        case 'querySelector': return ()=>makeProxy();
        case 'querySelectorAll': return ()=>[];
        case 'closest': return ()=>null;
        case 'appendChild': return c=>c;
        case 'cloneNode': return ()=>makeProxy();
        case 'contains': case 'matches': return ()=>false;
        default: return ()=>{};
      }
    },
    set(t,prop,val){ t[prop]=val; return true; }
  });
}
globalThis.document={ getElementById:()=>makeProxy(), createElement:()=>makeProxy(), createTextNode:t=>({textContent:t}), querySelector:()=>makeProxy(), querySelectorAll:()=>[], addEventListener(){}, removeEventListener(){}, contains(){return false;}, body:makeProxy() };
globalThis.window={ addEventListener(){}, devicePixelRatio:1, innerWidth:1200, innerHeight:800 };
globalThis.requestAnimationFrame=()=>0;
globalThis.getComputedStyle=()=>({ getPropertyValue:()=>'#000000' });
globalThis.Event=class Event{ constructor(t){ this.type=t; } };

const mk=(ci,text,options={})=>({ci,text,visible:true,showD:false,showI:false,showL:false,showA:false,colorOverride:null,style:'solid',lw:2,params:{},...options});
const state={ version:1, theme:'light', view:{cx:0,cy:0,scale:38}, equations:[
  mk(0,'stats: 4,8,8,15,16,23,42'),
  mk(1,'stats: (1,2.1),(2,3.9),(3,6.2),(4,7.8),(5,10.1)'),
  mk(2,'hist: 1,2,2,3,3,3,4,4,5,5,6', {histBins:5, histDensity:true, histNormal:true}),
  mk(3,'stats: seq(i,1,n,i^2)', {params:{n:5}}),
  mk(4,'fit: (0,1),(1,2.1),(2,2.9),(3,4.2)')
]};
globalThis.localStorage={ getItem:k=>k==='curva-state-v1'?JSON.stringify(state):null, setItem(){}, removeItem(){} };

test('app.js boots with stats and configured histogram equations',async()=>{
  await assert.doesNotReject(import('../src/app.js'));
});

test('the three stats lessons are registered',async()=>{
  const { LESSONS } = await import('../src/lessons.js');
  const ids=LESSONS.map(l=>l.id);
  ['stats-descriptive','stats-histograms','stats-correlation'].forEach(id=>
    assert.ok(ids.includes(id), 'missing lesson '+id));
});
