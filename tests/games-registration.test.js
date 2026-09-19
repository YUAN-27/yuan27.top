// tests/games-registration.test.js
import test from 'node:test';
import assert from 'node:assert/strict';
import { registry, commandNames } from '../js/commands.js';
import { complete } from '../js/completion.js';

test('arcade is registered in the Fun category', () => {
  assert.ok(registry.arcade, 'registry.arcade missing');
  assert.equal(registry.arcade.category, 'Fun');
  assert.equal(typeof registry.arcade.run, 'function');
  assert.ok(registry.arcade.summary.length > 0);
  assert.ok(registry.arcade.help.includes('Usage'));
});

test('commandNames and tab completion pick arcade up automatically', () => {
  assert.ok(commandNames.includes('arcade'));
  const r = complete('ar', '/', commandNames);
  assert.ok(r && r.replace && r.replace.startsWith('arcade'));
});

test('help output includes arcade (derived from the registry)', async () => {
  const out = [];
  const shell = {
    cwd: '/',
    term: { clear() {} },
    error: (m) => out.push(m), success: (m) => out.push(m), muted: (m) => out.push(m),
    printLines: (l) => out.push(Array.isArray(l) ? l.join('\n') : l),
    printText: (l) => out.push(Array.isArray(l) ? l.join('\n') : l),
    printChars: (t) => out.push(t),
  };
  await registry.help.run(shell, []);
  assert.ok(out.join('\n').includes('arcade'));
});
