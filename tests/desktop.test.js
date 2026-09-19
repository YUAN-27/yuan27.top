import test from 'node:test';
import assert from 'node:assert/strict';
import { ENTRIES } from '../js/content.js';
import { entryCommands, DESKTOP_BREAKPOINT } from '../js/desktop.js';
import { getNode } from '../js/fs.js';
import { commandNames } from '../js/commands.js';

test('ENTRIES: unique ids, labels, and exactly one mapping each', () => {
  const ids = ENTRIES.map((e) => e.id);
  assert.equal(new Set(ids).size, ids.length, 'ids must be unique');
  for (const e of ENTRIES) {
    assert.ok(e.id && e.label, `${e.id}: id/label required`);
    assert.equal(typeof e.label, 'string', `${e.id}: label is a string`);
    assert.ok(!!e.path !== !!e.command, `${e.id}: exactly one of path/command`);
  }
});

test('ENTRIES: folder targets really exist in the VFS', () => {
  for (const e of ENTRIES) {
    if (!e.path) continue;
    const node = getNode(e.path);
    assert.ok(node, `${e.id}: ${e.path} exists`);
    assert.equal(node.type, 'dir', `${e.id}: ${e.path} is a directory`);
  }
});

test('ENTRIES: commands point at registered commands', () => {
  const names = new Set(commandNames);
  for (const e of ENTRIES) {
    if (!e.command) continue;
    const head = e.command.split(/\s+/)[0];
    assert.ok(names.has(head), `${e.id}: '${head}' is registered`);
  }
});

test('entryCommands: folders cd + ls, others run their command', () => {
  assert.deepEqual(entryCommands({ path: '/about' }), ['cd /about', 'ls']);
  assert.deepEqual(entryCommands({ path: '/projects' }), ['cd /projects', 'ls']);
  assert.deepEqual(entryCommands({ command: 'resume' }), ['resume']);
  assert.deepEqual(entryCommands({ command: 'cat readme.md' }), ['cat readme.md']);
  assert.deepEqual(entryCommands({}), []);
});

test('desktop layer breakpoint matches the CSS mobile rule', () => {
  // 硬规则 docs 1.3.1：≤640px 不渲染桌面入口。
  assert.equal(DESKTOP_BREAKPOINT, 640);
});
