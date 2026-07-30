import assert from 'node:assert/strict';
import test from 'node:test';

import { toHex, sanitizeColor } from '../src/style-editor.js';

test('toHex expands and normalizes colors for the native color input',()=>{
  assert.equal(toHex('#abc'),'#aabbcc');
  assert.equal(toHex('#aabbcc'),'#aabbcc');
  assert.equal(toHex('rgb(255, 0, 16)'),'#ff0010');
  assert.equal(toHex(''),'#000000');
  assert.equal(toHex(null),'#000000');
  assert.equal(toHex('not-a-color'),'#000000');
});

test('sanitizeColor accepts valid hex and rejects everything else',()=>{
  assert.equal(sanitizeColor('#ABCDEF'),'#abcdef');
  assert.equal(sanitizeColor('#abc'),'#aabbcc');
  assert.equal(sanitizeColor('  #123456  '),'#123456');
  assert.equal(sanitizeColor('red'),null);
  assert.equal(sanitizeColor('#12'),null);
  assert.equal(sanitizeColor('#1234567'),null);
  assert.equal(sanitizeColor(123),null);
  assert.equal(sanitizeColor(null),null);
  assert.equal(sanitizeColor(undefined),null);
});
