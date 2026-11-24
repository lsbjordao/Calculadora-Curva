import test from 'node:test';
import assert from 'node:assert/strict';
import {createMathInspector} from '../src/math-inspector.js';

class ElementStub {
  constructor(tag='div'){
    this.tagName=tag;this.children=[];this.hidden=false;this.attributes={};
    this.listeners=new Map();this._textContent='';
    this.subnodes={};
  }
  get textContent(){return this._textContent;}
  set textContent(value){this._textContent=String(value);this.children=[];}
  querySelector(selector){return this.subnodes[selector]||null;}
  appendChild(child){this.children.push(child);return child;}
  setAttribute(key,value){this.attributes[key]=String(value);}
  addEventListener(name,fn){this.listeners.set(name,fn);}
  click(){this.listeners.get('click')?.({});}
}
test('inspetor não obstrui o gráfico e seleciona dois planos via Shift',()=>{
  const originalDocument=globalThis.document;
  globalThis.document={createElement:tag=>new ElementStub(tag)};
  try{
    const panel=new ElementStub(),toggle=new ElementStub('button');
    const title=new ElementStub(),body=new ElementStub(),close=new ElementStub();
    panel.subnodes={'#math-inspector-title':title,
      '#math-inspector-body':body,'#math-inspector-close':close};
    const eq1={id:10,kind:'geometry',name:'Plano A',text:'plano: z=0',
      geometry:{info:['Plano A'],scene3d:[{kind:'plane',role:'main',n:[0,0,1],d:0}]}};
    const eq2={id:20,kind:'geometry',name:'Plano B',text:'plano: z=2',
      geometry:{info:['Plano B'],scene3d:[{kind:'plane',role:'main',n:[0,0,-1],d:-2}]}};
    const inserted=[];
    const inspector=createMathInspector({panel,toggle,getEquations:()=>[eq1,eq2],
      onInsert:command=>inserted.push(command)});
    inspector.select(eq1);
    assert.equal(panel.hidden,true,'a seleção sozinha não deve abrir o painel');
    toggle.click();
    assert.equal(panel.hidden,false);
    inspector.select(eq2,true);
    assert.equal(title.textContent,'Comparar objetos');
    assert.equal(inspector.has(10),true);
    assert.equal(inspector.has(20),true);
    assert.ok(body.children.some(item=>item.textContent.includes('Distância entre planos: 2')));
    inspector.select(eq1);
    assert.equal(inspector.has(20),false);
    close.click();
    assert.equal(panel.hidden,true);
  } finally {globalThis.document=originalDocument;}
});
test('inspetor contextual insere plano tangente sem mudar função original',()=>{
  const orig=globalThis.document;
  globalThis.document={createElement:tag=>new ElementStub(tag)};
  try{
    const panel=new ElementStub(),toggle=new ElementStub('button');
    const title=new ElementStub(),body=new ElementStub();
    panel.subnodes={'#math-inspector-title':title,'#math-inspector-body':body};
    const eq={id:1,text:'funcao3d: z=x^2-y^2',name:'Sela',
      geometry:{info:['P=(1,2,-3)'],
        multivar:{calc:{point:[1,2,-3],gradient:[2,-4]}}}};
    const inserted=[];
    const inspector=createMathInspector({panel,toggle,getEquations:()=>[eq],
      onInsert:value=>inserted.push(value)});
    inspector.select(eq);toggle.click();
    const action=body.children.find(x=>x.tagName==='button');
    assert.ok(action);
    action.click();
    assert.equal(inserted.length,1);
    assert.match(inserted[0],/^plano: z = /);
    assert.equal(eq.text,'funcao3d: z=x^2-y^2');
  }finally{globalThis.document=orig;}
});
