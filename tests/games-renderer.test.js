// tests/games-renderer.test.js
import test from 'node:test';
import assert from 'node:assert/strict';
import {
  CHAR_RANGES, isAllowedChar, blankGrid, blit, box,
  layoutFor, buildFrame, gridToString, diffRows, withinWhitelist,
} from '../js/games/renderer.js';

test('whitelist is exactly the font subset ranges', () => {
  // 允许：ASCII + 边界值 U+257F / U+2588 / U+276F / U+2192
  // ⚠️ U+2554（╔）落在 U+2500–257F 区间内，是合法的，不能拿来当反例
  for (const ch of [' ', '~', 'A', 'z', '0', '─', '│', '┌', '┐', '└', '┘', '├', '┤', '█', '→', '❯', '╔', '\u257f']) {
    assert.ok(isAllowedChar(ch), `should allow ${ch}`);
  }
  // 拒绝：半块/点/箭头/汉字/重音，以及区间边界外一格
  for (const ch of ['●', '↑', '↓', '▄', '▀', '\u24ff', '\u2590', '你', 'é', '·']) {
    assert.ok(!isAllowedChar(ch), `should reject ${ch}`);
  }
  assert.equal(CHAR_RANGES.length, 5);
});

test('blankGrid has exact dimensions filled with spaces', () => {
  const g = blankGrid(10, 4);
  assert.equal(g.length, 4);
  for (const row of g) {
    assert.equal(row.length, 10);
    assert.equal(row, ' '.repeat(10));
  }
});

test('blit writes text at a position and never changes row width', () => {
  const g = blankGrid(8, 2);
  blit(g, 2, 1, 'ABC');
  assert.equal(g[1], '  ABC   ');
  assert.equal(g[0], '        ');
  assert.equal(g[1].length, 8);
});

test('blit clips at edges and ignores out-of-range coordinates', () => {
  const g = blankGrid(5, 2);
  blit(g, 3, 0, 'XYZ');
  assert.equal(g[0], '   XY');
  blit(g, -1, 0, 'Q');
  assert.equal(g[0], '   XY');
  blit(g, 0, 9, 'Q');
  assert.equal(g.length, 2);
});

test('box draws a closed rectangle using whitelisted glyphs', () => {
  const g = blankGrid(6, 4);
  box(g, 0, 0, 6, 4);
  assert.equal(g[0], '┌────┐');
  assert.equal(g[3], '└────┘');
  assert.equal(g[1], '│    │');
  assert.ok(withinWhitelist(g));
});

test('layoutFor keeps the playfield strictly inside the frame', () => {
  const L = layoutFor(80, 24);
  assert.equal(L.cols, 80);
  assert.equal(L.rows, 24);
  assert.equal(L.scoreRow, 3);
  assert.equal(L.fieldTop, 4);
  assert.equal(L.fieldBottom, 22);
  assert.equal(L.fieldRows, 19);
  assert.equal(L.innerW, 78);
  assert.equal(L.cx, 40);
  // 场内行必须严格落在边框内部
  assert.ok(L.fieldTop > 2 && L.fieldBottom < L.rows - 1);
});

test('layoutFor clamps to sane bounds and works at the minimum grid', () => {
  const small = layoutFor(20, 8);
  assert.ok(small.cols >= 40 && small.rows >= 12, 'must clamp up to the minimum grid');
  const big = layoutFor(400, 200);
  assert.ok(big.cols <= 120 && big.rows <= 40, 'must clamp down to the maximum grid');
});

test('buildFrame produces a full grid with title and footer inside the whitelist', () => {
  const { grid, layout } = buildFrame({ title: 'yuan27.top :: arcade :: pong', cols: 60, rows: 20 });
  assert.equal(grid.length, layout.rows);
  for (const row of grid) assert.equal(row.length, layout.cols);
  assert.ok(grid[0].startsWith('┌'));
  assert.ok(grid.at(-1).startsWith('└'));
  assert.ok(grid[1].includes('yuan27.top :: arcade :: pong'));
  assert.ok(withinWhitelist(grid));
});

test('buildFrame draws a dashed center line only inside the playfield', () => {
  const { grid, layout } = buildFrame({ title: 'T', cols: 41, rows: 20 });
  const col = layout.cx;
  assert.equal(grid[layout.scoreRow][col], ' ', 'the score row must stay empty at the center');
  assert.equal(grid[0][col], '─', 'the top border must not be the center line');
  assert.equal(grid[layout.fieldTop][col], '│');
  assert.equal(grid[layout.fieldTop + 1][col], ' ', 'the center line must be dashed');
  assert.equal(grid[layout.fieldTop + 2][col], '│');
  assert.equal(grid[layout.fieldBottom][col], '│', 'the last field row must still be dashed');
});

test('gridToString returns the same rows as an array', () => {
  const g = blankGrid(4, 3);
  const lines = gridToString(g);
  assert.equal(lines.length, 3);
  assert.deepEqual(lines, g);
});

test('diffRows reports only changed rows and tolerates length changes', () => {
  assert.deepEqual(diffRows(['a', 'b'], ['a', 'c']), [1]);
  assert.deepEqual(diffRows(['a', 'b'], ['a', 'b']), []);
  assert.deepEqual(diffRows(['a'], ['a', 'b', 'c']), [1, 2]);
  assert.deepEqual(diffRows(['a', 'b', 'c'], ['a']), [1, 2]);
});

test('withinWhitelist detects a single illegal glyph', () => {
  const g = blankGrid(6, 1);
  assert.ok(withinWhitelist(g));
  blit(g, 0, 0, '●');
  assert.ok(!withinWhitelist(g));
});
