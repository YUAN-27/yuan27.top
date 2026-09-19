// tests/games-arcade.test.js
import test from 'node:test';
import assert from 'node:assert/strict';
import { GAMES, parseArcadeArgs, runArcade } from '../js/games/arcade.js';
import { createSession, resetActive, getActive } from '../js/games/session.js';

resetActive();

function makeShell({ sessionFactory } = {}) {
  const out = [];
  const opened = [];
  const shell = {
    cwd: '/',
    error: (m) => out.push(['error', m]),
    success: (m) => out.push(['success', m]),
    muted: (m) => out.push(['muted', m]),
    printLines: (l) => out.push(['lines', l]),
    printText: (l) => out.push(['text', l]),
    ui: {
      openGameSession(opts) {
        opened.push(opts);
        if (sessionFactory) return sessionFactory(opts);
        return {
          exited: Promise.resolve(),
          start: () => Promise.resolve(),
          destroy() {},
          isMuted: () => false,
        };
      },
    },
  };
  return { shell, out, opened };
}

const textOf = (out) => out.map((o) => (Array.isArray(o[1]) ? o[1].join('\n') : o[1])).join('\n');

// 真 session 需要的最小假 host（与 Task 7 同契约，此处独立实现，避免跨文件耦合）
function fakeHost() {
  const log = { raf: 0, cancels: 0, teardown: 0 };
  const off = () => () => {};
  return {
    log,
    mount() { return { root: {}, screen: {}, touch: {} }; },
    paint() {}, setStatus() {},
    onResize: off, onVisibility: off, onBlur: off, onFocus: off, onKeyDown: off, onKeyUp: off,
    now: () => 0,
    raf() { log.raf++; return log.raf; },
    cancelRAF() { log.cancels++; },
    focus() {}, restoreFocus() {}, setTouchVisible() {},
    teardown() { log.teardown++; },
  };
}

// 不带 DOM 的最小游戏桩
function pongGame() {
  return {
    state: { phase: 'menu', events: [] },
    update() {},
    handleKey: () => false,
    render: () => ['row'],
    statusLine: () => 'status',
    isOver: () => false,
    restart() {},
  };
}

test('registry exposes pong with meta', () => {
  assert.ok(GAMES.pong);
  assert.equal(GAMES.pong.meta.id, 'pong');
  assert.equal(typeof GAMES.pong.create, 'function');
});

test('parseArcadeArgs covers the documented surface', () => {
  assert.deepEqual(parseArcadeArgs([]), { action: 'list' });
  assert.deepEqual(parseArcadeArgs(['pong']), { action: 'play', id: 'pong' });
  assert.deepEqual(parseArcadeArgs(['--list']), { action: 'list' });
  assert.deepEqual(parseArcadeArgs(['-l']), { action: 'list' });
  assert.deepEqual(parseArcadeArgs(['--help']), { action: 'help' });
  assert.deepEqual(parseArcadeArgs(['-h']), { action: 'help' });
  assert.deepEqual(parseArcadeArgs(['--reset']), { action: 'reset' });
  assert.deepEqual(parseArcadeArgs(['snake']), { action: 'unknown', id: 'snake' });
  assert.deepEqual(parseArcadeArgs(['pong', 'extra']), { action: 'unknown', id: 'pong extra' });
});

test('bare arcade lists available games', async () => {
  const { shell, out } = makeShell();
  await runArcade(shell, []);
  const text = textOf(out);
  assert.ok(text.includes('YUAN27 TERMINAL ARCADE'));
  assert.ok(text.includes('pong'));
  assert.ok(text.includes('arcade pong'));
});

test('arcade --list behaves like bare arcade', async () => {
  const a = makeShell();
  const b = makeShell();
  await runArcade(a.shell, []);
  await runArcade(b.shell, ['--list']);
  assert.deepEqual(a.out, b.out);
});

test('arcade --help prints usage', async () => {
  const { shell, out } = makeShell();
  await runArcade(shell, ['--help']);
  const text = textOf(out);
  assert.ok(text.includes('Usage'));
  assert.ok(text.includes('arcade pong'));
  assert.ok(text.includes('--reset'));
});

test('arcade --reset only resets arcade storage and reports it', async () => {
  const { shell, out } = makeShell();
  await runArcade(shell, ['--reset']);
  assert.ok(textOf(out).toLowerCase().includes('reset'));
});

test('unknown game reports the shell-style error plus the game list', async () => {
  const { shell, out } = makeShell();
  await runArcade(shell, ['snake']);
  assert.ok(textOf(out).includes("arcade: unknown game 'snake'"));
  assert.ok(textOf(out).includes('pong'));
});

test('arcade pong opens a session and awaits it', async () => {
  let started = false;
  let resolved = false;
  const { shell, opened } = makeShell({
    sessionFactory: () => ({
      exited: new Promise((r) => { setTimeout(() => { resolved = true; r(); }, 1); }),
      start() { started = true; return Promise.resolve(); },
      destroy() {},
    }),
  });
  await runArcade(shell, ['pong']);
  assert.equal(started, true);
  assert.equal(opened.length, 1);
  assert.equal(resolved, true, 'runArcade must not resolve before the session exits');
  assert.equal(getActive(), null);
});

test('a session that fails to start reports an error and leaves no active session', async () => {
  const { shell, out } = makeShell({
    sessionFactory: () => ({ exited: Promise.resolve(), start() { throw new Error('no dom'); }, destroy() {} }),
  });
  await runArcade(shell, ['pong']);
  assert.ok(textOf(out).includes('arcade: failed to start'));
  assert.equal(getActive(), null);
});

test('a second arcade while one is active is refused', async () => {
  resetActive();
  // 用真 session 建立真实守卫：假 session 不注册 activeSession，根本测不到守卫
  const live = createSession({ game: pongGame(), host: fakeHost(), sfx: {}, store: null });
  live.start();
  assert.equal(getActive(), live, 'session.start() must register the active session');

  const { shell, out, opened } = makeShell();
  await runArcade(shell, ['pong']);
  assert.ok(textOf(out).includes('already running'), 'must refuse while a session is active');
  assert.equal(opened.length, 0, 'must not open a second session');

  live.destroy();
  assert.equal(getActive(), null);

  // 释放后可以再次启动
  const again = makeShell();
  await runArcade(again.shell, ['pong']);
  assert.equal(again.opened.length, 1, 'after the session is gone a new one may start');
});

test('arcade --help text mentions keyboard and exit keys', async () => {
  const { shell, out } = makeShell();
  await runArcade(shell, ['--help']);
  const text = textOf(out);
  for (const k of ['W', 'S', 'ESC', 'M']) assert.ok(text.includes(k), `help must mention ${k}`);
});
