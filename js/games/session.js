// ============================================================
//  games/session.js — Game Session 生命周期状态机
//  created → running ⇄ paused → ended → destroyed
//  不碰 DOM：一切 IO 通过注入的 host 接口。这样在无 jsdom 的测试环境可完整验证。
//  destroy() 幂等；模块级 activeSession 守卫防止重复启动。
// ============================================================
import { createInputState, keyDown, keyUp, clearInput, axes, consume, isConsumed } from './input.js';
import { buildFrame, diffRows } from './renderer.js';

let activeSession = null;

export function getActive() { return activeSession; }
export function resetActive() { activeSession = null; }

const SOUND_FOR = { paddle: 'paddle', wall: 'wall', score: 'score', over: 'over' };

export function createSession({
  game,
  host,
  sfx = {},
  store = null,
  onError = null,
  onKeyExtra = null,
  title = 'yuan27.top :: arcade',
} = {}) {
  let state = 'created';
  let rafHandle = null;
  let lastTs = 0;
  let lastStatus = null;
  let muted = false;
  let resolveExited;
  let exitedResolved = false;
  const input = createInputState();
  const offs = [];
  let prevRows = [];
  let cols = 80;
  let rows = 24;
  // 静态框架（边框/分隔线/标题/底栏）由 session 持有；resize 时重建，游戏只画动态对象
  let frameObj = buildFrame({ title, cols, rows });

  const exited = new Promise((r) => { resolveExited = r; });

  if (store) {
    try { muted = !!store.load().pong.muted; } catch { muted = false; }
  }

  function tell(ev) {
    if (muted) return;
    const fn = sfx[SOUND_FOR[ev]];
    if (typeof fn !== 'function') return;
    try { fn(); } catch { /* 音效失败绝不影响游戏 */ }
  }

  function paint(force = false) {
    const out = game.render(frameObj);
    const changed = force ? out.map((_, i) => i) : diffRows(prevRows, out);
    prevRows = out;
    if (changed.length) host.paint(out, changed);
  }

  // 底栏提示随阶段变化（菜单 → 对局 → 结束）
  function syncStatus(force = false) {
    if (typeof game.statusLine !== 'function') return;
    const text = game.statusLine();
    if (!force && text === lastStatus) return;
    lastStatus = text;
    if (typeof host.setStatus === 'function') host.setStatus(text);
  }

  function frame() {
    if (state !== 'running') return;
    rafHandle = host.raf(frame);
    const now = host.now();
    const dt = lastTs ? (now - lastTs) / 1000 : 1 / 30;
    lastTs = now;
    try {
      game.update(dt, axes(input));
      const evs = game.state && Array.isArray(game.state.events) ? game.state.events : [];
      for (const ev of evs) tell(ev);
      if (evs.length) evs.length = 0;
      paint(false);
      syncStatus();
      if (typeof game.isOver === 'function' && game.isOver()) {
        // 结束画面留在屏幕上，等用户按键；不自动退出
      }
    } catch (err) {
      if (typeof onError === 'function') onError(err);
      end('error');
    }
  }

  function startLoop() {
    if (rafHandle !== null) return;
    lastTs = 0;
    rafHandle = host.raf(frame);
  }

  function stopLoop() {
    if (rafHandle !== null) { host.cancelRAF(rafHandle); rafHandle = null; }
  }

  function onKeyDown(e) {
    if (state === 'destroyed' || state === 'ended') return;
    const key = e.key;
    const handled = keyDown(input, key);
    if (!handled) return;
    e.preventDefault();
    if (isConsumed(input, key)) return;
    if (key === 'Escape' || key === 'q' || key === 'Q') {
      consume(input, key);
      e.stopPropagation();
      end('esc');
      return;
    }
    if (key === 'm' || key === 'M') {
      muted = !muted;
      if (store) { try { store.update((d) => { d.pong.muted = muted; return d; }); } catch { /* ignore */ } }
      return;
    }
    if (key === 'Tab') return;      // 焦点陷阱：吞掉，防止焦点逃回 Shell
    if (typeof onKeyExtra === 'function') onKeyExtra(key);
    if (typeof game.handleKey === 'function') game.handleKey(key);
    paint(false);
  }

  function onKeyUp(e) {
    if (keyUp(input, e.key)) e.preventDefault();
  }

  function pause(reason = 'pause') {
    if (state !== 'running') return;
    state = 'paused';
    stopLoop();
    clearInput(input);
  }

  function resume() {
    if (state !== 'paused') return;
    state = 'running';
    startLoop();
  }

  function detach() {
    while (offs.length) {
      const off = offs.pop();
      try { off(); } catch { /* ignore */ }
    }
  }

  function destroy() {
    if (state === 'destroyed') return;
    state = 'destroyed';
    stopLoop();
    detach();
    clearInput(input);
    try { host.teardown(); } catch { /* ignore */ }
    try { host.restoreFocus(); } catch { /* ignore */ }
    if (activeSession === api) activeSession = null;
    if (!exitedResolved) { exitedResolved = true; resolveExited(); }
  }

  function end(reason = 'end') {
    if (state === 'destroyed' || state === 'ended') return;
    state = 'ended';
    stopLoop();
    // 同步 destroy（不做微任务延迟），理由：
    //  1) 事件派发路径在 dispatch 时就已固定，销毁 DOM 与搬焦点不会把本次 ESC 送给主终端；
    //     ESC 的保证由 preventDefault + stopPropagation + consume() 承担（有测试）。
    //  2) 状态与清理在同一时点完成，调用方无需 await 就能断言 destroyed。
    //  3) frame() 在开头就重排了下一帧，stopLoop() 已将它取消，不会残留 RAF。
    destroy();
  }

  const api = {
    get state() { return game.state; },
    getState: () => state,
    exited,
    start() {
      if (state !== 'created') return Promise.resolve();
      if (activeSession && activeSession !== api) {
        throw new Error('arcade: a session is already running');
      }
      activeSession = api;
      state = 'running';
      host.mount({ title, onClose: () => end('window-closed') });
      host.focus();       // 焦点归属由 session 统一驱动（host 只提供操作），测试可断言
      offs.push(host.onResize((dims) => {
        cols = dims.cols;
        rows = dims.rows;
        frameObj = buildFrame({ title, cols: dims.cols, rows: dims.rows });   // 重建静态层
        if (typeof game.resize === 'function') game.resize(dims, frameObj);   // 不得重置游戏状态
        paint(true);
        syncStatus(true);
      }));
      offs.push(host.onVisibility((v) => (v === 'hidden' ? pause('hidden') : resume())));
      offs.push(host.onBlur(() => pause('blur')));
      offs.push(host.onFocus(() => resume()));
      offs.push(host.onKeyDown(onKeyDown));
      offs.push(host.onKeyUp(onKeyUp));
      startLoop();
      paint(true);
      syncStatus(true);
      return Promise.resolve();
    },
    pause,
    resume,
    end,
    destroy,
    toggleMute() { muted = !muted; return muted; },
    isMuted: () => muted,
    getInput: () => input,
  };

  return api;
}
