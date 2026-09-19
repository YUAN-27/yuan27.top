import test from 'node:test';
import assert from 'node:assert/strict';
import { levenshtein, closest } from '../js/suggest.js';

test('levenshtein: basic edits', () => {
  assert.equal(levenshtein('cat', 'cat'), 0);
  assert.equal(levenshtein('cat', 'cut'), 1);
  assert.equal(levenshtein('cat', 'cart'), 1);
  assert.equal(levenshtein('cat', 'at'), 1);
  assert.equal(levenshtein('', 'abc'), 3);
  assert.equal(levenshtein('abc', ''), 3);
});

test('levenshtein: adjacent transposition counts as 1', () => {
  assert.equal(levenshtein('cat', 'cta'), 1);
  assert.equal(levenshtein('help', 'hepl'), 1);
});

test('closest: suggests near misses', () => {
  const cmds = ['ls', 'cd', 'cat', 'help', 'pwd', 'theme'];
  assert.equal(closest('lss', cmds), 'ls');
  assert.equal(closest('hepl', cmds), 'help');
  assert.equal(closest('cta', cmds), 'cat');
  assert.equal(closest('pwdd', cmds), 'pwd');
  assert.equal(closest('PYWD', cmds), 'pwd'); // case-insensitive
});

test('closest: no suggestion for unrelated input', () => {
  const cmds = ['ls', 'cd', 'cat', 'help'];
  assert.equal(closest('xyzzy', cmds), null);
  assert.equal(closest('xq', cmds), null);
});
