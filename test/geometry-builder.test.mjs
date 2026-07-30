import assert from 'node:assert/strict';
import test from 'node:test';

import {
  choosePointSourceIndex,
  constructionExpression,
  formatCoord,
  formatPointCommand,
  nextPointLabel,
  updatePoint,
  usedGeometryNames
} from '../src/geometry-builder.js';

test('geometry builder formats coordinates and point commands',()=>{
  assert.equal(formatCoord(1.23456),'1.235');
  assert.equal(formatCoord(-0.0001),'0');
  assert.equal(formatPointCommand([{label:'A',x:0,y:0},{label:'B',x:1.2,y:-3.4567}]),'ponto: A=(0,0), B=(1.2,-3.457)');
});

test('geometry builder chooses available point labels',()=>{
  assert.equal(nextPointLabel([{label:'A'},{label:'C'}]),'B');
  assert.equal(nextPointLabel('ABCDEFGHIJKLMNOPQRSTUVWXYZ'.split('').map(label=>({label}))),'P1');
});

test('geometry builder updates one point while preserving labels',()=>{
  const points=updatePoint([{label:'A',x:0,y:0},{label:'B',x:1,y:2}],'B',3.25,-4.5);
  assert.deepEqual(points,[{label:'A',x:0,y:0},{label:'B',x:3.25,y:-4.5}]);
  assert.equal(formatPointCommand(points),'ponto: A=(0,0), B=(3.25,-4.5)');
});

test('geometry builder chooses focused empty or point source rows',()=>{
  const rows=[
    {text:'ponto: A=(0,0), B=(1,1)',type:'point'},
    {text:'',type:''},
    {text:'x^2',type:''}
  ];
  assert.equal(choosePointSourceIndex(rows,1),1);
  assert.equal(choosePointSourceIndex(rows,0),0);
  assert.equal(choosePointSourceIndex(rows,2),0);
  assert.equal(choosePointSourceIndex([{text:'sin(x)',type:''}],0),-1);
});

test('geometry builder creates constructions from selected points',()=>{
  const used=usedGeometryNames([{label:'A'},{label:'B'},{name:'M'},{name:'r'}]);
  assert.equal(constructionExpression('vector','A','B',used),'vetor: A,B');
  assert.equal(constructionExpression('distance','A','B',used),'dist: A,B');
  assert.equal(constructionExpression('midpoint','A','B',used),'N = medio(A,B)');
  assert.equal(constructionExpression('line','A','B',used),'s = reta(A,B)');
  assert.equal(constructionExpression('triangle',['A','B','C'],null,used),'triangulo: A,B,C');
  assert.equal(constructionExpression('quadrilateral',['A','B','C','D'],null,used),'quadrilatero: A,B,C,D');
  assert.equal(constructionExpression('polygon',['A','B','C','D','E'],null,used),'poligono: A,B,C,D,E');
  assert.equal(constructionExpression('convexHull',['A','B','C','D','E'],null,used),'convexo: A,B,C,D,E');
});
