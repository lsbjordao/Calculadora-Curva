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

test('expoente sem parênteses termina no primeiro operador',()=>{
  assert.equal(formatMathVisual('i^2-3i+4'), 'i²-3i+4');
  assert.equal(formatMathVisual('(i-4)^2+sin(3i)'), '(i-4)²+sin(3i)');
  assert.equal(formatMathVisual('x^-1 + 2'), 'x⁻¹ + 2');
  assert.equal(formatMathVisual('2^n-1'), '2ⁿ-1');
  assert.equal(formatMathVisual('x^1.5'), 'x^1.5');
  assert.equal(formatMathVisual('x^(n+1)'), 'xⁿ⁺¹');
  assert.equal(formatMathVisual('x^2x'), 'x²x');
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

test('descreve a vista 3D com objetos e câmera',async()=>{
  const { createCamera }=await import('../src/space3d/camera.js');
  const text=describeCanvas({
    view3d:{mode:'3d',camera:createCamera()}, width:400, height:300,
    equations:[
      {text:'ponto: A=(1,2,3)',visible:true,error:false,kind:'geometry',geometry:{dim:3}},
      {text:'sin(x)',visible:true,error:false,kind:'function'}
    ]
  });
  assert.match(text,/Vista 3D/);
  assert.match(text,/1 objeto/);
  assert.match(text,/ponto: A=\(1,2,3\)/);
  assert.match(text,/azimute -60°, elevação 25°/);
  assert.match(text,/ortográfica/);
  assert.doesNotMatch(text,/x de /);
  const flat=describeCanvas({view3d:{mode:'2d',camera:createCamera()},view:{cx:0,cy:0,scale:10},width:200,height:100,equations:[]});
  assert.doesNotMatch(flat,/Vista 3D/);
  const custom=describeCanvas({view3d:{mode:'3d',camera:createCamera({projection:'perspective'})},scene3dObjects:['A','u','plano z = 0']});
  assert.match(custom,/Vista 3D: 3 objetos \(A; u; plano z = 0\)/);
  assert.match(custom,/perspectiva/);
});
