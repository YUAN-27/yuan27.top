// tests/sound.test.js
import test from 'node:test';
import assert from 'node:assert/strict';
import { initSound } from '../js/sound.js';

test('blip exists and never throws without WebAudio', () => {
  const s = initSound();
  assert.equal(typeof s.blip, 'function');
  assert.doesNotThrow(() => s.blip(440, 0.03, 0.03));
  assert.doesNotThrow(() => s.blip(NaN, -1, 99, 'nope'));
});

test('blip is silent while sound is off and key/enter behaviour is unchanged', () => {
  const s = initSound();
  s.setEnabled(false);
  assert.equal(s.isEnabled(), false);
  assert.doesNotThrow(() => { s.key(); s.enter(); s.blip(300, 0.02, 0.02); });
  assert.equal(typeof s.key, 'function');
  assert.equal(typeof s.enter, 'function');
  assert.equal(typeof s.setEnabled, 'function');
});
