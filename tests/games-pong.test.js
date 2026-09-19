// tests/games-pong.test.js
import test from 'node:test';
import assert from 'node:assert/strict';
import { C, meta, createState, update, isOver, restart, statusLine, handleKey, nextGame, sideName, winsNeeded } from '../js/games/pong.js';

const fixedRng = (v = 0.5) => () => v;
const newGame = (opts = {}) => createState({ rng: fixedRng(), ...opts });
const speed = (s) => Math.hypot(s.vel.x, s.vel.y);

test('meta exposes id/title/summary', () => {
  assert.equal(meta.id, 'pong');
  assert.ok(meta.title.length > 0 && meta.summary.length > 0);
});

test('initial state is menu with centered ball and zero score', () => {
  const s = newGame();
  assert.equal(s.phase, 'menu');
  assert.deepEqual(s.score, [0, 0]);
  assert.equal(s.ball.x, 0.5);
  assert.equal(s.ball.y, 0.5);
  assert.equal(s.paddles.length, 2);
  assert.equal(s.winner, null);
});

test('all numeric state stays inside [0,1] after many steps', () => {
  const s = newGame();
  handleKey(s, '1');                       // 进入单人
  for (let i = 0; i < 3000; i++) {
    update(s, 1 / 30, { up1: i % 97 < 40, down1: i % 131 < 30 });
    for (const p of s.paddles) {
      assert.ok(p.y >= 0 && p.y + p.h <= 1 + 1e-9, `paddle out of range: ${p.y}`);
    }
    assert.ok(s.ball.y >= -1e-9 && s.ball.y <= 1 + 1e-9, `ball out of range: ${s.ball.y}`);
  }
});

test('paddle moves with axes and stops at walls', () => {
  const s = newGame();
  handleKey(s, '1');
  const y0 = s.paddles[0].y;
  update(s, 0.1, { up1: true });
  assert.ok(s.paddles[0].y < y0, 'up1 should move paddle up');
  for (let i = 0; i < 200; i++) update(s, 0.1, { up1: true });
  assert.equal(s.paddles[0].y, 0);
  for (let i = 0; i < 200; i++) update(s, 0.1, { down1: true });
  assert.equal(s.paddles[0].y, 1 - C.PADDLE_H);
});

test('serve delay then play, ball leaves center toward serve direction', () => {
  const s = newGame();
  handleKey(s, '1');
  assert.equal(s.phase, 'serve');
  update(s, C.SERVE_DELAY + 0.001, {});
  assert.equal(s.phase, 'play');
  assert.ok(Math.abs(s.vel.x) > 0, 'ball must move horizontally');
});

test('top and bottom walls reflect and clamp (no sticking)', () => {
  const s = newGame();
  handleKey(s, '1');
  update(s, C.SERVE_DELAY + 0.001, {});
  s.ball.x = 0.5;
  s.ball.y = 0.02;
  s.vel = { x: 0.0001, y: -1.2 };
  for (let i = 0; i < 60; i++) update(s, 1 / 30, {});
  assert.ok(s.vel.y > 0 || s.ball.y > 0.02, 'must bounce off the top wall');
  assert.ok(s.ball.y >= s.ball.r - 1e-9);
  assert.ok(s.ball.y <= 1 - s.ball.r + 1e-9);
});

test('paddle hit reflects vx and keeps speed magnitude at least SPEED0', () => {
  const s = newGame();
  handleKey(s, '1');
  update(s, C.SERVE_DELAY + 0.001, {});
  const p = s.paddles[0];
  s.ball.x = p.x + p.w + s.ball.r + 0.001;
  s.ball.y = p.y + p.h / 2;
  s.vel = { x: -0.6, y: 0 };
  s.speed = 0.6;
  const before = speed(s);
  for (let i = 0; i < 20 && s.vel.x > 0 === false; i++) update(s, 1 / 60, {});
  assert.ok(s.vel.x > 0, 'vx must flip to the right');
  assert.ok(speed(s) > 0, 'speed must never become 0');
  assert.ok(speed(s) >= before - 1e-6, 'speed must not decrease on hit');
});

test('hit on edge gives steeper angle than hit on center', () => {
  const mk = (offset) => {
    const s = newGame();
    handleKey(s, '1');
    update(s, C.SERVE_DELAY + 0.001, {});
    const p = s.paddles[0];
    s.ball.x = p.x + p.w + s.ball.r + 0.001;
    s.ball.y = p.y + p.h / 2 + offset * (p.h / 2);
    s.vel = { x: -0.7, y: 0 };
    s.speed = 0.7;
    for (let i = 0; i < 10; i++) { update(s, 1 / 120, {}); if (s.vel.x > 0) break; }
    return Math.abs(s.vel.y);
  };
  assert.ok(mk(1) > mk(0), 'edge hit must be steeper than center hit');
});

test('ball speed increases on each paddle hit and is capped', () => {
  const s = newGame();
  handleKey(s, '1');
  update(s, C.SERVE_DELAY + 0.001, {});
  assert.equal(s.speed, C.SPEED0);
  for (let n = 0; n < 40; n++) {
    const p = s.paddles[n % 2];
    s.ball.x = p.x + (n % 2 === 0 ? p.w + s.ball.r + 0.001 : -s.ball.r - 0.001);
    s.ball.y = p.y + p.h / 2;
    s.vel = { x: n % 2 === 0 ? -0.5 : 0.5, y: 0 };
    for (let i = 0; i < 6; i++) update(s, 1 / 120, {});
  }
  assert.ok(s.speed <= C.SPEED_MAX + 1e-9, `speed exceeded cap: ${s.speed}`);
  assert.ok(s.speed > C.SPEED0);
});

test('high-speed ball cannot tunnel through a paddle', () => {
  const s = newGame();
  handleKey(s, '1');
  update(s, C.SERVE_DELAY + 0.001, {});
  const p = s.paddles[0];
  let reflected = false;
  s.ball.x = 0.5;
  s.ball.y = p.y + p.h / 2;
  s.speed = C.SPEED_MAX;
  s.vel = { x: -C.SPEED_MAX, y: 0 };
  for (let i = 0; i < 120; i++) {
    update(s, 1 / 30, {});
    assert.equal(s.score[1], 0, 'ball must not pass the left paddle');
    if (s.vel.x > 0) { reflected = true; break; }
  }
  assert.ok(reflected, 'ball must be reflected by the paddle');
});

test('scoring increments, serves toward the loser, resets speed', () => {
  const s = newGame();
  handleKey(s, '1');
  update(s, C.SERVE_DELAY + 0.001, {});
  s.ball.x = 1.02;
  s.ball.y = 0.5;
  s.vel = { x: C.SPEED_MAX, y: 0 };
  update(s, 1 / 30, {});
  assert.deepEqual(s.score, [1, 0]);
  assert.equal(s.phase, 'serve');
  assert.equal(s.speed, C.SPEED0);
  update(s, C.SERVE_DELAY + 0.001, {});
  assert.ok(s.vel.x > 0, 'serve must head toward the side that lost (right)');
});

/** 让 who 连拿 n 分（直接把球送出对侧边界） */
function awardPoints(s, who, n) {
  for (let i = 0; i < n; i++) {
    if (s.phase === 'serve') update(s, C.SERVE_DELAY + 0.001, {});
    if (who === 0) { s.ball.x = 1.02; s.vel = { x: C.SPEED_MAX, y: 0 }; }
    else { s.ball.x = -0.02; s.vel = { x: -C.SPEED_MAX, y: 0 }; }
    update(s, 1 / 30, {});
  }
}

test('winsNeeded() follows BEST_OF and the default is a single game', () => {
  assert.equal(C.BEST_OF, 1, 'default format: single game');
  assert.equal(winsNeeded(), 1);
  assert.equal(winsNeeded(), Math.ceil(C.BEST_OF / 2));
});

test('with BEST_OF = 1 the first game to 11 ends the whole match', () => {
  const s = newGame();
  handleKey(s, '1');
  awardPoints(s, 0, C.WIN_SCORE);
  assert.equal(s.score[0], C.WIN_SCORE);
  assert.deepEqual(s.games, [1, 0]);
  assert.equal(s.phase, 'gameover', 'no intermission in single-game play');
  assert.equal(s.winner, 0);
  assert.equal(isOver(s), true);
  assert.ok(statusLine(s).includes('Play Again'), 'single game says Play Again');
  // 空格 = 再来一局
  assert.equal(handleKey(s, ' '), true);
  assert.equal(s.phase, 'serve');
  assert.deepEqual(s.score, [0, 0]);
  assert.deepEqual(s.games, [0, 0]);
  assert.equal(s.winner, null);
});

/** 临时切到多局制（默认是单局），测完恢复 */
function withBestOf(n, fn) {
  const prev = C.BEST_OF;
  C.BEST_OF = n;
  try { return fn(); } finally { C.BEST_OF = prev; }
}

test('sideName follows the mode', () => {
  const s = newGame();
  assert.equal(sideName(s, 0), 'PLAYER');
  assert.equal(sideName(s, 1), 'AI');
  s.mode = 'two';
  assert.equal(sideName(s, 0), 'PLAYER 1');
  assert.equal(sideName(s, 1), 'PLAYER 2');
});

test('a series (BEST_OF = 3) interposes an intermission and needs 2 games', () => withBestOf(3, () => {
  assert.equal(winsNeeded(), 2);
  const s = newGame();
  handleKey(s, '1');
  awardPoints(s, 0, C.WIN_SCORE);
  assert.deepEqual(s.games, [1, 0]);
  assert.equal(s.phase, 'intermission');
  assert.equal(s.gameWinner, 0);
  assert.equal(s.winner, null, 'best of 3 cannot be decided after one game');
  assert.equal(isOver(s), false);

  // 局间：Space 开下一局，比分清零、局分保留
  assert.equal(handleKey(s, ' '), true);
  assert.equal(s.phase, 'serve');
  assert.deepEqual(s.score, [0, 0]);
  assert.deepEqual(s.games, [1, 0]);
  assert.equal(s.gameWinner, null);
  update(s, C.SERVE_DELAY + 0.001, {});
  assert.ok(s.vel.x > 0, 'new game is served toward the loser (the right side, which lost game 1)');

  // 右方连拿两局 → 比赛结束
  awardPoints(s, 1, C.WIN_SCORE);
  handleKey(s, ' ');
  awardPoints(s, 1, C.WIN_SCORE);
  assert.deepEqual(s.games, [1, 2]);
  assert.equal(s.phase, 'gameover');
  assert.equal(s.winner, 1);
  assert.ok(statusLine(s).includes('New Match'));
  assert.equal(handleKey(s, ' '), true);
  assert.deepEqual(s.games, [0, 0]);
}));

test('nextGame() keeps the series score', () => withBestOf(3, () => {
  const s = newGame();
  handleKey(s, '1');
  awardPoints(s, 0, C.WIN_SCORE);
  nextGame(s);
  assert.deepEqual(s.games, [1, 0]);
  assert.equal(s.phase, 'serve');
}));

test('update() is inert during intermission and gameover', () => withBestOf(3, () => {
  const s = newGame();
  handleKey(s, '1');
  awardPoints(s, 0, C.WIN_SCORE);
  const snap = JSON.stringify({ score: s.score, games: s.games, ball: s.ball });
  for (let i = 0; i < 20; i++) update(s, 1 / 30, { up1: true, down2: true });
  assert.equal(s.phase, 'intermission');
  assert.equal(JSON.stringify({ score: s.score, games: s.games, ball: s.ball }), snap);
}));

test('statusLine is non-empty ASCII in every phase', () => {
  const s = newGame();
  for (const ph of ['menu', 'serve', 'play', 'gameover']) {
    s.phase = ph;
    const line = statusLine(s);
    assert.ok(line.length > 0);
    assert.ok([...line].every((c) => c.codePointAt(0) <= 0x7e), `non-ascii in statusLine: ${line}`);
  }
});
