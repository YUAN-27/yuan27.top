import test from 'node:test';
import assert from 'node:assert/strict';
import {
  mulberry32, nodeCount, shouldLink, pickMode, fpsFor, dprFor, parseColor,
} from '../js/background.js';

test('mulberry32: deterministic for the same seed, in [0,1)', () => {
  const a = mulberry32(12345);
  const b = mulberry32(12345);
  const seqA = Array.from({ length: 6 }, () => a());
  const seqB = Array.from({ length: 6 }, () => b());
  assert.deepEqual(seqA, seqB);
  for (const v of seqA) assert.ok(v >= 0 && v < 1, `out of range: ${v}`);
});

test('mulberry32: different seeds give different streams', () => {
  assert.notEqual(mulberry32(1)(), mulberry32(2)());
});

test('nodeCount: desktop 30..60, reduced 12..24, off 0', () => {
  assert.equal(nodeCount(0, 'desktop'), 30);
  assert.equal(nodeCount(9999999, 'desktop'), 60);
  assert.equal(nodeCount(0, 'reduced'), 12);
  assert.equal(nodeCount(9999999, 'reduced'), 24);
  assert.equal(nodeCount(1920 * 1080, 'desktop'), 52); // 2073600 / 40000 ≈ 51.8
  assert.equal(nodeCount(1920 * 1080, 'off'), 0);
});

test('shouldLink: only for nearby nodes', () => {
  assert.equal(shouldLink(10, 120), true);
  assert.equal(shouldLink(119, 120), true);
  assert.equal(shouldLink(120, 120), false);
  assert.equal(shouldLink(500, 120), false);
});

test('pickMode: fallback ladder', () => {
  assert.equal(pickMode({}), 'full');
  assert.equal(pickMode({ lowPerf: true }), 'reduced');
  assert.equal(pickMode({ narrow: true }), 'reduced');
  assert.equal(pickMode({ mobile: true }), 'static');
  assert.equal(pickMode({ reducedMotion: true }), 'static');
  assert.equal(pickMode({ motionOff: true }), 'static');
  assert.equal(pickMode({ canvasOk: false }), 'gradient');
  // canvas failure wins over everything else
  assert.equal(pickMode({ canvasOk: false, mobile: true, motionOff: true, lowPerf: true }), 'gradient');
});

test('fpsFor / dprFor: performance caps', () => {
  assert.equal(fpsFor('full'), 30);
  assert.equal(fpsFor('reduced'), 20);
  assert.equal(dprFor('full', 3), 1.5);
  assert.equal(dprFor('reduced', 3), 1);
  assert.equal(dprFor('full', 1), 1);
  assert.equal(dprFor('full', undefined), 1);
});

test('parseColor: hex, rgb and fallback', () => {
  assert.deepEqual(parseColor('#8b949e'), { r: 139, g: 148, b: 158 });
  assert.deepEqual(parseColor('#fff'), { r: 255, g: 255, b: 255 });
  assert.deepEqual(parseColor('rgb(1, 2, 3)'), { r: 1, g: 2, b: 3 });
  assert.deepEqual(parseColor('garbage'), { r: 139, g: 148, b: 158 });
});
