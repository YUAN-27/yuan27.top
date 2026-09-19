// tests/games-host.test.js
import test from 'node:test';
import assert from 'node:assert/strict';
import { createHost, sanitizeStoredWindowState, defaultGameGeom, GAME_STORAGE_KEY, GAME_MIN_W, GAME_MIN_H } from '../js/games/host.js';

// ---------------------------------------------------------------------------
// 极简 DOM 桩：只验证 host 的**结构契约**（能不能挂上去、行是否写进 screen）。
// 不模拟浏览器行为；交互（拖拽/焦点/触摸/ResizeObserver）仍靠浏览器手工验收。
// 这两个测试是为了守住两个真实踩过的坑：
//   1) 挂载点参数叫 mount 时，被同名 function mount() 声明提升覆盖 → host.mount() 必崩
//   2) 量宽度的隐藏 span 若挂进 screen，会被 paint() 首次 textContent='' 清掉
// ---------------------------------------------------------------------------
function stubEl(tag = 'div') {
  const el = {
    tagName: String(tag).toUpperCase(),
    children: [], childNodes: [], parentNode: null,
    style: {}, dataset: {}, attrs: {}, hidden: false, innerHTML: '', className: '', _text: '',
    // textContent 必须像真实 DOM：设为 '' 会清空子节点（否则 paint() 的重建语义就不成立）
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
      contains(c) { return this._s.has(c); },   // 保真：不能再恒 false（曾让断言假绿灯）
    },
    setAttribute(k, v) { this.attrs[k] = String(v); },
    getAttribute(k) { return this.attrs[k] ?? null; },
    removeAttribute(k) { delete this.attrs[k]; },
    addEventListener() {}, removeEventListener() {},
    appendChild(c) {
      // 真实 DOM：append 一个 DocumentFragment 是把它的**子节点**搬进来
      if (c && c.isFragment) { [...c.childNodes].forEach((ch) => this.appendChild(ch)); c.childNodes = []; c.children = []; return c; }
      this.children.push(c); this.childNodes.push(c); c.parentNode = this; return c;
    },
    removeChild(c) {
      this.children = this.children.filter((x) => x !== c);
      this.childNodes = this.childNodes.filter((x) => x !== c);
      c.parentNode = null;
      return c;
    },
    append(...cs) { cs.forEach((c) => this.appendChild(c)); },
    querySelector() { return stubEl('span'); },
    querySelectorAll() { return []; },
    focus() {}, blur() {},
    getBoundingClientRect() { return { left: 0, top: 0, width: 800, height: 400, right: 800, bottom: 400 }; },
  };
  return el;
}

// 在桩环境下执行 fn，结束后还原全局（node --test 每个文件独立进程，安全）
function withStubDom(fn, opts = {}) {
  const body = stubEl('body');
  const noop = () => {};
  const mem = new Map();
  const globals = {
    document: {
      body, hidden: false,
      createElement: (t) => stubEl(t),
      createDocumentFragment: () => { const f = stubEl('frag'); f.isFragment = true; return f; },
      addEventListener: noop, removeEventListener: noop,
      querySelector: () => stubEl('s'), querySelectorAll: () => [],
    },
    window: {
      innerWidth: opts.width ?? 1280, innerHeight: opts.height ?? 800,
      matchMedia: () => ({ matches: false, addEventListener: noop, removeEventListener: noop, addListener: noop }),
      addEventListener: noop, removeEventListener: noop,
    },
    getComputedStyle: () => ({ lineHeight: '19.2px', fontSize: '16px', font: '16px monospace' }),
    requestAnimationFrame: () => 1,
    cancelAnimationFrame: noop,
    localStorage: {
      getItem: (k) => (mem.has(k) ? mem.get(k) : null),
      setItem: (k, v) => mem.set(k, String(v)),
      removeItem: (k) => mem.delete(k),
    },
  };
  const saved = {};
  for (const [k, v] of Object.entries(globals)) { saved[k] = globalThis[k]; globalThis[k] = v; }
  try {
    return fn({
      body,
      storage: {
        get: (k) => (mem.has(k) ? mem.get(k) : null),
        set: (k, v) => mem.set(k, String(v)),
      },
    });
  } finally {
    for (const [k, v] of Object.entries(saved)) {
      if (v === undefined) delete globalThis[k]; else globalThis[k] = v;
    }
  }
}

test('createHost without a mount point returns an inert host instead of throwing', () => {
  const host = createHost({});
  assert.equal(typeof host.mount, 'function');
  const h = host.mount({});
  assert.equal(h.root, null);
  assert.doesNotThrow(() => host.paint([], []));
  assert.doesNotThrow(() => host.teardown());
});

test('host exposes the full contract used by session.js', () => {
  const host = createHost({});
  for (const fn of ['mount', 'paint', 'setStatus', 'onResize', 'onVisibility', 'onBlur', 'onFocus', 'onKeyDown', 'onKeyUp', 'now', 'raf', 'cancelRAF', 'focus', 'restoreFocus', 'setTouchVisible', 'teardown']) {
    assert.equal(typeof host[fn], 'function', `missing ${fn}`);
  }
  for (const fn of ['onResize', 'onVisibility', 'onBlur', 'onFocus', 'onKeyDown', 'onKeyUp']) {
    const off = host[fn](() => {});
    assert.equal(typeof off, 'function', `${fn} must return a disposer`);
    off();
  }
});

// ---- 结构契约（回归：这两个 bug 曾让浏览器里 host.mount() 直接崩 / 网格尺寸算错）----

test('mount with a container appends the game window and returns the parts', () => {
  withStubDom(({ body }) => {
    const host = createHost({ mount: body, railWidth: 190 });
    const parts = host.mount({ title: 'yuan27.top :: arcade :: pong', onClose() {} });
    assert.ok(parts.root, 'root must be returned');
    assert.ok(parts.screen, 'screen must be returned');
    assert.ok(parts.touch, 'touch controls must be returned');
    assert.equal(body.children.length, 1, 'the game window must be appended to the container');
    host.teardown();
    assert.equal(body.children.length, 0, 'teardown must remove the window from the container');
  });
});

test('the measuring node never lands inside the screen (it would be wiped by the first paint)', () => {
  withStubDom(({ body }) => {
    const host = createHost({ mount: body, railWidth: 0 });
    const { screen } = host.mount({ title: 'T', onClose() {} });
    host.paint(['ab', 'cd'], [0, 1]);          // 首次重建会清空 screen
    host.paint(['ab', 'cd'], [0, 1]);          // 第二次仍应写出同样的内容
    assert.equal(screen.childNodes.length, 2, 'screen must contain exactly the grid rows');
    assert.equal(screen.childNodes[0].textContent, 'ab');
    assert.equal(screen.childNodes[1].textContent, 'cd');
    host.teardown();
  });
});

test('paint only rewrites the rows reported as changed', () => {
  withStubDom(({ body }) => {
    const host = createHost({ mount: body, railWidth: 0 });
    const { screen } = host.mount({ title: 'T', onClose() {} });
    host.paint(['ab', 'cd'], [0, 1]);
    const first = screen.childNodes[0];
    host.paint(['ab', 'XY'], [1]);
    assert.equal(screen.childNodes[0], first, 'unchanged row must keep the same node');
    assert.equal(screen.childNodes[0].textContent, 'ab');
    assert.equal(screen.childNodes[1].textContent, 'XY');
    host.teardown();
  });
});

test('setStatus writes the footer text', () => {
  withStubDom(({ body }) => {
    const host = createHost({ mount: body, railWidth: 0 });
    const { root } = host.mount({ title: 'T', onClose() {} });
    host.setStatus('[W/S] Move   [ESC] Quit');
    const footer = root.children.find((c) => c.className === 'game-footer');
    assert.ok(footer, 'footer element must exist');
    assert.equal(footer.textContent, '[W/S] Move   [ESC] Quit');
    host.teardown();
  });
});

// ---- 回归：红灯关闭过一次后，下一次必须还能启动 ----
// 事故：enableWindow 会把 closed/min 一起持久化，用户用红灯退出（= 设计好的退出方式）
// 之后，下一次 arcade 会在 enableWindow 内部同步 onClose → destroy → root=null，
// 而 mount() 还在继续跑 → TypeError: Cannot read properties of null (reading 'addEventListener')

test('sanitizeStoredWindowState keeps geometry but drops closed/min', () => {
  const mem = new Map([
    [GAME_STORAGE_KEY, JSON.stringify({ left: 10, top: 20, w: 640, h: 400, max: false, min: true, closed: true })],
  ]);
  const storage = { getItem: (k) => mem.get(k) ?? null, setItem: (k, v) => mem.set(k, String(v)), removeItem: (k) => mem.delete(k) };
  const out = sanitizeStoredWindowState(storage);
  assert.equal(out.closed, undefined);
  assert.equal(out.min, undefined);
  assert.equal(out.w, 640, 'geometry must survive');
  const written = JSON.parse(mem.get(GAME_STORAGE_KEY));
  assert.ok(!written.closed && !written.min, 'the store must be rewritten without closed/min');
});

test('sanitizeStoredWindowState tolerates missing and corrupt data', () => {
  assert.equal(sanitizeStoredWindowState({ getItem: () => null, setItem() {}, removeItem() {} }), null);
  assert.equal(sanitizeStoredWindowState({ getItem: () => '{oops', setItem() {}, removeItem() {} }), null);
  assert.equal(sanitizeStoredWindowState({ getItem: () => '"str"', setItem() {}, removeItem() {} }), null);
  assert.doesNotThrow(() => sanitizeStoredWindowState(null));
});

test('mounting still works when a previous red-dot close was persisted', () => {
  withStubDom(({ body, storage }) => {
    storage.set(GAME_STORAGE_KEY, JSON.stringify({ left: 300, top: 200, w: 640, h: 400, max: false, min: false, closed: true }));
    const host = createHost({ mount: body, railWidth: 0 });
    const parts = host.mount({ title: 'T', onClose() {} });
    assert.ok(parts.root, 'mount must return a usable root instead of throwing');
    assert.ok(parts.screen, 'screen must exist');
    assert.equal(body.children.length, 1, 'the window must be mounted and visible');
    assert.equal(JSON.parse(storage.get(GAME_STORAGE_KEY)).closed, undefined, 'closed must have been cleared');
    host.teardown();
  });
});

// ---- 默认几何：按「最大网格」反推，而不是拍一个固定像素 ----
// 旧实现固定 760×520 ⇒ 屏幕盒 738×430 ⇒ 网格 87×25、场地 20 行、挡板 4 格（大屏上明显偏小）

test('defaultGameGeom targets the maximum grid when the viewport allows', () => {
  const g = defaultGameGeom({ viewport: { width: 1920, height: 1080 }, railWidth: 190, cellW: 8.4, lineH: 16.8, chromeW: 22, chromeH: 74 });
  const cols = Math.floor((g.w - 22) / 8.4);
  const rows = Math.floor((g.h - 74) / 16.8);
  assert.ok(cols >= 120, `expected >=120 columns worth of width, got ${cols}`);
  assert.ok(rows >= 40, `expected >=40 rows worth of height, got ${rows}`);
});

test('defaultGameGeom never exceeds the viewport, never invades the rail, keeps the minimums', () => {
  for (const [vw, vh] of [[2560, 1400], [1440, 900], [1024, 768], [820, 640], [700, 500], [640, 480]]) {
    const g = defaultGameGeom({ viewport: { width: vw, height: vh }, railWidth: 190, cellW: 8.4, lineH: 16.8, chromeW: 22, chromeH: 74 });
    assert.ok(g.left >= 190, `${vw}x${vh}: left ${g.left} invaded the icon rail`);
    assert.ok(g.left + g.w <= vw + 1, `${vw}x${vh}: window overflows horizontally`);
    assert.ok(g.top + g.h <= vh + 1, `${vw}x${vh}: window overflows vertically`);
    assert.ok(g.w >= GAME_MIN_W && g.h >= GAME_MIN_H, `${vw}x${vh}: below the minimum size`);
  }
});

test('a bigger viewport never produces a smaller window', () => {
  const w = (vw) => defaultGameGeom({ viewport: { width: vw, height: 900 }, railWidth: 190 }).w;
  assert.ok(w(1920) >= w(1280));
  assert.ok(w(1280) >= w(1024));
  assert.ok(w(1024) >= w(820));
});

test('defaultGameGeom tolerates a missing viewport', () => {
  assert.doesNotThrow(() => defaultGameGeom({}));
  assert.doesNotThrow(() => defaultGameGeom());
  assert.ok(defaultGameGeom().w > 0);
});

test('on a narrow viewport the host leaves geometry to the full-bleed CSS', () => {
  withStubDom(({ body }) => {
    const host = createHost({ mount: body, railWidth: 0 });
    const { root } = host.mount({ title: 'T', onClose() {} });
    assert.equal(root.style.width, '', 'inline width would override the <=640px full-bleed rule');
    assert.equal(root.style.height, '');
    assert.equal(root.classList.contains('floating'), false, 'no floating class on mobile');
    host.teardown();
  }, { width: 390, height: 780 });
});

test('on a wide viewport the host applies the computed default geometry', () => {
  withStubDom(({ body }) => {
    const host = createHost({ mount: body, railWidth: 190 });
    const { root } = host.mount({ title: 'T', onClose() {} });
    assert.match(root.style.width, /^\d+px$/, 'expected an explicit width on desktop');
    assert.ok(parseInt(root.style.width, 10) >= 600, `window too small: ${root.style.width}`);
    assert.equal(root.classList.contains('floating'), true);
    host.teardown();
  });
});
