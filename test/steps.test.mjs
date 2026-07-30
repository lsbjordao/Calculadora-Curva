import assert from 'node:assert/strict';
import test from 'node:test';

import { derivativeSteps } from '../src/steps.js';
import { derivativeText } from '../src/symbolic.js';
import { compile } from '../src/parser.js';
import { derivAt } from '../src/numeric.js';

// Cada linha do passo a passo é uma igualdade válida: trocando os pendentes
// d/dx[u] pela sintaxe numérica deriv(u) do parser, a linha compilada tem de
// valer f′(x) em todo ponto testado.
const asParser=s=>s.replaceAll('d/dx[','deriv(').replaceAll(']',')');

function checkLines(exprText, xs){
  const st=derivativeSteps(exprText);
  assert.ok(st, exprText);
  const f=compile(exprText);
  for(const line of st.lines){
    const g=compile(asParser(line.expr));
    assert.ok(g, exprText+' linha não compila: '+line.expr);
    let checked=0;
    for(const x of xs){
      const ref=derivAt(f,x), v=g(x);
      if(!Number.isFinite(ref)||!Number.isFinite(v)) continue;
      checked++;
      assert.ok(Math.abs(v-ref)<=1e-3*Math.max(1,Math.abs(ref)),
        `${exprText} linha "${line.expr}" em x=${x}: ${v} vs ${ref}`);
    }
    assert.ok(checked>=2, exprText+' linha sem pontos válidos: '+line.expr);
  }
  return st;
}

test('produto: linhas válidas, regras nomeadas, resultado bate com derivativeText', ()=>{
  const st=checkLines('x^2*sin(x)', [-1.3,0.4,1.7]);
  assert.equal(st.lines[0].title, 'Regra do produto');
  assert.ok(st.lines[0].note.includes('u = x^2'));
  assert.equal(st.result, derivativeText('x^2*sin(x)'));
  // A última linha JÁ é a forma canônica → sem linha "Simplificação" redundante…
  assert.equal(st.lines[st.lines.length-1].expr, st.result);
  // …mas ela aparece quando o bruto difere do canônico.
  const st2=checkLines('sin(cos(x^2))', [-1.1,0.3,0.9]);
  assert.equal(st2.lines[st2.lines.length-1].title, 'Simplificação');
});

test('rótulos por regra', ()=>{
  const titles=s=>derivativeSteps(s).lines.map(l=>l.title);
  assert.ok(titles('x^3-2x+5').includes('Linearidade'));
  assert.ok(titles('3*sin(x)').includes('Constante multiplicativa'));
  assert.ok(titles('sin(x)/x').includes('Regra do quociente'));
  assert.ok(titles('x^2/3').includes('Constante no denominador'));
  assert.ok(titles('x^5').includes('Regra da potência'));
  assert.ok(titles('(3x+1)^5').includes('Potência + cadeia'));
  assert.ok(titles('sin(x^2)').includes('Regra da cadeia'));
  assert.equal(titles('sin(x)')[0], 'Derivada tabelada');
  assert.ok(titles('2^x').includes('Exponencial'));
  assert.ok(titles('x^x').includes('Derivação logarítmica'));
  assert.ok(titles('root(3,x^2+1)').includes('Raiz como potência'));
  assert.ok(titles('abs(x^2-2)').includes('Módulo'));
  assert.ok(titles('floor(x)').includes('Função escada'));
  assert.ok(titles('a*x^2+b').some(t=>t==='Derivada de constante'||t==='Constante multiplicativa'));
});

test('resultado ≡ derivativeText e linhas válidas para a bateria', ()=>{
  const CASES=[
    ['x^3-2x+5',[-2,0.4,1.6]], ['(x^2+1)/(x-2)',[-1,0.5,3.2]], ['x^x',[0.4,1.2,2.1]],
    ['2^x',[-1,0.5,2]], ['(3x+1)^5',[-1.2,-0.2,0.8]], ['sin(cos(x^2))',[-1.1,0.3,0.9]],
    ['exp(sin(x))*x',[-1.5,0.5,1.9]], ['ln(ln(x))',[3,5,9]], ['sqrt(1-x^2)',[-0.7,0.1,0.6]],
    ['1/(1+e^(-x))',[-1.5,0.3,1.4]], ['a*x^2+b*x+c',[-1,0.5,2]], ['tan(x)',[-0.9,0.3,1.1]],
    ['atanh(x)',[-0.7,-0.1,0.5]], ['cbrt(x)',[0.5,1.5,4]], ['deriv(sin(x))',[-2,0.3,1.5]],
    ['pi*x^2/2',[-1.5,0.4,2]],
  ];
  for(const [e,xs] of CASES){
    const st=checkLines(e,xs);
    assert.equal(st.result, derivativeText(e), e);
    assert.ok(st.lines.length>=1 && st.lines.length<=40, e+': '+st.lines.length+' linhas');
  }
});

test('fora do subconjunto → null', ()=>{
  assert.equal(derivativeSteps('{x<0: -x; x>=0: x}'), null);
  assert.equal(derivativeSteps('lim(sin(x)/x, 0)'), null);
  assert.equal(derivativeSteps(''), null);
});
