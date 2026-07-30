import assert from 'node:assert/strict';
import test from 'node:test';

// Boots app.js with persisted parametric and polar equations so recompileEq
// exercises the new detection/compile paths during init (under a DOM stub).

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

const mk=(ci,text)=>({ci,text,visible:true,showD:false,showI:false,showL:false,showA:false,colorOverride:null,style:'solid',lw:2,params:{}});
const state={ version:1, theme:'light', gridMode:'polar', view:{cx:0,cy:0,scale:38}, equations:[
  mk(0,'(cos(t), sin(t))'),
  mk(1,'r = 1 + cos(theta)')
]};
globalThis.localStorage={ getItem:k=>k==='curva-state-v1'?JSON.stringify(state):null, setItem(){}, removeItem(){} };

test('app.js boots with parametric and polar equations',async()=>{
  await assert.doesNotReject(import('../src/app.js'));
});
