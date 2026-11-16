import test from 'node:test';
import assert from 'node:assert/strict';
import * as la from '../src/linear-algebra.js';

export function close(actual, expected, tolerance = 1e-10) {
  if (Array.isArray(expected)) {
    assert.ok(Array.isArray(actual)); assert.equal(actual.length,expected.length);
    expected.forEach((x,i)=>close(actual[i],x,tolerance));
  } else assert.ok(Math.abs(actual-expected) <= tolerance*Math.max(1,Math.abs(expected)), `${actual} ≉ ${expected}`);
}
test('vector operations, zero norm and angles in radians',()=>{
  assert.equal(la.dot([1,2,3],[4,5,6]),32);
  assert.equal(la.norm([3,4]),5); assert.equal(la.norm([0,0]),0);
  assert.deepEqual(la.vadd([1,2],[3,4]),[4,6]);
  assert.deepEqual(la.vsub([4,6],[3,4]),[1,2]);
  assert.deepEqual(la.scale(2,[3,4]),[6,8]);
  assert.deepEqual(la.proj([3,4],[1,0]),[3,0]);
  close(la.angle([1,0],[0,1]),Math.PI/2);
  assert.deepEqual(la.cross([1,0,0],[0,1,0]),[0,0,1]);
  assert.equal(la.cross([1,0],[0,1]),1);
  close(la.angle([1e200,0],[1e200,0]),0);
  close(la.proj([3,4],[1e-200,0]),[3,0]);
});
test('deterministic matrix operations and legacy 3×3 determinant',()=>{
  const A=[[1,2],[3,4]], B=[[2,0],[1,2]];
  close(la.matmul(A,B),[[4,4],[10,8]]);
  close(la.matadd(A,B),[[3,2],[4,6]]); close(la.matsub(A,B),[[-1,2],[2,2]]);
  close(la.transpose(A),[[1,3],[2,4]]); assert.equal(la.trace(A),5); close(la.det(A),-2);
  close(la.det([[1,2,3],[0,1,4],[5,6,0]]),1);
  close(la.inv(A),[[-2,1],[1.5,-.5]]);
  assert.deepEqual(la.linsolve([[2,1],[1,3]],[5,10]),[1,3]);
  close(la.linsolve([[2,1],[1,3]],[[5],[10]]),[1,3]);
  assert.deepEqual(la.eye(3),[[1,0,0],[0,1,0],[0,0,1]]);
  assert.deepEqual(la.zeros(2,3),[[0,0,0],[0,0,0]]);
  close(la.frobenius([[3,0],[0,4]]),5);
  close(la.transpose([[1,2,3]]),[[1],[2],[3]]);
});
test('rank, reduced echelon form and system classifications',()=>{
  const A=[[1,2,3],[2,4,6]];
  assert.equal(la.rank(A),1); close(la.rref(A),[[1,2,3],[0,0,0]]);
  close(la.rref([[0,2,4],[1,2,3]]),[[1,0,-1],[0,1,2]]);
  for(const [matrix,b,classification] of [
    [[[2,1],[1,3]],[5,10],'unique'],
    [[[1,1],[2,2]],[1,2],'infinite'],
    [[[1,1],[2,2]],[1,3],'inconsistent'],
    [[[1,1]],[2],'infinite'],
    [[[1],[1]],[1,1],'unique'],
    [[[1,0],[0,1e-12]],[1,1e-12],'ill-conditioned'],
    [[[0,0],[0,0]],[0,0],'infinite'],
    [[[0,0],[0,0]],[0,1],'inconsistent']
  ]){
    const info=la.solveinfo(matrix,b);
    assert.equal(info.metadata.classification,classification);
    if(classification==='inconsistent') assert.equal(info.value,null);
    else assert.ok(info.metadata.relativeResidual<1e-12);
  }
  close(la.solveinfo([[1,1]],[2]).value,[1,1]);
  assert.equal(la.solveinfo([[1,0,0],[0,2e-14,0],[0,0,0]],[0,1,1]).metadata.classification,'inconsistent');
  close(la.solveinfo([[1e-320]],[1e-320]).value,[1]);
  const singular=la.matrixInfo([[1,2],[2,4]]), nearly=la.matrixInfo([[1,0],[0,1e-12]]);
  assert.equal(singular.metadata.invertible,false); assert.equal(nearly.metadata.invertible,true);
  assert.ok(nearly.warnings.length); assert.ok(nearly.metadata.condition>=1e12);
});
test('eigenvalues are ordered, eigenvectors satisfy Av=λv and multiplicity is honest',()=>{
  for(const A of [[[2,0],[0,3]],[[0,1],[2,0]],[[2,1],[0,2]],[[2,0],[0,2]],[[0,0],[0,0]]]){
    const info=la.eiginfo(A);
    assert.ok(info.value[0]<=info.value[1]);
    for(const pair of info.pairs){close(la.matmul(A,pair.vector.map(x=>[x])).flat(),la.scale(pair.value,pair.vector));close(la.norm(pair.vector),1);}
  }
  close(la.eig([[2,0],[0,3]]),[2,3]);
  assert.equal(la.eiginfo([[2,1],[0,2]]).metadata.diagonalizable,false);
  assert.equal(la.eigenvectors([[2,1],[0,2]]).length,1);
  assert.equal(la.eiginfo([[2,0],[0,2]]).metadata.diagonalizable,true);
  const tiny=la.eig([[1e-20,0],[0,1]]); assert.ok(Math.abs(tiny[0]/1e-20-1)<1e-10);
});
test('scale-aware decisions preserve rank, inversion and solutions',()=>{
  const A=[[2,1],[1,3]];
  for(const s of [1e-200,1e-20,1,1e20,1e200]){
    const B=A.map(row=>row.map(x=>x*s));
    assert.equal(la.rank(B),2);
    close(la.matmul(B,la.inv(B)),la.eye(2));
    close(la.linsolve(B,[5*s,10*s]),[1,3]);
    close(la.solveinfo(B,[5*s,10*s]).value,[1,3]);
  }
});
test('validation rejects malformed data, inappropriate domains and excessive sizes',()=>{
  const cases=[
    [()=>la.inv([[1,2],[2,4]]),'SINGULAR'],[()=>la.det([]),'MATRIX'],
    [()=>la.det([[1,2],[3]]),'SHAPE'],[()=>la.det([[Infinity]]),'FINITE'],
    [()=>la.norm([NaN]),'FINITE'],[()=>la.norm(['1']),'FINITE'],[()=>la.norm([[]]),'FINITE'],
    [()=>la.matmul([[1,2]],[[1,2]]),'DIMENSION'],[()=>la.inv([[1,2]]),'SQUARE'],
    [()=>la.dot([1],[1,2]),'DIMENSION'],[()=>la.cross([1],[2]),'DIMENSION'],
    [()=>la.proj([1,2],[0,0]),'ZERO_VECTOR'],[()=>la.angle([0,0],[1,0]),'ZERO_VECTOR'],
    [()=>la.eig([[0,-1],[1,0]]),'COMPLEX'],[()=>la.eig(la.eye(3)),'UNSUPPORTED'],
    [()=>la.eye(21),'SIZE'],[()=>la.eye(2.5),'SIZE'],[()=>la.zeros(-1,2),'SIZE'],
    [()=>la.det([[[1]]]),'FINITE'],[()=>la.det(Array.from({length:21},()=>[1])),'SIZE'],
    [()=>la.svd(la.eye(13)),'SIZE'],[()=>la.qr(la.eye(13)),'SIZE'],
    [()=>la.linsolve([[1,2],[2,4]],[1,3]),'SINGULAR'],
    [()=>la.callAlgebra('dot',[[1]]),'ARGUMENTS'],[()=>la.callAlgebra('dot',[[1e308],[1e308]]),'OVERFLOW']
  ];
  cases.forEach(([fn,code])=>assert.throws(fn,e=>e instanceof la.AlgebraError&&e.code===code,code));
});

// Seeded property tests, including deficient, tall, wide and badly scaled data.
let seed=94631;
const random=()=>{seed=(1664525*seed+1013904223)>>>0;return seed/2**32*2-1;};
const matrices=[[[0]],[[0,0],[0,0]],[[1,2],[2,4]],[[1,2,3]],[[1],[2],[3]],[[0,2],[1,3]],[[1,0],[0,1e-12]]];
for(const [m,n] of [[2,3],[3,2],[5,4],[4,5],[8,8],[12,12]]) matrices.push(Array.from({length:m},()=>Array.from({length:n},random)));
test('QR, SVD and LU reconstruct inputs with orthogonal factors and no mutation',()=>{
  for(const A of matrices){
    const copy=structuredClone(A), {Q,R,metadata:q}=la.qr(A);
    close(la.matmul(Q,R),A); close(la.matmul(la.transpose(Q),Q),la.eye(Q.length));
    assert.ok(q.residual<1e-12);
    const f=la.svd(A), k=Math.min(A.length,A[0].length);
    close(la.matmul(f.U.map(row=>row.map((x,j)=>x*f.S[j])),f.Vt),A);
    close(la.matmul(la.transpose(f.U),f.U),la.eye(k)); close(la.matmul(f.Vt,la.transpose(f.Vt)),la.eye(k));
    assert.ok(f.metadata.residual<1e-12); assert.ok(f.S.every((s,i)=>s>=0&&(!i||f.S[i-1]>=s)));
    if(A.length===A[0].length){const {P,L,U}=la.lu(A);close(la.matmul(P,A),la.matmul(L,U));}
    assert.deepEqual(A,copy);
  }
});
test('pseudoinverse satisfies the Moore–Penrose identities; least squares minimizes residual',()=>{
  for(const A of matrices){
    const p=la.pinv(A).value, ap=la.matmul(A,p), pa=la.matmul(p,A);
    close(la.matmul(ap,A),A,1e-8); close(la.matmul(pa,p),p,1e-8);
    close(la.transpose(ap),ap,1e-8); close(la.transpose(pa),pa,1e-8);
  }
  const A=[[1,0],[1,1],[1,2]], b=[1,2,2], info=la.lstsq(A,b);
  close(info.value,[7/6,.5]);
  const residual=la.vsub(la.matmul(A,info.value.map(x=>[x])).flat(),b);
  close(la.matmul(la.transpose(A),residual.map(x=>[x])),[[0],[0]]);
  assert.ok(info.metadata.residual>0);
});
test('fundamental algebraic identities',()=>{
  for(let i=0;i<15;i++){
    const A=Array.from({length:3},()=>Array.from({length:3},random)), B=Array.from({length:3},()=>Array.from({length:3},random));
    close(la.transpose(la.transpose(A)),A);close(la.matmul(A,la.eye(3)),A);
    close(la.matmul(A,la.inv(A)),la.eye(3));close(la.det(la.matmul(A,B)),la.det(A)*la.det(B));
    assert.equal(la.dot(A[0],B[0]),la.dot(B[0],A[0]));assert.ok(la.norm(A[0])>=0);
  }
});
test('ill-conditioned Hilbert matrices retain orthogonal factors and reconstruction accuracy',()=>{
  const A=Array.from({length:8},(_,i)=>Array.from({length:8},(_,j)=>1/(i+j+1)));
  const f=la.svd(A), q=la.qr(A);
  assert.ok(f.metadata.condition>1e10);assert.ok(f.warnings.length);
  assert.ok(f.metadata.residual<1e-12);assert.ok(q.metadata.residual<1e-12);
  close(la.matmul(la.transpose(f.U),f.U),la.eye(8),1e-12);
  close(la.matmul(f.Vt,la.transpose(f.Vt)),la.eye(8),1e-12);
  for(const scale of [1e-200,1e200]){
    const B=A.map(row=>row.map(x=>x*scale)), scaled=la.svd(B);
    assert.equal(scaled.metadata.rank,f.metadata.rank);assert.ok(scaled.metadata.residual<1e-12);
  }
});
test('scale accepts matrices and matmul accepts vector operands',()=>{
  close(la.scale(2,[[1,-2],[0,3]]),[[2,-4],[0,6]]);
  close(la.det(la.scale(2,la.inv([[2,1],[1,-2]]))),-0.8);
  assert.throws(()=>la.scale(2,[[1,2],[3]]),{code:'SHAPE'});
  assert.deepEqual(la.matmul([[2,-1],[1,1]],[3,4]),[2,7]);
  assert.deepEqual(la.matmul([1,2],[[1,0],[0,1]]),[1,2]);
  assert.deepEqual(la.matmul([[2,-1],[1,1]],[[3],[4]]),[[2],[7]]);
  assert.throws(()=>la.matmul([1,2],[3,4]),{code:'DIMENSION'});
  assert.throws(()=>la.matmul([[1,2,3]],[3,4]),{code:'DIMENSION'});
  assert.throws(()=>la.matmul([1,2,3],[[1,0],[0,1]]),{code:'DIMENSION'});
});
test('matrixInfo classifies structural matrix types',()=>{
  const types=A=>la.matrixInfo(A).metadata.types||[];
  assert.deepEqual(types([[0,-1,-4],[1,0,2],[4,-2,0]]),['antissimétrica']);
  assert.deepEqual(types([[0,-1],[1,0]]),['antissimétrica','ortogonal']);
  assert.deepEqual(types([[3,1,0],[1,3,2],[0,2,3]]),['simétrica']);
  assert.deepEqual(types([[2,5,1],[0,3,4],[0,0,6]]),['triangular superior']);
  assert.deepEqual(types([[2,0],[7,3]]),['triangular inferior']);
  assert.deepEqual(types([[2,0],[0,3]]),['diagonal','simétrica']);
  assert.deepEqual(types(la.eye(3)),['identidade','simétrica','ortogonal']);
  assert.deepEqual(types([[1,2,3]]),['linha']);
  assert.deepEqual(types([[1],[2]]),['coluna']);
  assert.deepEqual(types(la.zeros(2,2)),['nula']);
  assert.deepEqual(types([[1,2],[3,4]]),[]);
  const c=Math.cos(0.3), s=Math.sin(0.3);
  assert.ok(types([[c,-s],[s,c]]).includes('ortogonal'));
});
