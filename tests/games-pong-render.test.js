// tests/games-pong-render.test.js
import test from 'node:test';
import assert from 'node:assert/strict';
import { C, createGame, render } from '../js/games/pong.js';
import { buildFrame, withinWhitelist, diffRows } from '../js/games/renderer.js';

function frame(cols = 60, rows = 20) {
  const f = buildFrame({ title: 'yuan27.top :: arcade :: pong', cols, rows });
  const staticRows = f.grid.slice();
  return { ...f, staticRows };
}

const countOf = (grid, ch) => grid.join('').split(ch).length - 1;   // 供后续断言复用

// 显式进入对局：phase='menu' 时 render() 走菜单分支直接 return，
// 不设 phase 的「渲染测试」会空转（数到的是菜单文本里的字符）。
function playing(score = [0, 0]) {
  const s = createGame({ rng: () => 0.5 });
  s.phase = 'play';
  s.score = score;
  s.speed = 0.5;
  s.vel = { x: 0.5, y: 0 };
  return s;
}

test('render returns one row per layout row, all whitelisted', () => {
  const s = createGame({ rng: () => 0.5 });
  const f = frame();
  const rows = render(s, f);
  assert.equal(rows.length, f.layout.rows);
  for (const row of rows) assert.equal(row.length, f.layout.cols);
  assert.ok(withinWhitelist(rows));
});

test('render draws the score on the score row', () => {
  const s = createGame({ rng: () => 0.5 });
  s.score = [7, 5];
  const f = frame();
  const rows = render(s, f);
  assert.ok(rows[f.layout.scoreRow].includes('07'));
  assert.ok(rows[f.layout.scoreRow].includes('05'));
});

test('render draws two paddles of the expected height inside the field', () => {
  const s = playing();
  const f = frame();
  const rows = render(s, f);
  const field = rows.slice(f.layout.fieldTop, f.layout.fieldBottom + 1).join('');
  const blocks = field.split('█').length - 1;
  const expectedPer = Math.max(2, Math.round(s.paddles[0].h * f.layout.fieldRows));
  assert.equal(blocks, expectedPer * 2, 'only the two paddles may draw the block glyph');
  // 挡板必须分列在左右两侧
  for (const y of rows.slice(f.layout.fieldTop, f.layout.fieldBottom + 1)) {
    const left = y.indexOf('█');
    const right = y.lastIndexOf('█');
    if (left >= 0 && right > left) assert.ok(right - left > f.layout.cols / 2, 'paddles must be far apart');
  }
});

test('render draws the ball inside the playfield', () => {
  const s = playing();
  s.ball.x = 0.5;
  s.ball.y = 0.5;
  const f = frame();
  const rows = render(s, f);
  const field = rows.slice(f.layout.fieldTop, f.layout.fieldBottom + 1);
  const cells = field.map((r, i) => ({ r, i })).filter(({ r }) => r.includes('*'));
  assert.equal(countOf(field, '*'), 1, 'exactly one ball cell must be drawn');
  assert.equal(cells.length, 1, 'the ball must be a single row');
});

test('the ball glyph is the only asterisk on screen (no text collision)', () => {
  const s = playing();
  const f = frame();
  for (const ph of ['menu', 'serve', 'play', 'gameover']) {
    s.phase = ph;
    const rows = render(s, f);
    const n = countOf(rows, '*');
    assert.ok(n === 0 || n === 1, `phase ${ph} drew ${n} asterisks; menu/gameover text must not contain the ball glyph`);
  }
});

test('menu phase shows the mode choices and hides the ball', () => {
  const s = createGame({ rng: () => 0.5 });
  const f = frame();
  const rows = render(s, f);
  const mid = rows.slice(f.layout.fieldTop, f.layout.fieldBottom + 1).join('\n');
  assert.ok(mid.includes('PONG'));
  assert.ok(mid.includes('[1] Single'));
  assert.ok(mid.includes('[2] Two'));
  assert.ok(!mid.includes('*'), 'the ball must not be drawn in the menu');
});

test('gameover phase shows the winner and final score', () => {
  const s = createGame({ rng: () => 0.5 });
  s.score = [11, 4];
  s.winner = 0;
  s.phase = 'gameover';
  const f = frame();
  const mid = render(s, f).slice(f.layout.fieldTop, f.layout.fieldBottom + 1).join('\n');
  assert.ok(mid.includes('PLAYER 1 WINS') || mid.includes('WINS'));
  assert.ok(mid.includes('11'));
  assert.ok(mid.includes('04'));
});

test('render is stable: two identical states produce zero diff', () => {
  const s = createGame({ rng: () => 0.5 });
  const f = frame();
  const a = render(s, f);
  const b = render(s, f);
  assert.deepEqual(diffRows(a, b), []);
});

test('render preserves the static frame (only dynamic rows differ)', () => {
  const s = createGame({ rng: () => 0.5 });
  const f = frame();
  const rows = render(s, f);
  const changed = diffRows(f.staticRows, rows);
  for (const i of changed) {
    assert.ok(
      i === f.layout.scoreRow || (i >= f.layout.fieldTop && i <= f.layout.fieldBottom),
      `static row ${i} was modified`,
    );
  }
});

test('render never writes outside the playfield for extreme positions', () => {
  const s = playing();
  const f = frame();
  for (const [x, y] of [[0, 0], [1, 1], [0, 1], [1, 0], [-0.5, 0.5], [0.5, 2]]) {
    s.ball.x = x;
    s.ball.y = y;
    const rows = render(s, f);
    assert.equal(rows.length, f.layout.rows);
    assert.ok(withinWhitelist(rows));
    const changed = diffRows(f.staticRows, rows);
    for (const i of changed) {
      assert.ok(
        i === f.layout.scoreRow || (i >= f.layout.fieldTop && i <= f.layout.fieldBottom),
        `ball at (${x},${y}) wrote row ${i} outside the playfield`,
      );
    }
  }
});
