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
  const classes=new Set();
  const store={ id, dataset:{}, style:{}, listeners, children:[],
    classList:{
      toggle(name,force){
        const active=force===undefined ? !classes.has(name) : force;
        if(active) classes.add(name); else classes.delete(name);
        return active;
      },
      add(...names){ names.forEach(name=>classes.add(name)); },
      remove(...names){ names.forEach(name=>classes.delete(name)); },
      contains(name){ return classes.has(name); }
    },
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
        // Real DOM textContent aggregates descendant text nodes. The multiline
        // info renderer appends strong/span children instead of using a flat
        // textContent assignment, so the boot stub must model that behavior.
        case 'textContent': return t.children.map(child=>
          typeof child==='string'?child:String(child?.textContent??'')).join('');
        case 'appendChild': case 'append': return (...c)=>{ t.children.push(...c); return c[0]; };
        case 'replaceChildren': return (...c)=>{ t.children=[...c]; delete t.textContent; };
        case 'cloneNode': return ()=>makeEl();
        case 'contains': case 'matches': return ()=>false;
        default: return ()=>{};
      }
    },
    set(t,prop,val){
      if(prop==='textContent'){
        // Writing textContent replaces descendants in browsers.
        t.children=[{textContent:String(val??'')}];
        delete t.textContent;
        return true;
      }
      t[prop]=val;return true;
    }
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
async function boot(state, search='', prefersDark=false){
  calls=[]; elements=new Map(); created=[]; saved=null; stored=state; ctx=recordingCtx();
  document.body=makeEl('body');
  window.location={search};
  window.matchMedia=query=>({matches:query==='(prefers-color-scheme: dark)'&&prefersDark});
  await import('../src/app.js?boot='+(++bootN));
  await wait(20);
}
const texts=()=>calls.filter(c=>c[0]==='fillText').map(c=>String(c[1]));
const cv=()=>byId('cv');
// The persisted state is written by the 120 ms debounced save.
const settle=()=>wait(220);

const descendantText=node=>{
  if(node==null)return '';
  if(typeof node==='string')return node;
  if(Array.isArray(node.children)&&node.children.length)
    return node.children.map(descendantText).join('');
  return typeof node.textContent==='string'?node.textContent:'';
};
const fields=()=>created.filter(el=>el.className==='field');
const scalars=()=>created.filter(el=>el.className==='row-info')
  .flatMap(el=>el.children.filter(child=>child.className==='algebra-scalar').map(child=>child.textContent));
const urlFor=commands=>'?'+new URLSearchParams(commands.map(cmd=>['cmd',cmd]));

test('URL respeita o tema salvo mesmo quando o sistema prefere outro tema',async()=>{
  for(const theme of ['dark','light']){
    await boot({version:1,theme,equations:[mk(0,'sin(x)')]},urlFor(['calc: 2+3']),theme==='light');
    assert.equal(document.body.classList.contains('dark'),theme==='dark');
    assert.equal(byId('theme').title,theme==='dark' ? 'Ativar tema claro' : 'Ativar tema escuro');
    assert.deepEqual(fields().map(el=>el.value),['calc: 2+3']);
    assert.deepEqual(scalars(),['5']);
  }
});

test('sem tema salvo a inicialização segue o tema do sistema, com e sem URL',async()=>{
  for(const prefersDark of [true,false]){
    for(const search of ['',urlFor(['calc: 2+3'])]){
      await boot(null,search,prefersDark);
      assert.equal(document.body.classList.contains('dark'),prefersDark);
    }
  }
  await boot({version:1,theme:'invalid',equations:[mk(0,'sin(x)')]},urlFor(['calc: 2+3']),true);
  assert.equal(document.body.classList.contains('dark'),true);
});

test('tema escolhido em uma URL é salvo e respeitado ao abrir outro link',async()=>{
  await boot(null,urlFor(['calc: 2+3']));
  byId('theme').onclick();
  assert.equal(document.body.classList.contains('dark'),true);
  await settle();
  assert.equal(saved.theme,'dark');
  await boot(saved,urlFor(['calc: 6+1']));
  assert.equal(document.body.classList.contains('dark'),true);
  assert.deepEqual(fields().map(el=>el.value),['calc: 6+1']);
  assert.deepEqual(scalars(),['7']);
});

test('URL executa os comandos na ordem, resolve referências e substitui a cena salva',async()=>{
  const commands=[
    'ponto: A=(-2,3), B=(4,-5)',
    'dist: A,B',
    'calc: ((-2)+4)/2',
    'calc: (3+(-5))/2',
    'calc: sqrt(2^2 + 3^2 + 6^2)'
  ];
  await boot({version:1,view:{cx:1000,cy:1000,scale:1},view3d:{mode:'3d'},
    equations:[mk(0,'ponto: A=(0,0), B=(30,40)')]},urlFor(commands));
  assert.deepEqual(fields().map(el=>el.value),commands);
  assert.deepEqual(scalars(),['1','-1','7']);
  assert.ok(created.some(el=>el.className==='row-info-line'&&/d\(A, B\) = 10\b/.test(descendantText(el))));
  assert.ok(created.filter(el=>el.className==='row').every(el=>el.dataset.err==='0'));
  assert.ok(texts().includes('A'),'ponto da URL visível na cena padrão');
  assert.ok(!texts().includes('z'),'vista 3D salva não contamina a URL 2D');
});

test('URL preserva sinais de igual, soma, Unicode e repetições sem decodificar duas vezes',async()=>{
  await boot(null,'?cmd=ponto%3A+A%3D%28-2%2C3%29%2C+B%3D%284%2C-5%29'+
    '&cmd=calc%3A+2%2B3&cmd=calc%3A+2%2B3&cmd=calc%3A+%CF%80'+
    '&cmd=calc%3A+%252B%26%23&ignored=calc%3A+999');
  assert.deepEqual(fields().map(el=>el.value),[
    'ponto: A=(-2,3), B=(4,-5)','calc: 2+3','calc: 2+3','calc: π','calc: %2B&#'
  ]);
  assert.deepEqual(scalars(),['5','5','3.141592654']);
});

test('comando inválido na URL mostra erro na linha e permite os demais cálculos',async()=>{
  await boot(null,urlFor(['calc: sqrt(','calc: 6+1']));
  assert.deepEqual(created.filter(el=>el.className==='row').map(el=>el.dataset.err),['1','0']);
  assert.ok(created.some(el=>el.className==='row-info'&&typeof el.textContent==='string'&&el.textContent.length>0));
  assert.deepEqual(scalars(),['7']);
});

test('parâmetros cmd vazios são ignorados sem mudar a restauração da sessão',async()=>{
  const state={version:1,equations:[mk(0,'calc: 40+2')]};
  for(const search of ['', '?ignored=calc%3A+999', '?cmd=&cmd=++%0A']){
    await boot(state,search);
    assert.deepEqual(fields().map(el=>el.value),['calc: 40+2']);
    assert.deepEqual(scalars(),['42']);
  }
  await boot(null,'?cmd=&cmd=+');
  assert.deepEqual(fields().map(el=>el.value),['sin(x)']);
  await boot(null,'?cmd=&cmd=calc%3A+8%2B1&cmd=+');
  assert.deepEqual(fields().map(el=>el.value),['calc: 8+1']);
  assert.deepEqual(scalars(),['9']);
});

test('linhas da URL continuam editáveis, recalculam dependentes e salvam normalmente',async()=>{
  await boot(null,urlFor(['ponto: A=(0,0), B=(3,4)','dist: A,B']));
  const [points]=fields();
  points.value='ponto: A=(0,0), B=(6,8)';
  points.oninput();
  assert.ok(created.some(el=>el.className==='row-info-line'&&/d\(A, B\) = 10\b/.test(descendantText(el))));
  await settle();
  assert.deepEqual(saved.equations.map(eq=>eq.text),['ponto: A=(0,0), B=(6,8)','dist: A,B']);
});

test('comandos 3D na URL selecionam automaticamente a vista 3D',async()=>{
  await boot({version:1,view3d:{mode:'2d'},equations:[mk(0,'sin(x)')]},urlFor(['ponto: A=(1,2,3)']));
  assert.deepEqual(fields().map(el=>el.value),['ponto: A=(1,2,3)']);
  assert.ok(texts().includes('z'));
  assert.match(String(byId('canvas-description').textContent),/Vista 3D/);
});

test('controles dos eixos 3D alternam entre limite manual e extensão automática',async()=>{
  await boot({version:1,view3d:{mode:'3d',autoAxisRange:false,axisRange:12},
    equations:[mk(0,'ponto: A=(21,0,0)')]});
  const range=byId('view-axis-range');
  const auto=byId('view-axis-auto');
  assert.equal(range.value,'12');
  assert.equal(range.disabled,false);
  assert.equal(auto.checked,false);

  auto.checked=true;
  auto.fire('change');
  await wait(20);
  assert.equal(range.value,'25');
  assert.equal(range.disabled,true);
  assert.equal(auto.checked,true);
  await settle();
  assert.equal(saved.view3d.autoAxisRange,true);
  assert.equal(saved.view3d.axisRange,12);
});

test('grade 3D pode ser ocultada e os eixos podem exibir cada unidade',async()=>{
  await boot({version:1,view3d:{mode:'3d'},equations:[mk(0,'ponto: A=(1,2,3)')]});
  const grid=byId('grid-mode');
  assert.equal(grid.dataset.on,'0');
  assert.equal(grid.title,'Mostrar grade 3D');
  grid.onclick();
  await wait(20);
  assert.equal(grid.dataset.on,'1');
  assert.equal(grid.title,'Ocultar grade 3D');

  const ticks=byId('view-axis-ticks');
  assert.equal(ticks.value,'auto');
  ticks.value='1';
  ticks.fire('change');
  await wait(20);
  assert.equal(ticks.value,'1');
  await settle();
  assert.equal(saved.view3d.grid,true);
  assert.equal(saved.view3d.axisTickStep,'1');

  grid.onclick();
  await wait(20);
  assert.equal(grid.dataset.on,'0');
  assert.equal(grid.title,'Mostrar grade 3D');
});

test('estado salvo com objeto 3D e view3d 3D inicializa e desenha a cena 3D',async()=>{
  await boot({version:1,theme:'light',view:{cx:0,cy:0,scale:60},
    view3d:{mode:'3d',camera:{azimuth:-60,elevation:25,projection:'ortho',zoom:1}},
    equations:[mk(0,'ponto: A=(1,2,3)'),mk(1,'vetor: u=(2,-1,3)'),mk(2,'sin(x)')]});
  const t=texts();
  assert.ok(t.includes('z'),'nome do eixo z desenhado');
  assert.ok(t.includes('A'),'rótulo do ponto A');
  assert.ok(t.includes('u'),'rótulo do vetor u');
  assert.match(String(byId('canvas-description').textContent),/Vista 3D/);
  assert.equal(cv().style.cursor,'grab','cursor de mão já ao carregar na vista 3D');
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

test('chip guias: ligado por padrão na linha de ponto 3D, ausente nas linhas 2D, salvo no estado',async()=>{
  await boot({version:1,theme:'light',view:{cx:0,cy:0,scale:60},view3d:{mode:'3d'},
    equations:[mk(0,'ponto: A=(1,2,3)'),mk(1,'ponto: B=(1,2)')]});
  const chips=created.filter(el=>el.textContent==='guias');
  assert.equal(chips.length,1);
  assert.equal(chips[0].dataset.on,'1');
  // Default: the guide segments are drawn (dashed) for A.
  assert.ok(calls.some(c=>c[0]==='setLineDash'&&Array.isArray(c[1])&&c[1].length));
  chips[0].onclick();
  assert.equal(chips[0].dataset.on,'0');
  await settle();
  assert.equal(saved.equations[0].showGeoGuides,false);
  assert.equal(saved.equations[1].showGeoGuides,undefined);
  // The row title is left empty so the placeholder shows the computed name.
  assert.ok(!created.some(el=>el.className==='row-name'&&el.value));
  assert.ok(created.some(el=>el.className==='row-name'&&el.placeholder==='Geometria 1'));
});

test('ao entrar na vista 3D o modo anotação é desligado e o cursor vira mão',async()=>{
  await boot({version:1,theme:'light',view:{cx:0,cy:0,scale:60},view3d:{mode:'2d'},
    equations:[mk(0,'ponto: A=(1,2,3)')]});
  byId('annotate').onclick();
  byId('view-mode').onclick();
  await wait(20);
  assert.equal(byId('cv').style.cursor,'grab');
  assert.match(String(byId('cv').title||''),/arraste para girar/);
  // Annotation mode is off: a click on the canvas orbits instead of opening a note.
  cv().fire('pointerdown',{clientX:400,clientY:300});
  cv().fire('pointermove',{clientX:410,clientY:300});
  cv().fire('pointerup',{clientX:410,clientY:300});
  await settle();
  assert.equal(saved.view3d.camera.azimuth,-64);
  byId('view-mode').onclick();
  await wait(20);
  assert.notEqual(byId('cv').style.cursor,'grab');
  // Back in 2D the annotation mode stays off: a drag pans instead of opening a note.
  cv().fire('pointerdown',{clientX:650,clientY:500});
  cv().fire('pointermove',{clientX:680,clientY:500});
  cv().fire('pointerup',{clientX:680,clientY:500});
  await settle();
  assert.equal(saved.view.cx,-0.5);
});


test('preset Análise de cônicas alterna 2D → 3D → 2D → 3D sem esconder o botão',async()=>{
  await boot({version:1,theme:'light',view3d:{mode:'3d'},equations:[mk(0,'ponto: A=(1,2,3)')]});
  const preset=byId('preset-list'),load=byId('preset-load'),toggle=byId('view-mode');
  preset.value='conic-analysis';
  load.onclick();
  await wait(40);
  assert.equal(toggle.hidden,false);
  assert.equal(toggle.dataset.mode,'2d','um preset 2D substituto deve iniciar em 2D');
  assert.deepEqual(fields().slice(-4).map(x=>x.value),[
    'conica: x^2 + y^2 = 4',
    'conica: x^2/9 + y^2/4 = 1',
    'conica: x^2 - y^2 = 1',
    'conica: y = x^2/2'
  ],'preset de cônicas substitui as linhas anteriores');
  toggle.onclick();
  await wait(40);
  assert.equal(toggle.dataset.mode,'3d');
  toggle.onclick();
  await wait(40);
  assert.equal(toggle.dataset.mode,'2d');
  assert.equal(toggle.hidden,false,'o controle não pode desaparecer após voltar para 2D');
  toggle.onclick();
  await wait(40);
  assert.equal(toggle.dataset.mode,'3d');
  await settle();
  assert.equal(saved.view3d.mode,'3d');
});

test('controle 3D continua disponível mesmo sem objeto espacial',async()=>{
  await boot({version:1,theme:'light',view3d:{mode:'2d'},equations:[mk(0,'sin(x)')]});
  const button=byId('view-mode');
  assert.equal(button.hidden,false);
  button.onclick();
  await wait(25);
  assert.equal(button.dataset.mode,'3d');
  button.onclick();
  await wait(25);
  assert.equal(button.dataset.mode,'2d');
  assert.equal(button.hidden,false);
});
