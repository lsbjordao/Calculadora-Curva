import test from 'node:test';
import assert from 'node:assert/strict';
import {splitInfoLines,infoLabelValue} from '../src/info-format.js';

test('split cone description into separate readable fields',()=>{
  const text='Cone: x² + y² = 1(z − 0)² · Ângulo do plano: 90° (vertical) · Equação do plano: cos(q)(z − d − h) − sin(q)(x cos(p) + y sin(p)) = b|sin(q)| · Parâmetros: q é o ângulo em graus; b desloca o plano para ambos os lados (inclusive 0) · Interseção: hipérbole · Curva e cone truncados apenas pela janela de visualização.';
  const lines=splitInfoLines(text);
  assert.equal(lines.length,6);
  assert.deepEqual(lines.map(line=>infoLabelValue(line).label),
    ['Cone','Ângulo do plano','Equação do plano','Parâmetros','Interseção',null]);
  assert.equal(infoLabelValue(lines[2]).value,
    'cos(q)(z − d − h) − sin(q)(x cos(p) + y sin(p)) = b|sin(q)|');
  assert.equal(lines[5],'Curva e cone truncados apenas pela janela de visualização.');
});
test('recognize only a field prefix before the first colon, preserving formulas',()=>{
  assert.deepEqual(infoLabelValue('Plano: x:y = 2'),{label:'Plano',value:'x:y = 2'});
  assert.deepEqual(infoLabelValue('z = x + 2'),{label:null,value:'z = x + 2'});
  assert.deepEqual(infoLabelValue('https://example.org/plot'),{label:null,value:'https://example.org/plot'});
});
test('preserve dot products rather than treating them as visual separators',()=>{
  assert.deepEqual(splitInfoLines('u · v = 3 · |u| = 2'),['u · v = 3','|u| = 2']);
  assert.deepEqual(splitInfoLines(['u · v = 2','Ângulo: 45°']),['u · v = 2','Ângulo: 45°']);
});
test('support arrays and newline-separated details while ignoring blank lines',()=>{
  assert.deepEqual(splitInfoLines(['Plano: vertical\nInterseção: hipérbole',' ·  ','']),['Plano: vertical','Interseção: hipérbole']);
  assert.deepEqual(splitInfoLines(''),[]);
});
