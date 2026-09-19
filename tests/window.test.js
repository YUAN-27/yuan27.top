import test from 'node:test';
import assert from 'node:assert/strict';
import { hitDir, resizeRect, clampPosition, RESIZE_BORDER } from '../js/windowing.js';

// A 500x400 window at (100,100) — above the 420x300 minimum.
const R = { left: 100, top: 100, right: 600, bottom: 500, width: 500, height: 400 };
const S = { left: 100, top: 100, w: 500, h: 400 };

test('hitDir: center is empty', () => {
  assert.equal(hitDir(R, 350, 300), '');
});

test('hitDir: edges', () => {
  assert.equal(hitDir(R, 100, 300), 'w');
  assert.equal(hitDir(R, 600, 300), 'e');
  assert.equal(hitDir(R, 350, 100), 'n');
  assert.equal(hitDir(R, 350, 500), 's');
});

test('hitDir: corners', () => {
  assert.equal(hitDir(R, 100, 100), 'nw');
  assert.equal(hitDir(R, 600, 100), 'ne');
  assert.equal(hitDir(R, 100, 500), 'sw');
  assert.equal(hitDir(R, 600, 500), 'se');
});

test('hitDir: border tolerance', () => {
  assert.equal(hitDir(R, 100 + RESIZE_BORDER, 300), 'w');
  assert.equal(hitDir(R, 100 + RESIZE_BORDER + 1, 300), '');
});

test('resizeRect: east/west anchor the opposite edge', () => {
  assert.deepEqual(resizeRect(S, 'e', 50, 0), { left: 100, top: 100, w: 550, h: 400 });
  assert.deepEqual(resizeRect(S, 'w', -50, 0), { left: 50, top: 100, w: 550, h: 400 });
});

test('resizeRect: north/south', () => {
  assert.deepEqual(resizeRect(S, 's', 0, 40), { left: 100, top: 100, w: 500, h: 440 });
  assert.deepEqual(resizeRect(S, 'n', 0, 40), { left: 100, top: 140, w: 500, h: 360 });
});

test('resizeRect: corner', () => {
  assert.deepEqual(resizeRect(S, 'se', 30, 20), { left: 100, top: 100, w: 530, h: 420 });
});

test('resizeRect: only the resized axis is clamped, opposite edge anchored', () => {
  // w: width clamped to 420, right edge stays at 600.
  assert.deepEqual(resizeRect(S, 'w', 200, 0, 420, 300), { left: 180, top: 100, w: 420, h: 400 });
  // n: height clamped to 300, bottom edge stays at 500.
  assert.deepEqual(resizeRect(S, 'n', 0, 300, 420, 300), { left: 100, top: 200, w: 500, h: 300 });
  // A vertical resize must not touch width even when it is below minW.
  assert.deepEqual(resizeRect({ left: 0, top: 0, w: 200, h: 400 }, 's', 0, 20), { left: 0, top: 0, w: 200, h: 420 });
});

test('clampPosition: keeps window on screen', () => {
  const vp = { width: 1000, height: 800 };
  assert.deepEqual(clampPosition({ left: -9999, top: -50, w: 400, h: 300 }, vp), { left: -280, top: 0 });
  assert.deepEqual(clampPosition({ left: 9999, top: 9999, w: 400, h: 300 }, vp), { left: 880, top: 760 });
});
