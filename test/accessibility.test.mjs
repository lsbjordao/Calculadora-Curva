import test from 'node:test';
import assert from 'node:assert/strict';
import { describeCanvas, formatMathVisual } from '../src/accessibility.js';

test('converte sintaxe comum em notação matemática sem alterar a fonte',()=>{
  assert.equal(formatMathVisual('sqrt(x)'), '√x');
  assert.equal(formatMathVisual('x^2 + cbrt(x+1)'), 'x² + ∛(x+1)');
  assert.equal(formatMathVisual('pi*x^(12) >= 2'), 'π · x¹² ≥ 2');
  assert.equal(formatMathVisual('sqrt(sqrt(x))'), '√(√x)');
  assert.equal(formatMathVisual("f′(x) = 4x^3 · f′(0) ≈ 0"), "f′(x) = 4x³ · f′(0) ≈ 0");
});

test('descreve janela, grade e apenas equações visíveis válidas',()=>{
  const text=describeCanvas({
    gridMode:'linear', view:{cx:0,cy:1,scale:10}, width:200, height:100,
    equations:[
      {text:'sqrt(x)',name:'Raiz',visible:true,error:false,kind:'function'},
      {text:'x^2',visible:false,error:false,kind:'function'},
      {text:'bad',visible:true,error:true,kind:'function'}
    ]
  });
  assert.match(text,/grade cartesiana/);
  assert.match(text,/x de -10 a 10/);
  assert.match(text,/Raiz: √x/);
  assert.doesNotMatch(text,/x²|bad/);
});
