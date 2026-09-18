import test from 'node:test';
import assert from 'node:assert/strict';
import { parse } from '../js/parser.js';

test('parse command and args', () => {
  assert.deepEqual(parse('ls'), { command: 'ls', args: [], raw: 'ls' });
  assert.deepEqual(parse('cd projects'), { command: 'cd', args: ['projects'], raw: 'cd projects' });
  assert.deepEqual(parse('cat about/bio.md'), { command: 'cat', args: ['about/bio.md'], raw: 'cat about/bio.md' });
  assert.deepEqual(parse('   help   cat  '), { command: 'help', args: ['cat'], raw: 'help   cat' });
});

test('parse empty input returns null', () => {
  assert.equal(parse(''), null);
  assert.equal(parse('   '), null);
});
