// tests/games-host.test.js
import test from 'node:test';
import assert from 'node:assert/strict';
import { createHost } from '../js/games/host.js';

test('createHost without a mount point returns an inert host instead of throwing', () => {
  const host = createHost({});
  assert.equal(typeof host.mount, 'function');
  const h = host.mount({});
  assert.equal(h.root, null);
  assert.doesNotThrow(() => host.paint([], []));
  assert.doesNotThrow(() => host.teardown());
});

test('host exposes the full contract used by session.js', () => {
  const host = createHost({});
  for (const fn of ['mount', 'paint', 'setStatus', 'onResize', 'onVisibility', 'onBlur', 'onFocus', 'onKeyDown', 'onKeyUp', 'now', 'raf', 'cancelRAF', 'focus', 'restoreFocus', 'setTouchVisible', 'teardown']) {
    assert.equal(typeof host[fn], 'function', `missing ${fn}`);
  }
  for (const fn of ['onResize', 'onVisibility', 'onBlur', 'onFocus', 'onKeyDown', 'onKeyUp']) {
    const off = host[fn](() => {});
    assert.equal(typeof off, 'function', `${fn} must return a disposer`);
    off();
  }
});
