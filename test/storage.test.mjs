import assert from 'node:assert/strict';
import test from 'node:test';

// Minimal in-memory localStorage so storage.js exercises its real code paths.
class MemStore{
  constructor(){ this.map=new Map(); }
  getItem(k){ return this.map.has(k) ? this.map.get(k) : null; }
  setItem(k,v){ this.map.set(k,String(v)); }
  removeItem(k){ this.map.delete(k); }
}
globalThis.localStorage=new MemStore();

const KEY='curva-state-v1';
const { loadState, saveState, clearState } = await import('../src/storage.js');

test('saveState round-trips through loadState and stamps a version',()=>{
  saveState({theme:'dark', view:{cx:1,cy:2,scale:50}});
  const s=loadState();
  assert.equal(s.version,1);
  assert.equal(s.theme,'dark');
  assert.deepEqual(s.view,{cx:1,cy:2,scale:50});
});

test('loadState returns null when nothing is stored',()=>{
  localStorage.removeItem(KEY);
  assert.equal(loadState(),null);
});

test('loadState rejects data from a different version',()=>{
  localStorage.setItem(KEY, JSON.stringify({version:2, theme:'dark'}));
  assert.equal(loadState(),null);
});

test('loadState swallows malformed JSON',()=>{
  localStorage.setItem(KEY, '{not valid json');
  assert.equal(loadState(),null);
});

test('clearState removes the stored state',()=>{
  saveState({theme:'light'});
  assert.notEqual(loadState(),null);
  clearState();
  assert.equal(loadState(),null);
});
