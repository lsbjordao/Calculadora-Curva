import assert from 'node:assert/strict';
import test from 'node:test';

import { conicSuggestion } from '../src/geometry.js';

test('suggests conica analysis for a circle in general form',()=>{
  assert.equal(conicSuggestion('x² + y² - 8x +4y - 29 = 0'),'conica: x² + y² - 8x +4y - 29 = 0');
});

test('suggests conica analysis for ellipse, hyperbola, parabola and rotated conics',()=>{
  for(const text of ['4x^2 + 9y^2 = 36','x^2 - y^2 = 1','y^2 = 8x','x*y = 1']){
    assert.equal(conicSuggestion(text),'conica: '+text,text);
  }
});

test('uses slider parameters when sampling the relation',()=>{
  assert.equal(conicSuggestion('x^2 + y^2 = r^2',{params:{r:2}}),'conica: x^2 + y^2 = r^2');
});

test('does not suggest for non-quadratic, linear or degenerate relations',()=>{
  for(const text of ['x^3 + y^3 = 1','sin(x) = y^2','x + y = 1','x^2 = 4','x^2 + y^2 = -1','']){
    assert.equal(conicSuggestion(text),null,text);
  }
});
