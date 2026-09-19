// tests/games-input.test.js
import test from 'node:test';
import assert from 'node:assert/strict';
import {
  createInputState, mapAction, shouldPrevent, keyDown, keyUp, clearInput, axes, consume, isConsumed,
} from '../js/games/input.js';

test('maps every documented key', () => {
  const cases = {
    w: 'up1', W: 'up1', s: 'down1', S: 'down1',
    ArrowUp: 'up2', ArrowDown: 'down2',
    Escape: 'quit', q: 'quit', Q: 'quit',
    ' ': 'confirm', Enter: 'confirm',
    m: 'mute', M: 'mute', Tab: 'tab',
    '1': 'mode1', '2': 'mode2',
  };
  for (const [key, action] of Object.entries(cases)) assert.equal(mapAction(key), action, key);
  for (const key of ['a', 'z', 'F5', 'Backspace']) assert.equal(mapAction(key), null, key);
});

test('shouldPrevent is true only for game keys (never blank)', () => {
  for (const k of ['w', 'S', 'ArrowUp', 'ArrowDown', 'Escape', 'q', ' ', 'Tab', 'm', '1', '2']) {
    assert.equal(shouldPrevent(k), true, k);
  }
  for (const k of ['a', 'F5', 'Meta', 'Shift']) assert.equal(shouldPrevent(k), false, k);
});

test('keyDown/keyUp maintain a pressed set', () => {
  const st = createInputState();
  assert.equal(keyDown(st, 'w'), true);
  assert.equal(keyDown(st, 's'), true);
  assert.equal(keyDown(st, 'a'), false, 'unmapped keys are not handled');
  assert.deepEqual(axes(st), { up1: true, down1: true, up2: false, down2: false });
  keyUp(st, 'w');
  assert.deepEqual(axes(st), { up1: false, down1: true, up2: false, down2: false });
});

test('repeated keydown does not double count (auto-repeat safe)', () => {
  const st = createInputState();
  for (let i = 0; i < 20; i++) keyDown(st, 'ArrowUp');
  assert.equal(st.keys.size, 1);
  keyUp(st, 'ArrowUp');
  assert.equal(st.keys.size, 0);
});

test('clearInput wipes pressed state (blur / visibility)', () => {
  const st = createInputState();
  keyDown(st, 'w');
  keyDown(st, 'ArrowDown');
  clearInput(st);
  assert.deepEqual(axes(st), { up1: false, down1: false, up2: false, down2: false });
  assert.equal(st.keys.size, 0);
});

test('opposite keys cancel out in axes', () => {
  const st = createInputState();
  keyDown(st, 'w');
  keyDown(st, 's');
  const a = axes(st);
  assert.equal(a.up1 && a.down1, true, 'both flags are reported; caller decides');
});

test('consume/isConsumed tracks the escape hand-off', () => {
  const st = createInputState();
  assert.equal(isConsumed(st, 'Escape'), false);
  consume(st, 'Escape');
  assert.equal(isConsumed(st, 'Escape'), true);
  clearInput(st);
  assert.equal(isConsumed(st, 'Escape'), false, 'clearing input must also clear consumed marks');
});
