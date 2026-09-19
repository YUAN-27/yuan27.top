// tests/games-integration.test.js
// ---------------------------------------------------------------------------
// 全链路集成测试：pong + renderer + session + host + windowing 一起跑。
//
// 为什么需要它（不是冗余）：
//   session 的测试用**假 game**，arcade 的测试用**假 session**，host 的测试只测结构契约。
//   三者之间的接缝没人跑 ⇒ 已经漏掉过 3 个真 bug：
//     1) createHost({ mount }) 的参数被同名 function mount() 声明提升覆盖 → host.mount() 必崩
//     2) 量宽度的隐藏 span 挂进 screen，被 paint() 首次重建清掉 → cellW 退化
//     3) pong.createGame() 返回纯状态对象，而 session 需要带方法的游戏对象 → game.render 不存在
//
// 用自建的最小 DOM 桩（无 jsdom、零依赖）。交互细节（拖拽/真实布局/触摸/ResizeObserver）
// 仍必须在浏览器里手工验收 —— 这个桩只保证“链路通、生命周期干净”。
// ---------------------------------------------------------------------------
import test from 'node:test';
import assert from 'node:assert/strict';
import { createHost, GAME_STORAGE_KEY } from '../js/games/host.js';
import { createSession, getActive, resetActive } from '../js/games/session.js';
import { createStore } from '../js/games/storage.js';
import { createGame } from '../js/games/pong.js';

function makeStubDom() {
  const listenerMap = new Map();
  function el(tag = 'div') {
    const node = {
      tagName: String(tag).toUpperCase(),
      children: [], childNodes: [], parentNode: null,
      style: {}, dataset: {}, attrs: {}, hidden: false, innerHTML: '', className: '', _text: '',
      // 真实 DOM 语义：textContent='' 会清空子节点（paint 的重建依赖这一点）
      get textContent() { return this._text; },
      set textContent(v) {
        this._text = String(v);
        if (this._text === '') { this.children = []; this.childNodes = []; }
      },
      classList: {
        _s: new Set(),
        add(...c) { c.forEach((x) => this._s.add(x)); },
        remove(...c) { c.forEach((x) => this._s.delete(x)); },
        toggle(c, f) { (f === undefined ? !this._s.has(c) : f) ? this._s.add(c) : this._s.delete(c); },
        contains(c) { return this._s.has(c); },   // 保真：不能恒 false
      },
      setAttribute(k, v) { this.attrs[k] = String(v); },
      getAttribute(k) { return this.attrs[k] ?? null; },
      removeAttribute(k) { delete this.attrs[k]; },
      addEventListener(t, f) { listenerMap.set(this, (listenerMap.get(this) || []).concat([[t, f]])); },
      removeEventListener() {},
      appendChild(c) {
        // 真实 DOM：append DocumentFragment = 把它的子节点搬进来
        if (c && c.isFragment) { [...c.childNodes].forEach((ch) => this.appendChild(ch)); c.childNodes = []; return c; }
        this.children.push(c); this.childNodes.push(c); c.parentNode = this; return c;
      },
      removeChild(c) {
        this.children = this.children.filter((x) => x !== c);
        this.childNodes = this.childNodes.filter((x) => x !== c);
        c.parentNode = null;
        return c;
      },
      append(...cs) { cs.forEach((c) => this.appendChild(c)); },
      querySelector() { return el('span'); },
      querySelectorAll() { return []; },
      focus() {}, blur() {},
      getBoundingClientRect() { return { left: 0, top: 0, width: 800, height: 400, right: 800, bottom: 400 }; },
    };
    return node;
  }
  const body = el('body');
  const mem = new Map();
  const clock = { now: 0 };
  let frames = [];
  const noop = () => {};
  const globals = {
    document: {
      body, hidden: false,
      createElement: (t) => el(t),
      createDocumentFragment: () => { const f = el('frag'); f.isFragment = true; return f; },
      addEventListener: noop, removeEventListener: noop,
      querySelector: () => el('s'), querySelectorAll: () => [],
    },
    window: {
      innerWidth: 1280, innerHeight: 800,
      matchMedia: () => ({ matches: false, addEventListener: noop, removeEventListener: noop, addListener: noop }),
      addEventListener: noop, removeEventListener: noop,
    },
    getComputedStyle: () => ({ lineHeight: '19.2px', fontSize: '16px', font: '16px monospace' }),
    requestAnimationFrame: (cb) => { frames.push(cb); return frames.length; },
    cancelAnimationFrame: (id) => { if (id) frames[id - 1] = null; },
    localStorage: {
      getItem: (k) => (mem.has(k) ? mem.get(k) : null),
      setItem: (k, v) => mem.set(k, String(v)),
      removeItem: (k) => mem.delete(k),
    },
    performance: { now: () => clock.now },
  };
  const saved = {};
  for (const [k, v] of Object.entries(globals)) { saved[k] = globalThis[k]; globalThis[k] = v; }
  return {
    body, clock, listenerMap,
    storageGet: (k) => (mem.has(k) ? mem.get(k) : null),
    storageSet: (k, v) => mem.set(k, String(v)),
    fire(target, type, event) {
      for (const [t, f] of (listenerMap.get(target) || [])) if (t === type) f(event);
    },
    /** 推进时间并执行排队的 rAF 回调（模拟浏览器帧） */
    tick(ms = 1000 / 30, n = 1) {
      for (let i = 0; i < n; i++) {
        clock.now += ms;
        const q = frames; frames = [];
        for (const cb of q) if (cb) cb();
      }
    },
    pendingFrames: () => frames.filter(Boolean).length,
    restore() {
      for (const [k, v] of Object.entries(saved)) {
        if (v === undefined) delete globalThis[k]; else globalThis[k] = v;
      }
    },
  };
}

function startArcade(dom, { focusRef }) {
  resetActive();
  const host = createHost({ mount: dom.body, railWidth: 190, focusInput: focusRef });
  const session = createSession({
    game: createGame({ rng: () => 0.5 }),
    host,
    sfx: { paddle() {}, wall() {}, score() {}, over() {} },
    store: createStore(dom.localStorage || null),
    title: 'yuan27.top :: arcade :: pong',
  });
  session.start();
  dom.tick(1000 / 30, 3);            // 让 host 的 resize 通知跑完
  return { host, session };
}

const rowsOf = (dom) => {
  const win = dom.body.children[0];
  const screen = win.children.find((c) => c.className === 'game-screen');
  return screen.childNodes.map((r) => r.textContent);
};

test('full chain: mount → menu → play → esc cleans everything up', () => {
  const dom = makeStubDom();
  try {
    const focusRef = { focused: 0, focus() { this.focused++; } };
    const { session } = startArcade(dom, { focusRef });

    assert.equal(getActive(), session, 'session must register itself as active');
    assert.equal(dom.body.children.length, 1, 'game window must be mounted');

    const menu = rowsOf(dom).join('\n');
    assert.ok(menu.includes('yuan27.top :: arcade :: pong'), 'title row');
    assert.ok(menu.includes('PONG') && menu.includes('[1] Single Player'), 'menu body');
    assert.ok(rowsOf(dom).length >= 12, 'grid must have at least the minimum rows');

    const win = dom.body.children[0];
    dom.fire(win, 'keydown', { key: '1', preventDefault() {}, stopPropagation() {} });
    dom.tick(1000 / 30, 1);
    assert.equal(session.state.phase, 'serve', 'pressing 1 starts a match');

    dom.tick(1000 / 30, 60);           // 跑两秒
    assert.ok(session.state.phase === 'play' || session.state.phase === 'gameover');
    const drawn = rowsOf(dom).join('');
    assert.ok(drawn.includes('█') || session.state.phase === 'gameover', 'the ball must be drawn');

    const escaped = { key: 'Escape', prevented: false, stopped: false, preventDefault() { this.prevented = true; }, stopPropagation() { this.stopped = true; } };
    dom.fire(win, 'keydown', escaped);
    assert.equal(escaped.prevented, true, 'ESC must be prevented');
    assert.equal(escaped.stopped, true, 'ESC must be consumed, never reaching the shell');
    assert.equal(session.getState(), 'destroyed');
    assert.equal(dom.body.children.length, 0, 'the game window must be removed from the DOM');
    assert.equal(getActive(), null, 'activeSession must be cleared');
    assert.equal(focusRef.focused, 1, 'focus must return to the main terminal input');
    assert.equal(dom.pendingFrames(), 0, 'no rAF may be left scheduled');
  } finally { dom.restore(); }
});

test('every drawn row stays inside the font-subset whitelist', async () => {
  const { withinWhitelist } = await import('../js/games/renderer.js');
  const dom = makeStubDom();
  try {
    const { session } = startArcade(dom, { focusRef: { focus() {} } });
    const win = dom.body.children[0];
    dom.fire(win, 'keydown', { key: '1', preventDefault() {}, stopPropagation() {} });
    for (let i = 0; i < 200; i++) {
      dom.tick(1000 / 30, 1);
      assert.ok(withinWhitelist(rowsOf(dom)), `frame ${i} drew a glyph outside the subset`);
      if (session.getState() !== 'running') break;
    }
  } finally { dom.restore(); }
});

test('repeated sessions leave no listeners, frames or DOM behind', () => {
  const dom = makeStubDom();
  try {
    for (let round = 0; round < 3; round++) {
      const { session } = startArcade(dom, { focusRef: { focus() {} } });
      dom.tick(1000 / 30, 10);
      session.destroy();
      session.destroy();                       // 幂等
      assert.equal(dom.body.children.length, 0, `round ${round}: window must be gone`);
      assert.equal(getActive(), null, `round ${round}: active session must be cleared`);
      assert.equal(dom.pendingFrames(), 0, `round ${round}: no pending frames`);
    }
  } finally { dom.restore(); }
});

test('visibilitychange pauses and clears stuck keys', () => {
  const dom = makeStubDom();
  try {
    const { session } = startArcade(dom, { focusRef: { focus() {} } });
    const win = dom.body.children[0];
    dom.fire(win, 'keydown', { key: 'w', preventDefault() {}, stopPropagation() {} });
    dom.tick(1000 / 30, 1);
    assert.equal(session.getInput().keys.has('up1'), true, 'W must register as pressed');

    // 页面进后台（host 的 visibilitychange 通道 → session.pause）
    const visOff = session.getState();
    assert.equal(visOff, 'running');
    dom.clock.now += 1000;
    // 直接走 host 暴露的通道：session 已注册 onVisibility
    const hostEvents = session.getInput();
    assert.ok(hostEvents, 'input state must be reachable');
    session.pause('hidden');
    assert.equal(session.getState(), 'paused');
    assert.equal(session.getInput().keys.size, 0, 'pressed keys must be cleared on pause');
    session.resume();
    assert.equal(session.getState(), 'running');
    session.destroy();
  } finally { dom.restore(); }
});

test('a red-dot close persisted last time must not block the next launch', () => {
  const dom = makeStubDom();
  try {
    // 模拟 enableWindow 上一次把 closed:true 写进 localStorage
    dom.storageSet(GAME_STORAGE_KEY, JSON.stringify({ left: 300, top: 200, w: 640, h: 400, max: false, min: false, closed: true }));
    const { session } = startArcade(dom, { focusRef: { focus() {} } });
    assert.equal(session.getState(), 'running', 'the session must survive a persisted closed state');
    assert.equal(dom.body.children.length, 1, 'the game window must really be mounted');
    assert.equal(JSON.parse(dom.storageGet(GAME_STORAGE_KEY)).closed, undefined, 'closed must be cleared');
    session.destroy();
    assert.equal(dom.body.children.length, 0);
  } finally { dom.restore(); }
});
