import test from 'node:test';
import assert from 'node:assert/strict';
import { hitDir, resizeRect, clampPosition, RESIZE_BORDER, MIN_W, MIN_H, defaultGeom } from '../js/windowing.js';
import { LOGO } from '../js/content.js';

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

test('MIN_W fits the widest logo line (with output padding + border)', () => {
  const maxLen = Math.max(...LOGO.split('\n').map((l) => l.length));
  const charW = 0.6 * 14; // JetBrains Mono advance width at 14px
  const needed = Math.ceil(maxLen * charW) + 32 + 2;
  assert.ok(MIN_W >= needed, `MIN_W=${MIN_W} < ${needed}`);
});

test('MIN_H fits the logo plus the window chrome', () => {
  const logoLines = LOGO.split('\n').filter((l) => l.length > 0).length;
  const needed = Math.ceil(logoLines * 1.6 * 14) + 36 /*statusbar*/ + 43 /*input*/ + 32 /*padding*/;
  assert.ok(MIN_H >= needed, `MIN_H=${MIN_H} < ${needed}`);
});

test('defaultGeom: big by default, clamped to min and viewport', () => {
  // Large screen -> capped at 1200x800.
  assert.deepEqual(defaultGeom({ width: 1920, height: 1080 }), { w: 1200, h: 800 });
  // Shorter viewport -> height follows the viewport (86%).
  assert.deepEqual(defaultGeom({ width: 1366, height: 657 }), { w: 1200, h: 565 });
  // Small desktop window -> scales down but stays above the minimum.
  assert.deepEqual(defaultGeom({ width: 800, height: 600 }), { w: 736, h: 516 });
  // Never below the minimum size.
  assert.deepEqual(defaultGeom({ width: 500, height: 340 }), { w: 480, h: 320 });
  // Always bigger than the minimum on a normal desktop.
  for (const vp of [{ width: 1440, height: 900 }, { width: 1280, height: 720 }]) {
    const g = defaultGeom(vp);
    assert.ok(g.w > MIN_W && g.h > MIN_H, `${vp.width}x${vp.height} -> ${g.w}x${g.h}`);
  }
});
