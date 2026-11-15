import assert from 'node:assert/strict';
import test from 'node:test';
import { compile, extractParams, normalizeInput } from '../src/parser.js';
import { algebraDeclaration, createAlgebraSymbols } from '../src/algebra-symbols.js';
import { resultInfo, algebraSyntax, formatAlgebraNumber, renderAlgebraResult } from '../src/algebra-ui.js';
import { buildTransformScene, transformationMatrix, decomposeTransform, buildSystemScene } from '../src/linear-transform-view.js';
import { parseGeometryInput, addGeometryDefinitions } from '../src/geometry.js';
import { ALGEBRA_LESSONS } from '../src/algebra-lessons.js';
import { checkpointComplete } from '../src/lessons.js';

const close=(a,b)=>{
  if(Array.isArray(b)){assert.equal(a.length,b.length);b.forEach((x,i)=>close(a[i],x));}
  else assert.ok(Math.abs(a-b)<1e-9,`${a} ≉ ${b}`);
};
test('parser supports every public operation and both matrix literal formats',()=>{
  const examples={
    'dot([1,2,3],[4,5,6])':32,'norm([3,4])':5,'vadd([1,2],[3,4])':[4,6],
    'vsub([3,4],[1,2])':[2,2],'scale(2,[3,4])':[6,8],'angle([1,0],[0,1])':Math.PI/2,
    'proj([3,4],[1,0])':[3,0],'cross([1,0,0],[0,1,0])':[0,0,1],
    'matadd([1,2;3,4],eye(2))':[[2,2],[3,5]],'matsub([1,2;3,4],eye(2))':[[0,2],[3,3]],
    'matmul([[1,2],[3,4]],[[2,0],[1,2]])':[[4,4],[10,8]],'transpose([[1,2],[3,4]])':[[1,3],[2,4]],
    'det([[1,2],[3,4]])':-2,'trace([[1,2],[3,4]])':5,'inv([[1,2],[3,4]])':[[-2,1],[1.5,-.5]],
    'rank([[1,2],[2,4]])':1,'rref([[1,2],[2,4]])':[[1,2],[0,0]],'eye(2)':[[1,0],[0,1]],
    'zeros(2,3)':[[0,0,0],[0,0,0]],'frobenius([[3,0],[0,4]])':5,
    'linsolve([[2,1],[1,3]],[5,10])':[1,3],'eig([[2,0],[0,3]])':[2,3],
    'eigenvectors([[2,0],[0,3]])':[[1,0],[0,1]],'[[1,2,3]]':[[1,2,3]],'[[1],[2]]':[[1],[2]]
  };
  Object.entries(examples).forEach(([text,value])=>close(compile(text)(0),value));
  for(const [text,kind] of [
    ['solveinfo([[1,1],[2,2]],[1,2])','solveinfo'],['eiginfo([[2,1],[0,2]])','eiginfo'],
    ['lu([[0,2],[1,3]])','lu'],['qr([[1,2],[3,4],[5,6]])','qr'],
    ['svd([[2,1],[0,1]])','svd'],['pinv([[1,2],[2,4]])','pinv'],['lstsq([[1],[1]],[1,2])','lstsq']
  ]) assert.equal(compile(text)(0).kind,kind);
});
test('commas in scalar arguments remain separators, matrix parameters update reactively',()=>{
  assert.equal(normalizeInput('zeros(2,3)'),'zeros(2,3)');
  assert.equal(normalizeInput('scale(2,3)'),'scale(2,3)');
  assert.equal(compile('sin(1,5)')(0),Math.sin(1.5));
  const params={a:2,b:1}, fn=compile('matmul([a,b;0,1],eye(2))',params);
  close(fn(0),[[2,1],[0,1]]); params.b=3; close(fn(0),[[2,3],[0,1]]);
  assert.deepEqual(fn.inputShapes,[[2,2],[2,2]]);
  assert.deepEqual(extractParams('matmul([a,b;0,1],eye(2))'),['a','b']);
});
test('matrix literal and scalar coercion errors reach the caller',()=>{
  for(const text of ['[[1,2],[3]]','[1,,2]','[[1,2],]','[1,2]+[3,4]','2*[1,2]','[1]/2','-[1]','+[1]','[2]^2','sin([1])','piecewise([1]<[2],0,1)','piecewise([1],0,1)','sum(i,1,2,[1,2])','det([1,2])','dot([1],[1,2])','det([[sqrt(-1)]])','norm([1,2],3)'])
    assert.throws(()=>compile(text)(0),undefined,text);
});
test('named arrays resolve forward references, survive reorder and refresh after edits/removal',()=>{
  const rows=[{text:'let N = matmul(@M,eye(2))',params:{}},{text:'let M = [[a,0],[0,1]]',params:{a:2}}];
  const run=equations=>compile('det(@N)',{}, {},createAlgebraSymbols(equations).resolve)(0);
  assert.equal(run(rows),2);assert.equal(run([...rows].reverse()),2);
  rows[1].params.a=3;assert.equal(run(rows),3);
  rows[1].text='let M = [[4,0],[0,1]]';assert.equal(run(rows),4);
  assert.throws(()=>run(rows.slice(0,1)),{code:'UNKNOWN_SYMBOL'});
  assert.throws(()=>createAlgebraSymbols([{text:'let M = @N'},{text:'let N = @M'}]).resolve('m'),{code:'CYCLE'});
  assert.throws(()=>createAlgebraSymbols([{text:'let M = [1]'},{text:'let m = [2]'}]).resolve('m'),{code:'DUPLICATE'});
  assert.throws(()=>createAlgebraSymbols([{text:'let M = 2'}]).resolve('m'));
  assert.equal(algebraDeclaration('M = ponto(0,0)'),null);
  assert.equal(compile('m*x',{m:4})(2),8);
});
test('typed presentation and full precision syntax preserve values',()=>{
  assert.equal(resultInfo(32).kind,'scalar');assert.equal(resultInfo([1,2]).kind,'vector');
  const matrix=[[1/3,1e-15],[2,3]], info=resultInfo(matrix);
  assert.equal(info.kind,'matrix');assert.deepEqual(info.shape,[2,2]);assert.equal(info.metadata.rank,2);
  assert.deepEqual(compile(algebraSyntax(matrix))(0),matrix);
  assert.equal(formatAlgebraNumber(1e-15),'1e-15');assert.equal(formatAlgebraNumber(-0),'0');
  assert.throws(()=>resultInfo(NaN));
});
test('geometry uses the same eigenpairs as the numerical interpreter',()=>{
  const params={b:.5}, scene=parseGeometryInput('matriz: [1,b; 0,1]',{params});
  assert.deepEqual(scene.matrix.eigen.value,compile('eig([[1,b],[0,1]])',params)(0));
  assert.equal(scene.matrix.eigen.metadata.diagonalizable,false);
  params.b=2;const next=parseGeometryInput('matriz: [1,b; 0,1]',{params});assert.equal(next.vectors[1].to.x,2);
  assert.ok(parseGeometryInput('matriz: [0,-1; 1,0]').info.includes('autovalores complexos'));
  const symbols=createAlgebraSymbols([{text:'let M = [[2,1],[0,3]]'}]);
  assert.deepEqual(parseGeometryInput('matriz: @M',{symbols:symbols.resolve}).matrix.values,[[2,1],[0,3]]);
});
test('transformation and SVD stages show intermediate singularity and correct endpoints',()=>{
  const A=[[-1,0],[0,2]];
  close(transformationMatrix(A,0),[[1,0],[0,1]]);close(transformationMatrix(A,1),A);
  const middle=buildTransformScene(A,{t:.5});close(middle.matrix.det,0);
  assert.ok(middle.segments.length>20);assert.ok(middle.lines.length>0);
  assert.equal(buildTransformScene(A,{showOriginal:false,showTransformed:false}).segments.length,0);
  const complex=buildTransformScene([[0,-1],[1,0]]);assert.equal(complex.matrix.eigen,null);assert.ok(complex.info.some(s=>s.includes('complexos')));
  const B=[[2,1],[0,1]], f=decomposeTransform(B);
  close(transformationMatrix(B,1/3,f),f.Vt);
  close(transformationMatrix(B,1,f),B);
  const system=buildSystemScene([[1,1],[1,2]],[2,3],[1,1]);
  assert.deepEqual(system.lines.map(line=>[line.a,line.b,line.c]),[[1,1,-2],[1,2,-3]]);
  assert.equal(system.points[0].label,'solução');
});
test('all new lesson scenes execute and checkpoints inspect computed values',()=>{
  assert.equal(ALGEBRA_LESSONS.length,8);
  for(const lesson of ALGEBRA_LESSONS) for(const step of lesson.steps){
    const symbols=createAlgebraSymbols(step.scene.equations), registry=new Map();
    for(const eq of step.scene.equations){
      const declaration=algebraDeclaration(eq.text);
      if(declaration) symbols.resolve(declaration.name);
      else if(eq.text.startsWith('calc:')) resultInfo(compile(eq.text.slice(5),eq.params,{},symbols.resolve)(0));
      else {const g=parseGeometryInput(eq.text,{params:eq.params,symbols:symbols.resolve,registry});if(g){assert.ok(!g.error,g.error);addGeometryDefinitions(registry,g);}}
    }
  }
  const step=ALGEBRA_LESSONS.find(l=>l.id==='algebra-systems').steps[0];
  assert.equal(checkpointComplete(step,[{algebraResult:{metadata:{classification:'unique'}}}]),false);
  assert.equal(checkpointComplete(step,[{algebraResult:{metadata:{classification:'inconsistent'}}}]),true);
  assert.equal(checkpointComplete(step,[{error:true,algebraResult:{metadata:{classification:'inconsistent'}}}]),false);
});

test('result view exposes accessible matrices, factor labels and both copy formats',async()=>{
  function element(tag){return {tag,children:[],attributes:{},classList:{add(){}},append(...nodes){this.children.push(...nodes);},appendChild(node){this.children.push(node);return node;},replaceChildren(){this.children=[];},setAttribute(name,value){this.attributes[name]=value;}};}
  const previousDocument=globalThis.document, previousNavigator=globalThis.navigator;
  const copied=[];
  globalThis.document={createElement:element};globalThis.navigator={clipboard:{writeText:async text=>copied.push(text)}};
  try{
    const host=element('div');renderAlgebraResult(host,resultInfo([[1/3,2],[3,4]]));
    const all=node=>[node,...node.children.flatMap(all)], nodes=all(host);
    assert.ok(nodes.some(node=>node.tag==='table'));assert.ok(nodes.some(node=>node.tag==='caption'&&node.textContent.includes('2×2')));
    const buttons=nodes.filter(node=>node.tag==='button');await buttons[0].onclick();await buttons[1].onclick();
    assert.ok(copied[0].includes('\t'));assert.deepEqual(compile(copied[1])(0),[[1/3,2],[3,4]]);
    renderAlgebraResult(host,compile('svd([[1,2],[3,4]])')(0));
    assert.equal(all(host).filter(node=>node.tag==='table').length,3);
    assert.ok(all(host).some(node=>node.textContent==='A = U Σ Vᵀ'));
  }finally{globalThis.document=previousDocument;globalThis.navigator=previousNavigator;}
});
