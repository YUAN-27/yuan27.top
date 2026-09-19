import test from 'node:test';
import assert from 'node:assert/strict';
import { buildMenu, itemCommands, settingCommands, TASKBAR_MIN_WIDTH } from '../js/taskbar.js';
import { ENTRIES } from '../js/content.js';
import { commandNames } from '../js/commands.js';

test('buildMenu: four groups, no duplicate labels, no empty groups', () => {
  const menu = buildMenu(ENTRIES);
  assert.deepEqual(menu.map((g) => g.title), ['Explore', 'Profile', 'Settings', 'Actions']);
  const labels = menu.flatMap((g) => g.items.map((i) => i.label));
  assert.equal(new Set(labels).size, labels.length, '菜单项不应重复');
  assert.ok(menu.every((g) => g.items.length > 0), '不应有空分组');
});

test('buildMenu: every item points at something real', () => {
  const ids = new Set(ENTRIES.map((e) => e.id));
  for (const group of buildMenu(ENTRIES)) {
    for (const item of group.items) {
      if (item.type === 'entry') assert.ok(ids.has(item.entry.id), `未知入口: ${item.entry.id}`);
      if (item.type === 'command') assert.ok(commandNames.includes(item.value), `未知命令: ${item.value}`);
      if (item.type === 'setting') assert.ok(['motion', 'sound', 'theme'].includes(item.value), item.value);
      if (item.type === 'action') assert.ok(['open', 'focus', 'reset'].includes(item.value), item.value);
    }
  }
});

test('buildMenu: tolerates a partial ENTRIES list', () => {
  const menu = buildMenu([{ id: 'about', label: 'About', kind: 'folder', path: '/about' }]);
  const labels = menu.flatMap((g) => g.items.map((i) => i.label));
  assert.ok(labels.includes('About'));
  assert.ok(!labels.includes('Projects'));
  assert.ok(menu.every((g) => g.items.length > 0), '空分组应被过滤');
});

test('itemCommands: entry / command / setting / action / null', () => {
  assert.deepEqual(itemCommands({ type: 'entry', entry: { path: '/about' } }), ['cd /about', 'ls']);
  assert.deepEqual(itemCommands({ type: 'entry', entry: { command: 'resume' } }), ['resume']);
  assert.deepEqual(itemCommands({ type: 'command', value: 'neofetch' }), ['neofetch']);
  assert.deepEqual(itemCommands({ type: 'action', value: 'focus' }), [], 'action 不给终端命令');
  assert.deepEqual(itemCommands(null), []);
});

test('settingCommands: toggles motion/sound and cycles themes', () => {
  assert.deepEqual(settingCommands('motion', { motionOff: false }), ['motion off']);
  assert.deepEqual(settingCommands('motion', { motionOff: true }), ['motion on']);
  assert.deepEqual(settingCommands('sound', { soundOn: false }), ['sound on']);
  assert.deepEqual(settingCommands('sound', { soundOn: true }), ['sound off']);

  const themes = ['claude', 'light', 'matrix', 'dracula'];
  assert.deepEqual(settingCommands('theme', { themes, theme: 'claude' }), ['theme light']);
  assert.deepEqual(settingCommands('theme', { themes, theme: 'dracula' }), ['theme claude']);
  assert.deepEqual(settingCommands('theme', { themes }), ['theme claude'], '未知当前主题时回到第一个');
  assert.deepEqual(settingCommands('theme', { themes: [] }), []);
  assert.deepEqual(settingCommands('nope', {}), []);
});

test('taskbar is desktop-only, same breakpoint as the desktop layer', () => {
  assert.equal(TASKBAR_MIN_WIDTH, 641);
});

test('start menu can reopen a closed terminal', () => {
  const actions = buildMenu(ENTRIES)
    .find((g) => g.title === 'Actions')
    .items.map((i) => i.value);
  assert.ok(actions.includes('open'), '缺少 Open Terminal 动作');
  assert.ok(actions.includes('focus'));
  assert.ok(actions.includes('reset'));
});
