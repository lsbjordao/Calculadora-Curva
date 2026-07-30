import assert from 'node:assert/strict';
import test from 'node:test';

// Boots app.js under a resilient Proxy-based DOM stub to catch wiring/import/TDZ
// regressions (e.g. a module extraction that leaves a dangling reference).
// Rendering is deferred to requestAnimationFrame, stubbed to a no-op, so only
// the synchronous init path runs. Any DOM method we don't model returns a
// harmless no-op, so the stub rarely needs maintenance.

const ctx=new Proxy({}, {
  get(t,p){ return p in t ? t[p] : ()=>{}; },
  set(t,p,v){ t[p]=v; return true; }
});
const elements=new Map();
const listeners=new Map();

function makeProxy(){
  const store={ dataset:{}, style:{}, classList:{ toggle(){}, add(){}, remove(){}, contains(){ return false; } } };
  return new Proxy(store, {
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

function getElement(id){
  if(!elements.has(id)) elements.set(id,makeProxy());
  return elements.get(id);
}

globalThis.document={
  getElementById:getElement,
  createElement:()=>makeProxy(),
  createTextNode:t=>({textContent:t}),
  querySelector:()=>makeProxy(),
  querySelectorAll:()=>[],
  addEventListener(type,handler){
    if(!listeners.has(type)) listeners.set(type,[]);
    listeners.get(type).push(handler);
  },
  removeEventListener(type,handler){
    if(!listeners.has(type)) return;
    listeners.set(type,listeners.get(type).filter(item=>item!==handler));
  },
  dispatchEvent(event){
    listeners.get(event.type)?.forEach(handler=>handler(event));
    return true;
  },
  contains(){ return false; },
  body:makeProxy(),
};
globalThis.window={ addEventListener(){}, devicePixelRatio:1, innerWidth:1200, innerHeight:800 };
globalThis.requestAnimationFrame=()=>0;
globalThis.getComputedStyle=()=>({ getPropertyValue:()=>'#000000' });
globalThis.Event=class Event{ constructor(type){ this.type=type; } };
globalThis.CustomEvent=class CustomEvent extends Event{ constructor(type,init={}){ super(type); this.detail=init.detail; } };
globalThis.setTimeout=()=>0;
globalThis.clearTimeout=()=>{};

test('app.js initializes and handles checkpoint toast events under a DOM stub',async()=>{
  await assert.doesNotReject(import('../src/app.js'));
  const toast=getElement('lesson-graph-toast');
  document.dispatchEvent(new CustomEvent('lesson-checkpoint',{detail:{message:'Evento executado: teste.'}}));
  assert.equal(toast.hidden,false);
  assert.equal(toast.dataset.show,'1');
  assert.equal(toast.textContent,'Evento executado: teste.');
});
