// tests/games-pong.test.js
import test from 'node:test';
import assert from 'node:assert/strict';
import { C, meta, createState, update, isOver, restart, statusLine, handleKey, nextGame, sideName, WINS_NEEDED } from '../js/games/pong.js';

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

test('WINS_NEEDED is derived from BEST_OF', () => {
  assert.equal(C.BEST_OF, 3);
  assert.equal(WINS_NEEDED, Math.ceil(C.BEST_OF / 2));
  assert.equal(WINS_NEEDED, 2);
});

test('sideName follows the mode', () => {
  const s = newGame();
  assert.equal(sideName(s, 0), 'PLAYER');
  assert.equal(sideName(s, 1), 'AI');
  s.mode = 'two';
  assert.equal(sideName(s, 0), 'PLAYER 1');
  assert.equal(sideName(s, 1), 'PLAYER 2');
});

test('a game ends at WIN_SCORE but the match continues (intermission)', () => {
  const s = newGame();
  handleKey(s, '1');
  awardPoints(s, 0, C.WIN_SCORE);
  assert.equal(s.score[0], C.WIN_SCORE);
  assert.deepEqual(s.games, [1, 0]);
  assert.equal(s.phase, 'intermission');
  assert.equal(s.gameWinner, 0);
  assert.equal(s.winner, null, 'best of 3 cannot be decided after one game');
  assert.equal(isOver(s), false);
});

test('space at intermission starts the next game and keeps the series score', () => {
  const s = newGame();
  handleKey(s, '1');
  awardPoints(s, 0, C.WIN_SCORE);
  assert.equal(handleKey(s, ' '), true);
  assert.equal(s.phase, 'serve');
  assert.deepEqual(s.score, [0, 0]);
  assert.deepEqual(s.games, [1, 0]);
  assert.equal(s.gameWinner, null);
});

test('each game is served toward the loser of the previous game', () => {
  const s = newGame();
  handleKey(s, '1');
  awardPoints(s, 0, C.WIN_SCORE);          // 左侧赢 → 失分方是右侧
  handleKey(s, ' ');
  update(s, C.SERVE_DELAY + 0.001, {});
  assert.ok(s.vel.x > 0, 'serve must head right (toward the loser)');
  awardPoints(s, 1, C.WIN_SCORE);          // 右侧赢回来
  handleKey(s, ' ');
  update(s, C.SERVE_DELAY + 0.001, {});
  assert.ok(s.vel.x < 0, 'serve must head left (toward the loser)');
});

test('the match ends at WINS_NEEDED games; space starts a whole new match', () => {
  const s = newGame();
  handleKey(s, '1');
  awardPoints(s, 1, C.WIN_SCORE);
  handleKey(s, ' ');
  awardPoints(s, 1, C.WIN_SCORE);
  assert.deepEqual(s.games, [0, 2]);
  assert.equal(s.phase, 'gameover');
  assert.equal(s.winner, 1);
  assert.equal(isOver(s), true);
  assert.equal(handleKey(s, ' '), true);
  assert.deepEqual(s.games, [0, 0]);
  assert.deepEqual(s.score, [0, 0]);
  assert.equal(s.phase, 'serve');
  assert.equal(s.winner, null);
});

test('update() is inert during intermission and gameover', () => {
  const s = newGame();
  handleKey(s, '1');
  awardPoints(s, 0, C.WIN_SCORE);
  const snap = JSON.stringify({ score: s.score, games: s.games, ball: s.ball, phase: s.phase });
  for (const ph of ['intermission', 'gameover']) {
    s.phase = ph;
    for (let i = 0; i < 20; i++) update(s, 1 / 30, { up1: true, down2: true });
  }
  assert.equal(JSON.stringify({ score: s.score, games: s.games, ball: s.ball, phase: 'gameover' }), snap.replace('"intermission"', '"gameover"'));
});

test('nextGame() keeps the series and alternates nothing else', () => {
  const s = newGame();
  handleKey(s, '1');
  awardPoints(s, 0, C.WIN_SCORE);
  nextGame(s);
  assert.deepEqual(s.games, [1, 0]);
  assert.equal(s.phase, 'serve');
});

test('restart clears score and returns to serve', () => {
  const s = newGame();
  handleKey(s, '1');
  s.score = [5, 3];
  s.phase = 'gameover';
  s.games = [2, 1];
  restart(s);
  assert.deepEqual(s.score, [0, 0]);
  assert.deepEqual(s.games, [0, 0], 'restart starts a whole new match');
  assert.equal(s.phase, 'serve');
  assert.equal(s.winner, null);
  assert.equal(s.ball.x, 0.5);
});

test('dt is clamped so a huge frame gap cannot teleport the ball', () => {
  const s = newGame();
  handleKey(s, '1');
  update(s, C.SERVE_DELAY + 0.001, {});
  const before = s.ball.x;
  update(s, 5, {});
  assert.ok(Math.abs(s.ball.x - before) <= C.SPEED_MAX * C.DT_MAX + 1e-6);
});

test('serve countdown uses real dt while motion stays clamped', () => {
  const s = newGame();
  handleKey(s, '1');
  assert.equal(s.phase, 'serve');
  // 倒计时是时钟：一次传入 0.901s 就应该发球（若用夹断后的 0.05s 则永远发不出去）
  update(s, C.SERVE_DELAY + 0.001, {});
  assert.equal(s.phase, 'play');
  // 同一帧不得因大 dt 而瞬移：launch() 当次直接返回
  assert.equal(s.ball.x, 0.5);
  // 下一帧的大 dt 被夹断
  const x = s.ball.x;
  update(s, 5, {});
  assert.ok(Math.abs(s.ball.x - x) <= C.SPEED_MAX * C.DT_MAX + 1e-6);
});

test('non-finite dt is ignored instead of corrupting state', () => {
  const s = newGame();
  handleKey(s, '1');
  update(s, C.SERVE_DELAY + 0.001, {});
  const snap = { x: s.ball.x, y: s.ball.y, d: s.serveDelay };
  for (const bad of [NaN, Infinity, -1, undefined]) {
    update(s, bad, {});
    assert.ok(Number.isFinite(s.ball.x) && Number.isFinite(s.ball.y), `dt=${bad} corrupted the ball`);
  }
  assert.deepEqual({ x: s.ball.x, y: s.ball.y, d: s.serveDelay }, snap);
});

test('handleKey only consumes menu/gameover keys', () => {
  const s = newGame();
  assert.equal(handleKey(s, 'x'), false);
  assert.equal(handleKey(s, '1'), true);
  assert.equal(s.mode, 'single');
  s.phase = 'gameover';
  assert.equal(handleKey(s, ' '), true);
  assert.equal(s.phase, 'serve');
});

test('statusLine is non-empty ASCII in every phase', () => {
  const s = newGame();
  for (const ph of ['menu', 'serve', 'play', 'gameover']) {
    s.phase = ph;
    const line = statusLine(s);
    assert.ok(line.length > 0);
    assert.ok([...line].every((c) => c.codePointAt(0) <= 0x7e), `non-ascii in statusLine: ${line}`);
  }
});
