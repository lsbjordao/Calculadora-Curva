import assert from 'node:assert/strict';
import test from 'node:test';

// Boots app.js with persisted regression / points equations so recompileEq
// exercises parsePoints + the fitting paths during init (under a DOM stub).

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
  mk(0,'fit2: (-1,1),(0,0),(1,1),(2,4)'),
  mk(1,'fitexp: (0,1),(1,2),(2,4)'),
  mk(2,'points: (1,1),(2,2),(3,3)'),
  mk(3,'fitlog: (1,2),(2,4),(4,6)'),
  mk(4,'fitsig: (-4,0.018),(-2,0.119),(0,0.5),(2,0.881),(4,0.982)'),
  mk(5,'hist: 1,2,2,3,3,3,4'),
  mk(6,'seq: i,1,4,i^2'),
  mk(7,'intersec: sin(x), cos(x)'),
  mk(8,'linsolve([[2,1],[1,3]],[5,10])'),
  mk(9,'fit2: seq(i,1,n,i^2)',{params:{n:5}}),
  mk(10,'hist: seq(i,1,n,round(i/2))',{params:{n:8}}),
  mk(11,'sum(i,1,n,(i^2-fit2(seq(j,1,n,j^2),i))^2)',{params:{n:5}}),
  mk(12,'compare: seq(i,1,n,i^2+sin(i)/3)',{params:{n:6}}),
  mk(13,'resid: fit2, seq(i,1,n,i^2+sin(i)/3)',{params:{n:6}})
]};
globalThis.localStorage={ getItem:k=>k==='curva-state-v1'?JSON.stringify(state):null, setItem(){}, removeItem(){} };

test('app.js boots with regression and points equations',async()=>{
  await assert.doesNotReject(import('../src/app.js'));
});
