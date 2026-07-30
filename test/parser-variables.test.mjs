import assert from 'node:assert/strict';
import test from 'node:test';

import { compile, splitTop, parsePoints } from '../src/parser.js';

test('compile accepts t and theta as the variable',()=>{
  assert.equal(compile('t^2')(3), 9);
  assert.equal(compile('cos(t)')(0), 1);
  assert.equal(compile('theta')(2), 2);
  assert.equal(compile('cos(theta)')(0), 1);
  assert.equal(compile('cos(θ)')(0), 1); // θ symbol normalized to theta
});

test('x still works as the variable',()=>{
  assert.equal(compile('x^2')(4), 16);
});

test('splitTop splits at top level only, respecting parentheses',()=>{
  assert.deepEqual(splitTop('a,b', ','), ['a','b']);
  assert.deepEqual(splitTop('cos(t),sin(t)', ','), ['cos(t)','sin(t)']);
  assert.deepEqual(splitTop('root(3,x),t', ','), ['root(3,x)','t']);
  assert.deepEqual(splitTop('[[2,1],[1,3]],[5,10]', ','), ['[[2,1],[1,3]]','[5,10]']);
  assert.deepEqual(splitTop('nocomma', ','), ['nocomma']);
});

test('parsePoints reads (x,y) lists and rejects junk',()=>{
  assert.deepEqual(parsePoints('(1,2),(3,4)'), [{x:1,y:2},{x:3,y:4}]);
  assert.deepEqual(parsePoints('(-1,0.5),(2,-3)'), [{x:-1,y:0.5},{x:2,y:-3}]);
  assert.equal(parsePoints('garbage'), null);
  assert.equal(parsePoints('(1,2),(3)'), null);
  assert.equal(parsePoints(''), null);
});
