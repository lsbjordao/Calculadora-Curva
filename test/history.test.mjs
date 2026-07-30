import assert from 'node:assert/strict';
import test from 'node:test';

import { createHistory } from '../src/history.js';

test('a fresh history has nothing to undo or redo',()=>{
  const h=createHistory();
  assert.equal(h.canUndo(),false);
  assert.equal(h.canRedo(),false);
  assert.equal(h.getCurrent(),null);
  assert.equal(h.undo(),null);
  assert.equal(h.redo(),null);
});

test('the first commit becomes current without enabling undo',()=>{
  const h=createHistory();
  assert.equal(h.commit('a'),true);
  assert.equal(h.getCurrent(),'a');
  assert.equal(h.canUndo(),false);
  assert.equal(h.canRedo(),false);
});

test('committing an identical state is a no-op',()=>{
  const h=createHistory();
  h.commit('a');
  assert.equal(h.commit('a'),false);
  assert.equal(h.canUndo(),false);
});

test('undo and redo walk the timeline',()=>{
  const h=createHistory();
  h.commit('a'); h.commit('b'); h.commit('c');
  assert.equal(h.undo(),'b');
  assert.equal(h.undo(),'a');
  assert.equal(h.canUndo(),false);
  assert.equal(h.undo(),null);
  assert.equal(h.redo(),'b');
  assert.equal(h.redo(),'c');
  assert.equal(h.canRedo(),false);
  assert.equal(h.redo(),null);
});

test('a new commit after undo clears the redo branch',()=>{
  const h=createHistory();
  h.commit('a'); h.commit('b'); h.commit('c');
  h.undo();                 // current = 'b'
  assert.equal(h.canRedo(),true);
  assert.equal(h.commit('d'),true);
  assert.equal(h.canRedo(),false);
  assert.equal(h.getCurrent(),'d');
  assert.equal(h.undo(),'b');
});

test('the past is capped at the configured limit',()=>{
  const h=createHistory({limit:2});
  h.commit('1'); h.commit('2'); h.commit('3'); h.commit('4');
  assert.equal(h.getCurrent(),'4');
  assert.equal(h.undo(),'3');
  assert.equal(h.undo(),'2');
  assert.equal(h.canUndo(),false);   // '1' was dropped by the cap
});
