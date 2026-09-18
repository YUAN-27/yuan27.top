import test from 'node:test';
import assert from 'node:assert/strict';
import { normalize, resolve, getNode } from '../js/fs.js';

test('normalize collapses slashes, dots and ..', () => {
  assert.equal(normalize('/a//b/./c/'), '/a/b/c');
  assert.equal(normalize('/a/../b'), '/b');
  assert.equal(normalize('/'), '/');
  assert.equal(normalize(''), '/');
  assert.equal(normalize('/../../a'), '/a'); // .. above root clamps
});

test('resolve relative and absolute paths', () => {
  assert.equal(resolve('/', 'about'), '/about');
  assert.equal(resolve('/about', '..'), '/');
  assert.equal(resolve('/about', '../projects'), '/projects');
  assert.equal(resolve('/', '~'), '/');
  assert.equal(resolve('/projects/ai-agent', '~'), '/');
  assert.equal(resolve('/about', '/blog'), '/blog');
  assert.equal(resolve('/about', '.'), '/about');
  assert.equal(resolve('/', ''), '/');
});

test('getNode finds dirs and files', () => {
  assert.equal(getNode('/').type, 'dir');
  assert.equal(getNode('/about').type, 'dir');
  assert.equal(getNode('/about/bio.md').type, 'file');
  assert.equal(getNode('/about/nope.md'), null);
  assert.equal(getNode('/resume/resume.pdf').binary, true);
});
