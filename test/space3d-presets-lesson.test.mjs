import assert from 'node:assert/strict';
import test from 'node:test';

import { PRESETS } from '../src/presets.js';
import { LESSONS, checkpointComplete } from '../src/lessons.js';
import { addGeometryDefinitions, parseGeometryInput } from '../src/geometry.js';
import { compile } from '../src/parser.js';
import { resultInfo } from '../src/algebra-ui.js';
import { createAlgebraSymbols } from '../src/algebra-symbols.js';

// GC: the "Espaço" presets group and the "Espaço (ℝ³)" lesson.

// Equation objects as the app builds them (enough for the lesson checks).
function compileScene(equations,override=[]){
  const registry=new Map(), symbols=createAlgebraSymbols(equations).resolve;
  return equations.map((entry,i)=>{
    const params={...(entry.params||{}),...(override[i]||{})};
    if(entry.text.startsWith('calc:')){
      const value=compile(entry.text.slice(5),params,{},symbols)(0);
      return {kind:'result',text:entry.text,params,algebraResult:resultInfo(value)};
    }
    const geometry=parseGeometryInput(entry.text,{params,registry,symbols});
    assert.ok(geometry,'linha não reconhecida: '+entry.text);
    assert.ok(!geometry.error,entry.text+' → '+geometry.error);
    addGeometryDefinitions(registry,geometry);
    return {kind:'geometry',text:entry.text,params,geometry,error:false};
  });
}

const SPACE=['space-vectors-cross','space-sum','space-parallelepiped','spatial-constructions-3d','space-three-planes',
  'space-line-positions','space-quadrics-book','space-cone-sections','space-transform-3x3','space-span'];

test('the Espaço group covers the book topics and every line parses (visible or not)', ()=>{
  const group=PRESETS.filter(p=>p.category==='Espaço');
  assert.deepEqual(group.map(p=>p.id).sort(),[...SPACE].sort());
  for(const preset of group){
    assert.ok(preset.description,preset.id);
    const eqs=compileScene(preset.equations);
    assert.equal(eqs.length,preset.equations.length);
    // The first visible line is 3D (the preset opens the 3D view).
    const first=eqs.find((_,i)=>preset.equations[i].visible!==false);
    assert.ok(first.geometry?.dim===3||first.algebraResult?.kind==='solveinfo',preset.id);
  }
  // Main's existing 3D construction preset was moved into the group, not duplicated.
  assert.equal(PRESETS.filter(p=>p.equations.some(e=>e.text==='intersecao: plano(x+y+z=1); reta((0,0,0),(1,1,1))')).length,1);
});

test('Espaço presets show what their names promise', ()=>{
  const get=id=>{ const p=PRESETS.find(x=>x.id===id); return {p,eqs:compileScene(p.equations)}; };
  const info=eq=>(eq.geometry?.info||[]).join(' · ');
  assert.match(info(get('space-vectors-cross').eqs[2]),/área = 7\.34847/);
  assert.match(info(get('space-parallelepiped').eqs[1]),/volume = 1/);
  assert.match(info(get('space-parallelepiped').eqs[2]),/coplanares/);
  const planes=get('space-three-planes').eqs.map(e=>e.algebraResult.metadata.classification);
  assert.deepEqual(planes,['unique','infinite','infinite','inconsistent']);
  const pos=get('space-line-positions').eqs;
  assert.match(info(pos[2]),/reversas/);
  assert.match(info(pos[3]),/perpendicular comum/);
  assert.match(info(pos[5]),/paralelas/);
  const types=get('space-cone-sections').eqs.slice(1).map(e=>e.geometry.section.analysis.type);
  assert.deepEqual(types,['circle','ellipse','parabola','hyperbola','two-lines']);
  const quad=get('space-quadrics-book').eqs.map(e=>e.geometry.generalQuadric.classification.type);
  assert.deepEqual(quad,['Elipsoide','Hiperboloide de uma folha','Hiperboloide de duas folhas','Paraboloide elíptico','Paraboloide hiperbólico (sela)','Hiperboloide de uma folha']);
  const tr=get('space-transform-3x3').eqs;
  assert.deepEqual(tr[0].geometry.scene3d.filter(p=>p.eigen&&p.kind==='label').map(p=>p.text),['λ = 1','λ = 3','λ = 3']);
  assert.match(info(tr[2]),/orientação invertida/);
  assert.match(info(tr[3]),/colapsa num plano/);
  assert.deepEqual(get('space-span').eqs.map(e=>e.geometry.info.find(x=>/^posto/.test(x))),['posto 1','posto 2','posto 1','posto 2','posto 3']);
});

const REFERENCE=[[{a:3}],[{a:1}],[{k:1}],[{c:-1}],[{},{k:1}],[{a:3}],[{a:0}]];

test('the Espaço lesson: 7 steps whose checkpoints fail at the start and pass at the reference values', ()=>{
  const lesson=LESSONS.find(l=>l.id==='space-r3');
  assert.ok(lesson,'aula Espaço');
  assert.equal(lesson.label,'Espaço (ℝ³)');
  assert.ok(lesson.steps.length>=5&&lesson.steps.length<=7);
  lesson.steps.forEach((step,i)=>{
    const start=compileScene(step.scene.equations);
    assert.equal(checkpointComplete(step,start,0),false,step.title+' (início)');
    const done=compileScene(step.scene.equations,REFERENCE[i]);
    assert.equal(checkpointComplete(step,done,0),true,step.title+' (referência)');
    assert.equal(step.checkpoints.at(-1).check.type,'ack');
  });
});
