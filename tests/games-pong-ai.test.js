// tests/games-pong-ai.test.js
import test from 'node:test';
import assert from 'node:assert/strict';
import { C, createState, update, setDifficulty } from '../js/games/pong.js';

const playing = () => {
  const s = createState({ rng: () => 0.5 });
  s.phase = 'play';
  s.mode = 'single';
  s.speed = C.SPEED0;
  s.vel = { x: C.SPEED0, y: 0 };     // 球朝 AI 方向
  return s;
};

test('AI only tracks when the ball approaches it', () => {
  const s = playing();
  s.paddles[1].y = 0;
  s.ball.y = 0.9;
  s.vel = { x: -C.SPEED0, y: 0 };            // 球远离 AI
  update(s, 0.1, {});
  assert.equal(s.paddles[1].y, 0, 'AI must hold still while the ball moves away');
  s.vel = { x: C.SPEED0, y: 0 };             // 球朝 AI 飞来
  update(s, 0.1, {});
  assert.ok(s.paddles[1].y > 0, 'AI must chase when the ball approaches');
});

test('AI respects a dead zone (no jitter)', () => {
  const s = playing();
  s.ball.y = s.paddles[1].y + s.paddles[1].h / 2;   // 正对中心
  const y0 = s.paddles[1].y;
  update(s, 0.1, {});
  assert.equal(s.paddles[1].y, y0);
});

test('AI speed is capped by difficulty', () => {
  const s = playing();
  s.paddles[1].y = 0;
  s.ball.y = 0.99;
  const y0 = s.paddles[1].y;
  update(s, 0.5, {});            // dt 会被 clamp 到 DT_MAX
  const moved = s.paddles[1].y - y0;
  assert.ok(moved <= C.AI_SPEED.normal * C.DT_MAX + 1e-9, `AI moved too far: ${moved}`);
  assert.ok(moved > 0);
});

test('easy is slower than normal', () => {
  const mk = (diff) => {
    const s = playing();
    setDifficulty(s, diff);
    s.paddles[1].y = 0;
    s.ball.y = 0.99;
    update(s, C.DT_MAX, {});
    return s.paddles[1].y;
  };
  assert.ok(mk('easy') < mk('normal'));
});

test('setDifficulty validates input', () => {
  const s = createState();
  assert.equal(setDifficulty(s, 'easy'), true);
  assert.equal(s.difficulty, 'easy');
  assert.equal(setDifficulty(s, 'nope'), false);
  assert.equal(s.difficulty, 'easy');
});

test('AI never leaves the field', () => {
  const s = playing();
  for (let i = 0; i < 400; i++) {
    s.ball.y = i % 2 ? 0.01 : 0.99;
    update(s, C.DT_MAX, {});
    assert.ok(s.paddles[1].y >= 0 && s.paddles[1].y + s.paddles[1].h <= 1 + 1e-9);
  }
});
