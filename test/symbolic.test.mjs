import assert from 'node:assert/strict';
import test from 'node:test';

import { parseExpr, differentiate, simplify, toText, derivativeText } from '../src/symbolic.js';
import { compile } from '../src/parser.js';

// Validate a derivative text numerically: compile it with the app parser and
// compare against a reference derivative function at several sample points.
function assertDerivMatches(dText, ref, xs, params={}, tol=1e-9){
  const fn=compile(dText, params);
  assert.ok(fn, 'derivative text should compile: '+dText);
  for(const x of xs){
    const got=fn(x), want=ref(x);
    const scale=Math.max(1,Math.abs(want));
    assert.ok(Math.abs(got-want)<=tol*scale,
      `d(${dText}) at x=${x}: got ${got}, want ${want}`);
  }
}

test('power rule and linearity produce clean canonical text',()=>{
  assert.equal(derivativeText('x^2'), '2x');
  assert.equal(derivativeText('3x^2+2x+1'), '6x+2');
  assert.equal(derivativeText('sin(x)'), 'cos(x)');
  assert.equal(derivativeText('ln(x)'), '1/x');
});

test('product rule: x*sin(x)',()=>{
  assert.equal(derivativeText('x*sin(x)'), 'sin(x)+x*cos(x)');
});

test('chain rule: sin(x^2) → 2x*cos(x^2)',()=>{
  assert.equal(derivativeText('sin(x^2)'), '2x*cos(x^2)');
});

test('e^x stays e^x (ln(e) folds to 1)',()=>{
  assert.equal(derivativeText('e^x'), 'e^x');
  assert.equal(derivativeText('exp(x)'), 'exp(x)');
});

test('abs differentiates to sign; floor differentiates to 0 a.e.',()=>{
  assert.equal(derivativeText('abs(x)'), 'sign(x)');
  assert.equal(derivativeText('floor(x)'), '0');
});

test('params are treated as constants',()=>{
  assert.equal(derivativeText('a*x^2'), '2a*x');
  // exponent param: x^a → a*x^(a-1)
  assertDerivMatches(derivativeText('x^a'), x=>3*Math.pow(x,2), [0.5,1.3,2.7], {a:3});
});

test('quotient rule matches reference numerically',()=>{
  const d=derivativeText('(x^2+1)/(x-2)');
  assert.ok(d!==null);
  assertDerivMatches(d, x=>((2*x)*(x-2)-(x*x+1))/((x-2)*(x-2)), [0,1,3.5,-4]);
});

test('trig, inverse trig, hyperbolic and log rules match references',()=>{
  assertDerivMatches(derivativeText('tan(x)'), x=>1/Math.cos(x)**2, [0.3,-0.8,1.1]);
  assertDerivMatches(derivativeText('asin(x)'), x=>1/Math.sqrt(1-x*x), [0.2,-0.6]);
  assertDerivMatches(derivativeText('atan(x)'), x=>1/(1+x*x), [0,1.5,-2]);
  assertDerivMatches(derivativeText('tanh(x)'), x=>1/Math.cosh(x)**2, [0,0.9,-1.4]);
  assertDerivMatches(derivativeText('log(x)'), x=>1/(x*Math.LN10), [0.5,2,10]);
  assertDerivMatches(derivativeText('sqrt(x)'), x=>1/(2*Math.sqrt(x)), [0.25,1,9]);
  assertDerivMatches(derivativeText('cbrt(x)'), x=>1/(3*Math.cbrt(x)**2), [1,8,-8]);
});

test('general power rule: x^x',()=>{
  const d=derivativeText('x^x');
  assert.ok(d!==null);
  assertDerivMatches(d, x=>Math.pow(x,x)*(Math.log(x)+1), [0.5,1,2,3.2]);
});

test('a^x with numeric base',()=>{
  const d=derivativeText('2^x');
  assert.ok(d!==null);
  assertDerivMatches(d, x=>Math.pow(2,x)*Math.LN2, [-1,0,2.5]);
});

test('second derivative by differentiating twice',()=>{
  const d1=derivativeText('x^4');
  assert.equal(d1,'4x^3');
  assert.equal(derivativeText(d1),'12x^2');
});

test('deriv(...) is resolved symbolically during parse',()=>{
  const ast=parseExpr('deriv(x^3)');
  assert.ok(ast);
  assert.equal(toText(simplify(ast)),'3x^2');
  assert.equal(derivativeText('deriv(x^3)'),'6x');
});

test('non-differentiable constructs bail out with null',()=>{
  assert.equal(derivativeText('piecewise(x>0,1,0)'), null);
  assert.equal(derivativeText('g(x)+1'), null);       // user function: unknown body
  assert.equal(derivativeText('lim(1/x,0)'), null);
  assert.equal(derivativeText('sum(n,1,10,x^n)'), null);
  assert.equal(derivativeText('y+x'), null);          // implicit variable
  assert.equal(derivativeText('[1,2]'), null);        // matrix literal
  assert.equal(derivativeText("f'(x)"), null);        // numeric-only syntax
});

test('normalized input forms are accepted (implicit mult, unicode, superscript)',()=>{
  assert.equal(derivativeText('x²'), '2x');
  assert.equal(derivativeText('2x'), '2');
  assert.ok(derivativeText('|x|')!==null);
  assertDerivMatches(derivativeText('2sin(x)cos(x)'), x=>2*Math.cos(2*x), [0.4,-1.2]);
});

test('root with constant index differentiates; variable index bails',()=>{
  const d=derivativeText('root(3,x)');
  assert.ok(d!==null);
  assertDerivMatches(d, x=>1/(3*Math.cbrt(x)**2), [1,8]);
  assert.equal(derivativeText('root(x,2)'), null);
});

test('toText output is always re-parseable by the app parser',()=>{
  for(const src of ['x^2','x*sin(x)','(x^2+1)/(x-2)','e^(-x^2)','x^x','asin(x/2)','cos(2x)^3']){
    const d=derivativeText(src);
    assert.ok(d!==null, src);
    assert.ok(compile(d), 'should re-parse: '+d);
  }
});

test('differentiate/simplify are pure AST helpers',()=>{
  const ast=parseExpr('x^2+x');
  const d=differentiate(ast);
  assert.ok(d);
  assert.equal(toText(simplify(d)),'2x+1');
});
