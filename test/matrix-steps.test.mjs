import test from 'node:test';
import assert from 'node:assert/strict';
import {det,matmul,inv} from '../src/linear-algebra.js';
import {buildMatrixSteps} from '../src/matrix-steps.js';
import {matrixWalkthroughFromEquation,isMatrixWalkthroughCandidate} from '../src/matrix-steps-adapter.js';

const near=(a,b,epsilon=1e-8)=>{
  if(Array.isArray(a)){assert.ok(Array.isArray(b));assert.equal(a.length,b.length);a.forEach((x,i)=>near(x,b[i],epsilon));}
  else assert.ok(Math.abs(a-b)<epsilon, 'esperado '+b+', obtido '+a);
};
test('determinante 2×2 explica diagonais e sinal',()=>{
  const A=[[3,4],[1,2]],model=buildMatrixSteps({operation:'det',operands:[A]});
  assert.equal(model.result,2);
  assert.equal(model.method,'Diagonais');
  assert.equal(model.stages.length,3);
  assert.deepEqual(model.stages[0].matrices[0].focusCells,[[0,0],[1,1]]);
  assert.deepEqual(model.stages[1].matrices[0].focusCells,[[0,1],[1,0]]);
  assert.match(model.stages.at(-1).formula,/2/);
});
test('Sarrus, Laplace e eliminação concordam para matrizes 3×3',()=>{
  for(const A of [
    [[1,2,3],[0,1,4],[5,6,0]],
    [[0,2,0],[1,0,3],[2,1,1]],
    [[1,-2,2],[2,-4,4],[0,1,3]],
    [[-2,5,1],[4,-1,2],[3,0,7]]
  ]){
    const original=structuredClone(A);
    const expected=det(A);
    for(const method of ['Sarrus','Cofatores','Eliminação']){
      const m=buildMatrixSteps({operation:'det',operands:[A],method});
      near(m.result,expected);
      assert.equal(m.method,method);
      assert.ok(m.stages.length>=4);
      assert.equal(m.stages.at(-1).matrices.at(-1).scalar,expected);
    }
    assert.deepEqual(A,original,'o modelo nunca altera a entrada');
  }
});
test('determinante 4×4 usa eliminação sem tentar Sarrus',()=>{
  const A=[[1,2,0,3],[0,2,1,4],[0,0,3,1],[0,0,0,2]];
  const m=buildMatrixSteps({operation:'det',operands:[A]});
  assert.deepEqual(m.methods,['Eliminação']);
  near(m.result,12);
  assert.match(m.stages.at(-1).description,/triangular/);
});
test('produto AB mostra linha, coluna, entrada de saída e fórmula',()=>{
  const A=[[1,2],[3,4]],B=[[2,0],[1,2]];
  const m=buildMatrixSteps({operation:'matmul',operands:[A,B]});
  near(m.result,matmul(A,B));
  assert.equal(m.stages.length,6);
  assert.equal(m.stages[1].matrices[0].focusRow,0);
  assert.equal(m.stages[1].matrices[1].focusCol,0);
  assert.deepEqual(m.stages[1].matrices[2].focusCells,[[0,0]]);
  assert.match(m.stages[1].formula,/1 × 2/);
  assert.equal(m.stages[1].matrices[2].values[0][0],4);
  assert.equal(m.stages[1].matrices[2].values[1][1],0);
});
test('inversa forma [A|I] e converge para [I|A^-1]',()=>{
  const A=[[2,1],[1,3]],m=buildMatrixSteps({operation:'inv',operands:[A]});
  near(m.result,inv(A));
  assert.equal(m.stages[0].matrices[0].augmentedAt,2);
  const last=m.stages.at(-1);
  near(last.matrices[1].values,inv(A));
  near(last.matrices[0].values.map(row=>row.slice(0,2)),[[1,0],[0,1]]);
});
test('Gauss–Jordan trata permutação de linhas e matriz aumentada',()=>{
  const m=buildMatrixSteps({operation:'rrefinfo',operands:[[[0,1,2],[1,1,3]]]});
  near(m.result,[[1,0,1],[0,1,2]]);
  assert.ok(m.stages.some(s=>s.formula.includes('↔')));
  const sys=buildMatrixSteps({operation:'solveinfo',operands:[[[1,1],[2,2]],[2,5]]});
  assert.match(sys.stages.at(-1).description,/inconsistente/);
  assert.equal(sys.stages[0].matrices[0].augmentedAt,2);
});
test('operações elementares: soma, subtração, transposição, traço e escala',()=>{
  const A=[[1,2],[3,4]],B=[[5,6],[7,8]];
  near(buildMatrixSteps({operation:'matadd',operands:[A,B]}).result,[[6,8],[10,12]]);
  near(buildMatrixSteps({operation:'matsub',operands:[A,B]}).result,[[-4,-4],[-4,-4]]);
  near(buildMatrixSteps({operation:'transpose',operands:[A]}).result,[[1,3],[2,4]]);
  assert.equal(buildMatrixSteps({operation:'trace',operands:[A]}).result,5);
  near(buildMatrixSteps({operation:'scale',operands:[2,A]}).result,[[2,4],[6,8]]);
  assert.throws(()=>buildMatrixSteps({operation:'matmul',operands:[[[1,2,3]],[[1,2]]]}),/colunas de A/);
});
test('matriz sem operação destaca sucessivamente as colunas e relaciona volume',()=>{
  const model=buildMatrixSteps({operation:'matrix',operands:[[[2,0,0],[0,3,0],[0,0,-1]]]});
  assert.equal(model.stages.length,5);
  assert.equal(model.stages[2].matrices[0].focusCol,1);
  assert.match(model.stages.at(-1).description,/volume/i);
  assert.equal(model.stages.at(-1).matrices.at(-1).scalar,-6);
});
test('adaptador usa sintaxe e parâmetros reais do Curva, inclusive let e @',()=>{
  const resolve=name=>{
    if(name==='a')return [[1,2],[3,4]];
    throw Error('nome desconhecido');
  };
  for(const [source,kind] of [
    ['calc: det([[1,2,3],[0,1,4],[5,6,0]])','det'],
    ['calc: matmul([[1,2],[3,4]],[[2,0],[1,2]])','matmul'],
    ['calc: det(@a)','det'],
    ['let M = [[1,2],[3,4]]','matrix'],
    ['calc: [[1,2],[3,4]]','matrix'],
    ['calc: rrefinfo([[1,2],[3,4]])','rrefinfo']
  ]){
    const eq={text:source,kind:'result',error:false,algebraResult:{kind:'matrix',value:[[1,2],[3,4]]},params:{}};
    assert.ok(isMatrixWalkthroughCandidate(eq));
    const model=matrixWalkthroughFromEquation(eq,{resolve});
    assert.equal(model.operation,kind);
  }
  const parameter={text:'calc: det([[a,2],[3,4]])',kind:'result',error:false,params:{a:5}};
  near(matrixWalkthroughFromEquation(parameter).result,14);
  const geom={text:'matriz: [1,2; 3,4]',kind:'geometry',error:false,
    geometry:{matrix:{values:[[1,2],[3,4]]}}};
  assert.equal(matrixWalkthroughFromEquation(geom).operation,'matrix');
});
test('não fornece passos artificiais para expressão inválida ou operação não suportada',()=>{
  assert.equal(isMatrixWalkthroughCandidate({kind:'function',text:'x^2'}),false);
  assert.throws(()=>buildMatrixSteps({operation:'det',operands:[[[1,2,3]]]}) ,/quadrada/);
  assert.throws(()=>buildMatrixSteps({operation:'det',operands:[Array.from({length:11},()=>Array(11).fill(1))]}),/até 10/);
});
