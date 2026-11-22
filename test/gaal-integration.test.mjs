import test from 'node:test';
import assert from 'node:assert/strict';
import {unit,matpow,matmul,eye,rref,rrefinfo,solveinfo} from '../src/linear-algebra.js';
import {buildWorkbenchCommand} from '../src/algebra-workbench.js';
import {buildSystemScene3D} from '../src/linear-transform-view.js';
import {has3dObjects,scenePrimitives,autoAxisLimit,viewNotice} from '../src/space3d/view3d.js';

const close=(a,b,tol=1e-9)=>assert.ok(Math.abs(a-b)<tol,String(a)+' ≠ '+b);
const near=(A,B)=>{if(Array.isArray(A)){assert.equal(A.length,B.length);A.forEach((x,i)=>near(x,B[i]));}else close(A,B);};

test('unit calcula versor e rejeita vetor nulo',()=>{
  near(unit([3,4]),[.6,.8]);assert.throws(()=>unit([0,0]),/vetor nulo/);
});
test('matpow preserva identidade, potências negativas e inversa',()=>{
  const A=[[2,1],[0,2]];
  near(matpow(A,0),eye(2));
  near(matpow(A,3),[[8,12],[0,8]]);
  near(matmul(matpow(A,-1),A),eye(2));
  assert.throws(()=>matpow(A,1.5),/inteiro/);
  assert.throws(()=>matpow([[1,2],[2,4]],-1),/singular/i);
});
test('rrefinfo mantém a redução matemática e registra operações',()=>{
  const A=[[0,2,4],[1,3,5]];
  const r=rrefinfo(A);
  near(r.value,rref(A));
  assert.equal(r.metadata.rank,2);
  assert.ok(r.steps.some(x=>x.operation.includes('Trocar')));
  assert.ok(r.steps.some(x=>x.operation.includes('Normalizar')));
  assert.deepEqual(A,[[0,2,4],[1,3,5]]);
});
test('workbench produz comandos nativos da Curva',()=>{
  assert.equal(buildWorkbenchCommand('matrices','matmul',[[2,1],[1,3]],[[1,2],[3,4]]),
    'calc: matmul([[2,1],[1,3]],[[1,2],[3,4]])');
  assert.equal(buildWorkbenchCommand('vectors','unit',[[3,4]],[[2,1]]),'calc: unit([3,4])');
  assert.equal(buildWorkbenchCommand('systems','solveinfo',[[1,0,0],[0,1,0],[0,0,1]],[[1],[2],[3]]),
    'calc: solveinfo([[1,0,0],[0,1,0],[0,0,1]],[1,2,3])');
  assert.equal(buildWorkbenchCommand('systems','rrefinfo',[[1,0],[0,1]],[[5],[7]]),
    'calc: rrefinfo([[1,0,5],[0,1,7]])');
  assert.throws(()=>buildWorkbenchCommand('matrices','matmul',[[1,2]],[[1,2]]),/colunas/);
});
test('sistema 3x3 gera três planos e uma interseção',()=>{
  const A=[[1,0,0],[0,1,0],[0,0,1]],b=[2,3,4];
  const solution=solveinfo(A,b).value;
  near(solution,[2,3,4]);
  const scene=buildSystemScene3D(A,b,solution);
  assert.equal(scene.filter(x=>x.kind==='plane').length,3);
  assert.equal(scene.filter(x=>x.kind==='point').length,1);
  const eq={kind:'result',visible:true,error:false,showAlgebraSystem:true,systemScene3d:scene,text:'calc: solveinfo(...)'};
  assert.ok(has3dObjects([eq]));
  assert.equal(scenePrimitives([eq]).filter(x=>x.kind==='plane').length,3);
  assert.ok(autoAxisLimit([eq])>=5);
  assert.equal(viewNotice(eq,'3d'),'');
  const none=buildSystemScene3D(A,b,null);
  assert.ok(none.every(x=>x.kind!=='point'));
  assert.equal(has3dObjects([{...eq,showAlgebraSystem:false}]),false);
});
