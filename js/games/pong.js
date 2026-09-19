// ============================================================
//  games/pong.js — Pong 模型（纯逻辑，不碰 DOM）
//  坐标全部归一化到 [0,1]，因此改窗口尺寸不影响游戏状态。
//  物理使用子步长积分：单帧位移可能远大于挡板厚度，不分子步会穿透。
// ============================================================

export const meta = { id: 'pong', title: 'PONG', summary: 'Classic Pong' };

export const C = {
  SPEED0: 0.62,
  SPEED_MAX: 1.55,
  SPEEDUP: 1.04,
  PADDLE_H: 0.18,
  PADDLE_W: 0.012,
  PADDLE_X: [0.030, 0.958],
  PADDLE_SPEED: 1.5,
  BALL_R: 0.014,
  MAX_ANGLE: 0.84,      // 出射角上限 ≈48°
  PADDLE_SPIN: 0.12,    // 挡板移动对出射角的轻微影响
  WIN_SCORE: 11,
  SERVE_DELAY: 0.9,
  AI_SPEED: { easy: 0.72, normal: 1.05 },
  AI_DEAD: 0.012,
  SUBSTEP_MAX: 0.004,
  DT_MAX: 0.05,
};

const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);

function makePaddle(i) {
  return { x: C.PADDLE_X[i], w: C.PADDLE_W, y: 0.5 - C.PADDLE_H / 2, h: C.PADDLE_H, vy: 0 };
}

export function createState({ rng = Math.random, difficulty = 'normal' } = {}) {
  return {
    phase: 'menu',          // menu | serve | play | gameover
    mode: 'single',         // single | two
    difficulty: difficulty === 'easy' ? 'easy' : 'normal',
    ball: { x: 0.5, y: 0.5, r: C.BALL_R },
    vel: { x: 0, y: 0 },
    speed: C.SPEED0,
    paddles: [makePaddle(0), makePaddle(1)],
    score: [0, 0],
    serveDelay: 0,
    serveDir: 1,
    winner: null,
    events: [],             // 'paddle' | 'wall' | 'score' | 'over'（每帧清空，供音效）
    rng,
  };
}

export function isOver(state) { return state.phase === 'gameover'; }

export function startMatch(state, mode = 'single') {
  state.mode = mode === 'two' ? 'two' : 'single';
  state.score = [0, 0];
  state.winner = null;
  state.speed = C.SPEED0;
  state.paddles = [makePaddle(0), makePaddle(1)];
  toServe(state, 1);
}

export function restart(state) { startMatch(state, state.mode); }

function toServe(state, dir) {
  state.phase = 'serve';
  state.serveDelay = C.SERVE_DELAY;
  state.serveDir = dir;
  state.ball.x = 0.5;
  state.ball.y = 0.5;
  state.vel = { x: 0, y: 0 };
  state.speed = C.SPEED0;
}

// 发球：±0.3 rad 内随机，避免开局就贴墙
function launch(state) {
  const ang = (state.rng() * 0.6 - 0.3);
  state.phase = 'play';
  state.vel = {
    x: Math.cos(ang) * state.speed * state.serveDir,
    y: Math.sin(ang) * state.speed,
  };
}

function movePaddle(state, i, dir, dt) {
  const p = state.paddles[i];
  p.vy = dir * C.PADDLE_SPEED;
  if (!dir) return;
  p.y = clamp(p.y + p.vy * dt, 0, 1 - p.h);
}

// 刻意简单：跟随快照、限速、带死区；球远离时不追，不做预测
function moveAI(state, i, dt) {
  const p = state.paddles[i];
  if (state.vel.x <= 0) { p.vy = 0; return; }
  const target = state.ball.y - p.h / 2;
  const diff = target - p.y;
  if (Math.abs(diff) < C.AI_DEAD) { p.vy = 0; return; }
  const v = Math.sign(diff) * (C.AI_SPEED[state.difficulty] ?? C.AI_SPEED.normal);
  p.vy = v;
  p.y = clamp(p.y + v * dt, 0, 1 - p.h);
}

function bounceOffPaddle(state, i, sign, p) {
  const b = state.ball;
  b.x = sign < 0 ? p.x + p.w + b.r : p.x - b.r;     // 位置修正，杜绝卡在挡板里
  const t = clamp((b.y - (p.y + p.h / 2)) / (p.h / 2), -1, 1);
  state.speed = Math.min(state.speed * C.SPEEDUP, C.SPEED_MAX);
  const ang = t * C.MAX_ANGLE;
  const spin = C.PADDLE_SPIN * (p.vy / C.PADDLE_SPEED);
  let vy = Math.sin(ang) * state.speed + spin * state.speed;
  vy = clamp(vy, -0.9 * state.speed, 0.9 * state.speed);
  const vx = Math.sqrt(Math.max(state.speed * state.speed - vy * vy, 1e-9));
  state.vel = { x: sign < 0 ? vx : -vx, y: vy };
  state.events.push('paddle');
}

function awardPoint(state, who) {
  state.score[who] += 1;
  state.events.push('score');
  if (state.score[who] >= C.WIN_SCORE) {
    state.winner = who;
    state.phase = 'gameover';
    state.vel = { x: 0, y: 0 };
    state.events.push('over');
    return;
  }
  toServe(state, who === 0 ? 1 : -1);   // 球朝失分方
}

function substep(state, h) {
  const b = state.ball;
  b.x += state.vel.x * h;
  b.y += state.vel.y * h;

  if (b.y - b.r < 0) { b.y = b.r; state.vel.y = Math.abs(state.vel.y); state.events.push('wall'); }
  if (b.y + b.r > 1) { b.y = 1 - b.r; state.vel.y = -Math.abs(state.vel.y); state.events.push('wall'); }

  for (const i of [0, 1]) {
    const p = state.paddles[i];
    const sign = i === 0 ? -1 : 1;
    if (sign < 0 && state.vel.x >= 0) continue;
    if (sign > 0 && state.vel.x <= 0) continue;
    if (b.x + b.r < p.x || b.x - b.r > p.x + p.w) continue;
    if (b.y + b.r < p.y || b.y - b.r > p.y + p.h) continue;
    bounceOffPaddle(state, i, sign, p);
  }

  if (b.x + b.r < 0) awardPoint(state, 1);
  else if (b.x - b.r > 1) awardPoint(state, 0);
}

export function update(state, dt, axes = {}) {
  state.events = [];
  if (state.phase === 'menu' || state.phase === 'gameover') return state;

  // 两个不同的 dt，职责不同（不要合并）：
  //   raw  = 真实时间，用于「时钟」（发球倒计时）；
  //   step = 夹断后的时间，用于「物理」（挡板/球），防止卡顿后瞬移与穿透。
  const raw = Number.isFinite(dt) && dt > 0 ? dt : 0;
  const step = Math.min(raw, C.DT_MAX);

  movePaddle(state, 0, (axes.up1 ? -1 : 0) + (axes.down1 ? 1 : 0), step);
  if (state.mode === 'two') movePaddle(state, 1, (axes.up2 ? -1 : 0) + (axes.down2 ? 1 : 0), step);
  else moveAI(state, 1, step);

  if (state.phase === 'serve') {
    state.serveDelay -= raw;
    // launch() 设完速度就 return，因此这一次 update 里球不会带着大 dt 移动
    if (state.serveDelay <= 0) launch(state);
    return state;
  }

  const sp = Math.hypot(state.vel.x, state.vel.y) || state.speed;
  const steps = Math.max(1, Math.ceil((sp * step) / C.SUBSTEP_MAX));
  const h = step / steps;
  for (let i = 0; i < steps; i++) {
    substep(state, h);
    if (state.phase !== 'play') break;
  }
  return state;
}

export function handleKey(state, key) {
  const k = key && key.length === 1 ? key.toLowerCase() : key;
  if (state.phase === 'menu') {
    if (k === '1') { state.mode = 'single'; startMatch(state, 'single'); return true; }
    if (k === '2') { startMatch(state, 'two'); return true; }
    return false;
  }
  if (state.phase === 'gameover') {
    if (k === ' ' || k === 'Enter') { restart(state); return true; }
    return false;
  }
  return false;
}

export function statusLine(state) {
  if (state.phase === 'menu') return '[1] Single Player   [2] Two Players   [Q] Quit';
  if (state.phase === 'gameover') return '[Space] Play Again   [ESC] Quit';
  if (state.mode === 'two') return '[W/S] P1   [Up/Down] P2   [M] Mute   [ESC] Quit';
  return '[W/S] Move   [M] Mute   [ESC] Quit';
}

export function setDifficulty(state, name) {
  if (name !== 'easy' && name !== 'normal') return false;
  state.difficulty = name;
  return true;
}

import { blit, glyphs } from './renderer.js';

const pad = (n) => String(n).padStart(2, '0');

function clampRow(v, top, bottom) {
  const r = Math.round(v);
  return r < top ? top : r > bottom ? bottom : r;
}

// 模型 → 网格：只画动态对象，静态框架由 renderer.buildFrame 提供
export function render(state, frame) {
  const rows = frame.grid.slice();
  const L = frame.layout;

  // 比分
  const left = pad(state.score[0]);
  const right = pad(state.score[1]);
  blit(rows, Math.max(2, L.cx - 8), L.scoreRow, left);
  blit(rows, Math.min(L.cols - 4, L.cx + 6), L.scoreRow, right);

  const fieldRows = L.fieldRows;
  const toRow = (y) => L.fieldTop + clampRow(y * (fieldRows - 1), 0, fieldRows - 1);

  if (state.phase === 'menu') {
    const cx = L.cx;
    const mid = L.fieldTop + Math.floor(fieldRows / 2);
    const put = (dy, text) => blit(rows, cx - Math.floor(text.length / 2), mid + dy, text);
    blit(rows, cx - 2, mid - 4, 'PONG');
    put(-1, '[1] Single Player');
    put(1, '[2] Two Players');
    put(3, '[Q] Quit');
    return rows;
  }

  if (state.phase === 'gameover') {
    const cx = L.cx;
    const mid = L.fieldTop + Math.floor(fieldRows / 2);
    const who = state.winner === 0 ? (state.mode === 'two' ? 'PLAYER 1 WINS' : 'PLAYER WINS') : 'AI WINS';
    const put = (dy, text) => blit(rows, cx - Math.floor(text.length / 2), mid + dy, text);
    put(-2, 'GAME OVER');
    put(0, who);
    put(2, `${pad(state.score[0])} - ${pad(state.score[1])}`);
    put(4, '[Space] Play Again');
    return rows;
  }

  // 挡板
  const padRows = Math.max(2, Math.round(state.paddles[0].h * fieldRows));
  for (const p of state.paddles) {
    const top = L.fieldTop + clampRow(p.y * (fieldRows - 1), 0, fieldRows - padRows);
    for (let i = 0; i < padRows; i++) {
      blit(rows, Math.round(p.x * (L.cols - 1)) + 1, top + i, glyphs.paddle);
    }
  }

  // 球
  if (state.phase === 'play' || state.phase === 'serve') {
    const bx = 1 + Math.round(state.ball.x * (L.innerW - 1));
    blit(rows, bx, toRow(state.ball.y), glyphs.ball);
  }

  return rows;
}

// ============================================================
//  会话侧接口适配（spec §14）：把纯函数 API 包装成 session 需要的对象接口。
//  session 只认 { state, update, handleKey, render, statusLine, isOver, restart, resize }。
//  ⚠️ 这个接缝是集成盲区：session 测试用假 game、arcade 测试用假 session，
//     两者都不会暴露“状态对象 vs 游戏对象”的错配（烟测抓到过一次）。
// ============================================================
export function createGame(opts = {}) {
  const state = createState(opts);
  return {
    state,
    update: (dt, axes) => update(state, dt, axes),
    handleKey: (key) => handleKey(state, key),
    render: (frame) => render(state, frame),
    statusLine: () => statusLine(state),
    isOver: () => isOver(state),
    restart: () => restart(state),
    // 归一化坐标 ⇒ 改尺寸不改模型，resize 是显式的空操作（文档化，而非遗漏）
    resize: () => {},
  };
}
