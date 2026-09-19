// tests/games-session.test.js
import test from 'node:test';
import assert from 'node:assert/strict';
import { createSession, getActive, resetActive } from '../js/games/session.js';

// 最小假 host：记录所有副作用，供断言清理是否彻底
function fakeHost() {
  const log = { raf: 0, cancels: 0, paints: 0, teardown: 0, focus: 0, restore: 0, resizes: 0, status: [] };
  const cbs = { resize: new Set(), visibility: new Set(), blur: new Set(), focus: new Set(), keydown: new Set(), keyup: new Set() };
  let queue = [];
  return {
    log, cbs,
    fire(kind, arg) { for (const cb of [...cbs[kind]]) cb(arg); },
    frame() { const q = queue; queue = []; for (const x of q) x.cb(); },
    pendingFrames: () => queue.length,
    mount() { return { root: {}, screen: {}, touch: {} }; },
    paint() { log.paints++; },
    onResize(cb) { cbs.resize.add(cb); return () => cbs.resize.delete(cb); },
    onVisibility(cb) { cbs.visibility.add(cb); return () => cbs.visibility.delete(cb); },
    onBlur(cb) { cbs.blur.add(cb); return () => cbs.blur.delete(cb); },
    onFocus(cb) { cbs.focus.add(cb); return () => cbs.focus.delete(cb); },
    onKeyDown(cb) { cbs.keydown.add(cb); return () => cbs.keydown.delete(cb); },
    onKeyUp(cb) { cbs.keyup.add(cb); return () => cbs.keyup.delete(cb); },
    setStatus(t) { log.status.push(t); },
    now: () => 1000,
    raf(cb) { log.raf++; queue.push({ h: log.raf, cb }); return log.raf; },
    cancelRAF(h) { log.cancels++; const i = queue.findIndex((x) => x.h === h); if (i >= 0) queue.splice(i, 1); },
    focus() { log.focus++; },
    restoreFocus() { log.restore++; },
    setTouchVisible() {},
    teardown() { log.teardown++; },
  };
}

// 假游戏：可控地产生 update/render
function fakeGame() {
  let ticks = 0;
  return {
    state: { ticks: 0, phase: 'play' },
    update(_dt, ax) { ticks++; this.state.ticks = ticks; this.state.lastAx = ax; },
    handleKey(key) { return key === ' '; },
    render(frame) { this.state.lastFrame = frame; return ['row']; },
    statusLine: () => 'status',
    isOver: () => false,
    restart() {},
  };
}

const noSfx = { paddle() {}, wall() {}, score() {}, over() {} };
const store = { load: () => ({ version: 1, pong: {} }), save: () => true, update: (f) => f({ version: 1, pong: { gamesPlayed: 0, playerWins: 0, aiWins: 0, bestScore: { left: 0, right: 0 }, muted: false } }) };

function setup(extra = {}) {
  // 需要跨 session 观察「重复启动守卫」时传 fresh: false，否则它会清掉上一个会话的注册
  if (extra.fresh !== false) resetActive();
  const host = fakeHost();
  const game = extra.game || fakeGame();
  const session = createSession({ game, host, sfx: noSfx, store, ...extra.opts });
  return { host, game, session };
}

// 键盘事件桩：必须同时具备 preventDefault 与 stopPropagation（ESC 消费契约需要）
const keyEvent = (key) => ({
  key,
  prevented: false,
  stopped: false,
  preventDefault() { this.prevented = true; },
  stopPropagation() { this.stopped = true; },
});

test('before start the session is created and inactive', () => {
  const { session } = setup();
  assert.equal(session.getState(), 'created');
  assert.equal(getActive(), null);
});

test('start mounts, focuses, starts a frame loop and registers itself as active', () => {
  const { session, host } = setup();
  session.start();
  assert.equal(session.getState(), 'running');
  assert.equal(getActive(), session);
  assert.equal(host.log.focus, 1);
  assert.ok(host.log.raf >= 1);
});

test('starting twice is refused and does not double-mount', () => {
  const { session, host } = setup();
  session.start();
  const rafs = host.log.raf;
  session.start();
  assert.equal(session.getState(), 'running');
  assert.equal(host.log.raf, rafs, 'no second loop');
  assert.equal(host.log.teardown, 0, 'no teardown from the second start');
});

test('a second session cannot start while one is active', () => {
  const a = setup();
  a.session.start();
  const b = setup({ fresh: false });      // fresh:false —— 不能清掉 a 的注册，否则测不到守卫
  assert.throws(() => b.session.start(), /already running/);
  assert.equal(b.host.log.raf, 0, 'a refused session must not start a loop');
  assert.equal(b.host.log.teardown, 0);
  a.session.destroy();
});

test('axis input reaches the game update', () => {
  const { session, host, game } = setup();
  session.start();
  host.fire('keydown', keyEvent('w'));
  host.frame();
  assert.deepEqual(game.state.lastAx, { up1: true, down1: false, up2: false, down2: false });
});

test('pause stops the loop, clears pressed keys and resumes cleanly', () => {
  const { session, host, game } = setup();
  session.start();
  host.fire('keydown', keyEvent('w'));
  host.fire('visibility', 'hidden');
  assert.equal(session.getState(), 'paused');
  assert.ok(host.log.cancels >= 1);
  host.fire('visibility', 'visible');
  assert.equal(session.getState(), 'running');
  host.frame();
  assert.deepEqual(game.state.lastAx, { up1: false, down1: false, up2: false, down2: false },
    'pressed keys must be cleared across a pause');
});

test('blur pauses and clears keys (no sticky W)', () => {
  const { session, host, game } = setup();
  session.start();
  host.fire('keydown', keyEvent('w'));
  host.fire('blur');
  assert.equal(session.getState(), 'paused');
  host.fire('focus');
  host.frame();
  assert.deepEqual(game.state.lastAx, { up1: false, down1: false, up2: false, down2: false });
});

test('escape ends the session, consumes the key and restores focus once', async () => {
  const { session, host } = setup();
  session.start();
  const ev = keyEvent('Escape');
  host.fire('keydown', ev);
  assert.equal(ev.prevented, true, 'escape must be prevented');
  assert.equal(ev.stopped, true, 'escape must not reach the shell');
  assert.equal(session.getState(), 'destroyed');
  assert.equal(host.log.teardown, 1);
  assert.equal(host.log.restore, 1);
  assert.equal(getActive(), null);
  await session.exited;
});

test('destroy is idempotent: repeated calls do not repeat side effects', () => {
  const { session, host } = setup();
  session.start();
  session.destroy();
  session.destroy();
  session.destroy();
  assert.equal(session.getState(), 'destroyed');
  assert.equal(host.log.teardown, 1);
  assert.equal(host.log.restore, 1);
});

test('exited resolves exactly once and late destroys are silent', async () => {
  const { session } = setup();
  session.start();
  let count = 0;
  session.exited.then(() => { count++; });
  session.destroy();
  session.destroy();
  await new Promise((r) => setTimeout(r, 5));
  assert.equal(count, 1);
});

test('resize forwards to the game and never resets state', () => {
  const { session, host, game } = setup();
  session.start();
  host.frame();
  const ticks = game.state.ticks;
  host.fire('resize', { cols: 100, rows: 30 });
  assert.equal(game.state.ticks, ticks, 'resize must not tick the game');
  assert.ok(host.log.paints >= 1);
});

test('render receives the frame built by the session', () => {
  const { session, host, game } = setup();
  session.start();
  host.frame();
  const f = game.state.lastFrame;
  assert.ok(f && f.grid && f.layout, 'game.render must receive a frame object');
  assert.equal(f.grid.length, f.layout.rows);
  assert.ok(f.layout.cols >= 40 && f.layout.rows >= 12);
});

test('resize rebuilds the frame at the new size and hands it to the game', () => {
  const { session, host, game } = setup();
  session.start();
  host.fire('resize', { cols: 100, rows: 30 });
  assert.equal(game.state.lastFrame.layout.cols, 100);
  assert.equal(game.state.lastFrame.layout.rows, 30);
});

test('status line changes are pushed to the host footer', () => {
  const { session, host, game } = setup();
  let text = 'menu status';
  game.statusLine = () => text;
  session.start();
  assert.ok(host.log.status.includes('menu status'));
  text = 'play status';
  host.frame();
  assert.ok(host.log.status.includes('play status'), 'footer must follow the phase');
});

test('a throwing update cancels its frame and tears down exactly once', () => {
  const game = fakeGame();
  game.update = () => { throw new Error('boom'); };
  const { session, host } = setup({ game, opts: { onError: () => {} } });
  session.start();
  host.frame();
  assert.equal(session.getState(), 'destroyed');
  assert.equal(host.pendingFrames(), 0, 'no RAF may be left scheduled');
  assert.equal(host.log.teardown, 1);
});

test('end() then destroy() removes all host callbacks', () => {
  const { session, host } = setup();
  session.start();
  session.end('test');
  session.destroy();
  assert.equal(host.cbs.resize.size, 0);
  assert.equal(host.cbs.visibility.size, 0);
  assert.equal(host.cbs.blur.size, 0);
});

test('a throwing game update ends the session instead of hanging', async () => {
  const game = fakeGame();
  game.update = () => { throw new Error('boom'); };
  const errors = [];
  const { session, host } = setup({ game, opts: { onError: (e) => errors.push(e) } });
  session.start();
  host.frame();
  assert.equal(session.getState(), 'destroyed');
  assert.equal(errors.length, 1);
  assert.equal(host.log.teardown, 1);
  await session.exited;
});
