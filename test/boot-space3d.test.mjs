import assert from 'node:assert/strict';
import test from 'node:test';

// Boots app.js (fresh module instance per boot via a query string) under a DOM
// stub whose canvas context records calls and whose elements keep listeners, so
// the 3D drawing branch, the 2D drag exclusion of 3D points and the saved view3d
// state can be checked without a browser.

let calls=[], elements=new Map(), created=[], stored=null, saved=null;

function recordingCtx(){
  const t={};
  return new Proxy(t,{
    get(target,prop){
      if(prop in target) return target[prop];
      if(prop==='measureText') return text=>({width:String(text).length*6});
      if(prop==='createLinearGradient'||prop==='createRadialGradient') return ()=>({addColorStop(){}});
      if(prop==='getLineDash') return ()=>[];
      return (...args)=>{ calls.push([prop,...args]); };
    },
    set(target,prop,v){ target[prop]=v; return true; }
  });
}
let ctx=recordingCtx();

function makeEl(id){
  const listeners={};
  const store={ id, dataset:{}, style:{}, listeners, children:[],
    classList:{toggle(){},add(){},remove(){},contains(){return false;}},
    addEventListener(type,fn){ (listeners[type]||=[]).push(fn); },
    removeEventListener(){},
    fire(type,ev={}){ (listeners[type]||[]).forEach(fn=>fn({preventDefault(){},stopPropagation(){},pointerId:1,clientX:0,clientY:0,target:proxy,...ev})); }
  };
  const proxy=new Proxy(store,{
    get(t,prop){
      if(prop in t) return t[prop];
      switch(prop){
        case 'getBoundingClientRect': return ()=>({left:0,top:0,right:800,bottom:600,width:800,height:600});
        case 'getContext': return ()=>ctx;
        case 'querySelector': return ()=>makeEl();
        case 'querySelectorAll': return ()=>[];
        case 'closest': return ()=>null;
        case 'appendChild': case 'append': return (...c)=>{ t.children.push(...c); return c[0]; };
        case 'cloneNode': return ()=>makeEl();
        case 'contains': case 'matches': return ()=>false;
        default: return ()=>{};
      }
    },
    set(t,prop,val){ t[prop]=val; return true; }
  });
  return proxy;
}
const byId=id=>{ if(!elements.has(id)) elements.set(id,makeEl(id)); return elements.get(id); };

globalThis.document={
  getElementById:byId,
  createElement:()=>{ const el=makeEl(); created.push(el); return el; },
  createTextNode:t=>({textContent:t}),
  querySelector:()=>makeEl(), querySelectorAll:()=>[],
  addEventListener(){}, removeEventListener(){}, contains(){return false;},
  body:makeEl('body'), documentElement:makeEl('html')
};
globalThis.window={ addEventListener(){}, devicePixelRatio:1, innerWidth:1200, innerHeight:800 };
globalThis.requestAnimationFrame=cb=>setTimeout(cb,0);
globalThis.getComputedStyle=()=>({ getPropertyValue:()=>'#000000' });
globalThis.Event=class Event{ constructor(t){ this.type=t; } };
globalThis.localStorage={
  getItem:k=>k==='curva-state-v1'&&stored ? JSON.stringify(stored) : null,
  setItem:(k,v)=>{ if(k==='curva-state-v1') saved=JSON.parse(v); },
  removeItem(){}
};

const mk=(ci,text)=>({ci,text,visible:true,showD:false,showI:false,showL:false,showA:false,colorOverride:null,style:'solid',lw:2,params:{}});
const wait=ms=>new Promise(r=>setTimeout(r,ms));
let bootN=0;
async function boot(state){
  calls=[]; elements=new Map(); created=[]; saved=null; stored=state; ctx=recordingCtx();
  await import('../src/app.js?boot='+(++bootN));
  await wait(20);
}
const texts=()=>calls.filter(c=>c[0]==='fillText').map(c=>String(c[1]));
const cv=()=>byId('cv');
// The persisted state is written by the 120 ms debounced save.
const settle=()=>wait(220);

test('estado salvo com objeto 3D e view3d 3D inicializa e desenha a cena 3D',async()=>{
  await boot({version:1,theme:'light',view:{cx:0,cy:0,scale:60},
    view3d:{mode:'3d',camera:{azimuth:-60,elevation:25,projection:'ortho',zoom:1}},
    equations:[mk(0,'ponto: A=(1,2,3)'),mk(1,'vetor: u=(2,-1,3)'),mk(2,'sin(x)')]});
  const t=texts();
  assert.ok(t.includes('z'),'nome do eixo z desenhado');
  assert.ok(t.includes('A'),'rótulo do ponto A');
  assert.ok(t.includes('u'),'rótulo do vetor u');
  assert.match(String(byId('canvas-description').textContent),/Vista 3D/);
  // The function row says it is not drawn in the 3D view.
  assert.ok(created.some(el=>/não aparece na vista 3D/.test(String(el.textContent||''))));

  // Dragging on the canvas orbits the camera (0.4°/px) and is saved.
  cv().fire('pointerdown',{clientX:400,clientY:300});
  cv().fire('pointermove',{clientX:425,clientY:300});
  cv().fire('pointerup',{clientX:425,clientY:300});
  await settle();
  assert.equal(saved.view3d.mode,'3d');
  assert.equal(saved.view3d.camera.azimuth,-70);
  assert.equal(saved.equations[0].text,'ponto: A=(1,2,3)');
});

test('na vista 2D um ponto 3D não é desenhado, não é selecionável e não é arrastado',async()=>{
  await boot({version:1,theme:'light',view:{cx:0,cy:0,scale:60},
    view3d:{mode:'2d'},
    equations:[mk(0,'ponto: A=(1,2,3)'),mk(1,'ponto: B=(-1,-2)')]});
  assert.ok(!texts().includes('z'),'sem desenho 3D na vista 2D');
  assert.ok(created.some(el=>/objeto 3D: abra a vista 3D/.test(String(el.textContent||''))));
  // A sits at (460, 180) in the 2D view; dragging there must pan, not move A.
  cv().fire('pointerdown',{clientX:460,clientY:180});
  cv().fire('pointermove',{clientX:500,clientY:220});
  cv().fire('pointerup',{clientX:500,clientY:220});
  await settle();
  assert.equal(saved.equations[0].text,'ponto: A=(1,2,3)');
  assert.notEqual(saved.view.cx,0,'o gesto virou deslocamento da vista');
  // Control: the 2D point B (now at 380, 440 after the pan) is still draggable.
  const bx=400+(-1-saved.view.cx)*60, by=300-(-2-saved.view.cy)*60;
  cv().fire('pointerdown',{clientX:bx,clientY:by});
  cv().fire('pointermove',{clientX:bx+60,clientY:by});
  cv().fire('pointerup',{clientX:bx+60,clientY:by});
  await settle();
  assert.match(saved.equations[1].text,/^ponto: B=\(0,-2\)$/);
  assert.equal(saved.equations[0].text,'ponto: A=(1,2,3)');
});

test('estado v1 antigo sem view3d continua igual (vista 2D, nada de 3D)',async()=>{
  await boot({version:1,theme:'light',view:{cx:0,cy:0,scale:60},equations:[
    mk(0,'ponto: A=(0,0), B=(3,4)'),mk(1,'dist: A,B'),mk(2,'conica: x^2 + y^2 = 4'),mk(3,'matriz: [a,b; c,d]')
  ]});
  assert.ok(!texts().includes('z'));
  assert.doesNotMatch(String(byId('canvas-description').textContent),/Vista 3D/);
  cv().fire('pointerdown',{clientX:650,clientY:500});
  cv().fire('pointermove',{clientX:680,clientY:500});
  cv().fire('pointerup',{clientX:680,clientY:500});
  await settle();
  assert.deepEqual(saved.equations.map(e=>e.text),['ponto: A=(0,0), B=(3,4)','dist: A,B','conica: x^2 + y^2 = 4','matriz: [a,b; c,d]']);
  assert.equal(saved.view.cx,-0.5);
  assert.equal(saved.view3d?.mode ?? '2d','2d');
});

test('estado sem view3d mas com objeto 3D abre na vista 3D',async()=>{
  await boot({version:1,theme:'dark',view:{cx:0,cy:0,scale:60},equations:[mk(0,'ponto: A=(1,2,3)')]});
  assert.ok(texts().includes('z'));
});
