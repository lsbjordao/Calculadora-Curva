import assert from 'node:assert/strict';
import test from 'node:test';

import { antiderivativeText, integralSteps } from '../src/integrate.js';
import { compile } from '../src/parser.js';
import { configureNumeric, derivAt, integ } from '../src/numeric.js';

configureNumeric(()=>({scale:38,W:800,H:600,px2wx:px=>px}));

// Contrato central: F é primitiva de f ⟺ F′ ≈ f nos pontos do domínio.
const CASES=[
  ['3x^2+2x+1',[-2,0.5,1.7]], ['7',[-1,0,2]], ['x',[-2,1]], ['1/x',[0.4,2,5]],
  ['sqrt(x)',[0.3,1.4,4]], ['sin(x)',[-2,0.5]], ['cos(2x+1)',[-1,0.6]],
  ['e^x',[-1,0.8]], ['e^(3x)',[-1,0.5]], ['2^x',[-1,1.2]], ['(2x+1)^4',[-1,0.3]],
  ['1/(x^2+1)',[-2,0.5]], ['1/sqrt(1-x^2)',[-0.7,0.2,0.6]], ['ln(x)',[0.5,2,6]],
  ['sin(x)/3',[-1,0.7]], ['5cos(x)-2sin(x)+x^2',[-1.5,0.4,2]], ['tan(3x)',[-0.3,0.2,0.4]],
  ['sinh(x)+cosh(x)',[-1,0.5]], ['x^(-2)',[0.5,2]], ['1/x^2',[0.5,2]], ['pi',[-1,1]],
  ['a*x',[-1,2]], ['cbrt(x)',[0.4,1.5,4]], ['log(x)',[0.5,2,6]], ['sin(2-x)',[-1,0.6]],
];
for(const [e,xs] of CASES) test('∫ '+e, ()=>{
  const F=antiderivativeText(e);
  assert.notEqual(F, null, e);
  const f=compile(e), dF=compile(F);
  assert.ok(dF, e+': primitiva não compila: '+F);
  let checked=0;
  for(const x of xs){
    const ref=f(x), v=derivAt(dF,x);
    if(!Number.isFinite(ref)||!Number.isFinite(v)) continue;
    checked++;
    assert.ok(Math.abs(v-ref)<=1e-3*Math.max(1,Math.abs(ref)), `${e} em x=${x}: F′=${v} f=${ref} (F=${F})`);
  }
  assert.ok(checked>=2, e+': pontos válidos insuficientes (F='+F+')');
});

test('fora do repertório → null (honesto, sem chute)', ()=>{
  for(const e of ['x*e^x','sin(x^2)','x^x','ln(x)/x','sin(x)*cos(x)','1/(x^3+1)','x^a','1/sin(x)'])
    assert.equal(antiderivativeText(e), null, e);
});

test('passos: rótulos, substituição linear e TFC ≈ Simpson', ()=>{
  const st=integralSteps('3x^2+sin(2x)');
  assert.ok(st);
  const titles=st.lines.map(l=>l.title);
  assert.ok(titles.includes('Linearidade'), titles.join(','));
  assert.ok(titles.includes('Constante multiplicativa'), titles.join(','));
  assert.ok(titles.includes('Regra da potência'), titles.join(','));
  assert.ok(titles.includes('Substituição linear'), titles.join(','));
  const F=compile(st.result), f=compile('3x^2+sin(2x)');
  assert.ok(Math.abs((F(2)-F(0.5)) - integ(f,0.5,2)) <= 1e-4);
});

test('passos: cada linha com ∫ pendente é utilizável e a nota de substituição aparece', ()=>{
  const st=integralSteps('cos(2x+1)');
  assert.ok(st);
  assert.ok(st.lines.some(l=>l.note && l.note.includes('u = 2x+1')), JSON.stringify(st.lines));
});

test('null para texto fora do subconjunto simbólico', ()=>{
  assert.equal(integralSteps('{x<0: -x; x>=0: x}'), null);
  assert.equal(antiderivativeText(''), null);
});
