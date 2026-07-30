import assert from 'node:assert/strict';
import test from 'node:test';

import { compile, setImplicitY } from '../src/parser.js';

test('compile reads y from the implicit-Y state',()=>{
  const f=compile('y');
  setImplicitY(5);
  assert.equal(f(0), 5);
  setImplicitY(-2);
  assert.equal(f(0), -2);
});

test('compile evaluates f(x,y) with x as the argument and y as state',()=>{
  const circle=compile('x^2 + y^2');
  setImplicitY(3);
  assert.equal(circle(4), 25);
  const prod=compile('x*y');
  setImplicitY(2);
  assert.equal(prod(3), 6);
});
