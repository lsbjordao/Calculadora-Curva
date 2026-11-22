import test from 'node:test';
import assert from 'node:assert/strict';
import {
  encodeProjectDocument,decodeProjectDocument,projectFilename,
  CURVA_PROJECT_FORMAT,CURVA_PROJECT_VERSION,MAX_PROJECT_BYTES
} from '../src/project-file.js';

const sample=()=>({
  theme:'light',gridMode:'linear',sideWidth:340,
  view:{cx:1.5,cy:-2,scale:62},
  view3d:{mode:'3d',camera:{azimuth:-40,elevation:25,projection:'ortho',target:[1,2,3],zoom:1.2}},
  equations:[
    {text:'conica: x^2/9 + y^2/4 = 1',ci:0,visible:true,style:'dashed'},
    {text:'calc: solveinfo([[1,0,0],[0,1,0],[0,0,1]],[2,3,4])',ci:1,showAlgebraSystem:true}
  ],
  annotations:[{id:1,x:1,y:2,text:'Elipse',color:'#abc123'}],
  lessonProgress:{}
});
test('projeto salva e recupera equações, vista 3D e câmera',()=>{
  const state=sample();
  const text=encodeProjectDocument(state,{title:'Cônicas e sistemas',now:new Date('2026-11-22T10:00:00.000Z')});
  const payload=JSON.parse(text);
  assert.equal(payload.format,CURVA_PROJECT_FORMAT);
  assert.equal(payload.version,CURVA_PROJECT_VERSION);
  assert.equal(payload.title,'Cônicas e sistemas');
  assert.deepEqual(decodeProjectDocument(text),{title:'Cônicas e sistemas',state});
  assert.match(projectFilename(new Date('2026-11-22T10:00:00.000Z')),/2026-11-22\.json/);
});
test('projeto rejeita arquivos inválidos, versões futuras e excesso de tamanho',()=>{
  assert.throws(()=>decodeProjectDocument(''),/JSON/);
  assert.throws(()=>decodeProjectDocument('{}'),/projeto da Calculadora Curva/);
  const s=sample();
  const valid=JSON.parse(encodeProjectDocument(s));
  assert.throws(()=>decodeProjectDocument(JSON.stringify({...valid,version:300})),/não suportada/);
  assert.throws(()=>decodeProjectDocument(' '.repeat(MAX_PROJECT_BYTES+1)),/2 MB/);
  assert.throws(()=>encodeProjectDocument({...s,view3d:{mode:'corrupt'}}),/vista 3D/);
  assert.throws(()=>encodeProjectDocument({...s,equations:[{notText:3}]}),/linhas/);
});
test('projeto não avalia expressões e preserva fórmulas como texto',()=>{
  const state=sample();
  state.equations[0].text='calc: 1+2;alert("não executar")';
  const decoded=decodeProjectDocument(encodeProjectDocument(state));
  assert.equal(decoded.state.equations[0].text,state.equations[0].text);
  assert.equal(decoded.state.equations.length,2);
});
