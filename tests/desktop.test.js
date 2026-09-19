import test from 'node:test';
import assert from 'node:assert/strict';
import { ENTRIES } from '../js/content.js';
import {
  entryCommands, makeClickHandler, makeOpener,
  DESKTOP_MIN_WIDTH, DOUBLE_CLICK_MS,
  DESKTOP_RAIL_WIDTH, ICON_COLUMN_LEFT, ICON_COLUMN_WIDTH,
} from '../js/desktop.js';
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

test('desktop layer is desktop-only and matches the CSS breakpoint', () => {
  // 硬规则 docs 1.3.1：≤640px 不渲染桌面入口；CSS 用 max-width:640 / min-width:641。
  assert.equal(DESKTOP_MIN_WIDTH, 641);
  assert.ok(DOUBLE_CLICK_MS >= 300 && DOUBLE_CLICK_MS <= 700, `双击窗口不合理: ${DOUBLE_CLICK_MS}`);
});

test('the left rail is wide enough to hold the whole icon column', () => {
  const right = ICON_COLUMN_LEFT + ICON_COLUMN_WIDTH;
  assert.ok(DESKTOP_RAIL_WIDTH >= right, `rail ${DESKTOP_RAIL_WIDTH} < 图标列右边界 ${right}`);
});

test('opening a folder entry cds into it and lists subfolders + files', () => {
  const calls = [];
  const open = makeOpener({
    restore: () => calls.push('restore'),
    focus: () => calls.push('focus'),
    run: (cmd) => calls.push(cmd),
  });
  open(ENTRIES.find((e) => e.id === 'about'));
  assert.deepEqual(calls, ['restore', 'focus', 'cd /about', 'ls']);

  calls.length = 0;
  open(ENTRIES.find((e) => e.id === 'projects'));
  assert.deepEqual(calls, ['restore', 'focus', 'cd /projects', 'ls']);

  calls.length = 0;
  open(ENTRIES.find((e) => e.id === 'resume'));
  assert.deepEqual(calls, ['restore', 'focus', 'resume']);
});

test('double-click opens; two slow clicks just select', () => {
  let t = 1000;
  const events = [];
  const click = makeClickHandler({
    open: () => events.push('open'),
    select: () => events.push('select'),
    refocus: () => events.push('focus'),
    now: () => t,
  });

  click({ detail: 1 }); // 第一次单击 -> 选中
  assert.deepEqual(events, ['select', 'focus']);

  t += 200; // 500ms 内 -> 双击
  click({ detail: 2 });
  assert.deepEqual(events, ['select', 'focus', 'open']);

  events.length = 0;
  t += 5000; click({ detail: 1 }); // 两次慢点击 -> 只选中，不打开
  t += 5000; click({ detail: 1 });
  assert.deepEqual(events, ['select', 'focus', 'select', 'focus']);
});

test('keyboard activation (detail 0) opens immediately', () => {
  const events = [];
  const click = makeClickHandler({ open: () => events.push('open'), select: () => events.push('select') });
  click({ detail: 0 });
  assert.deepEqual(events, ['open']);
});
