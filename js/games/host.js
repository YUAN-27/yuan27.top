// ============================================================
//  games/host.js — 唯一允许碰 DOM 的 Arcade 模块
//  责任：建游戏窗口 DOM（复用 .terminal-window 结构）、enableWindow、
//        焦点、rAF、ResizeObserver、visibility/blur、触摸按钮、把行数组写进 DOM。
//  无挂载点时必须返回惰性宿主，绝不能抛错（页面上不能因为游戏崩）。
// ============================================================
import { enableWindow } from '../windowing.js';
import { diffRows } from './renderer.js';

export const GAME_BREAKPOINT = 640;
export const GAME_STORAGE_KEY = 'yuan27.arcade.window.v1';
export const GAME_MIN_W = 420;
export const GAME_MIN_H = 260;

function browserStorage() {
  try { return globalThis.localStorage || null; } catch { return null; }
}

// 游戏窗口每次都必须以「打开」状态出现，**只能继承几何，不能继承 closed/min**。
// 事故记录（浏览器实测报 Cannot read properties of null (reading 'addEventListener')）：
//   用户用**红灯**关掉游戏（那就是设计好的退出方式）→ enableWindow 写入 closed:true；
//   下一次 `arcade pong` 时 enableWindow → restoreFromState() **同步**执行 close()
//   → onStateChange → onClose → end() → destroy() → teardown() 把 root 置空，
//   而 mount() 还在继续执行 → root.addEventListener 撞上 null → 会话启动失败。
export function sanitizeStoredWindowState(storage = browserStorage()) {
  if (!storage) return null;
  try {
    const raw = storage.getItem(GAME_STORAGE_KEY);
    if (!raw) return null;
    const s = JSON.parse(raw);
    if (!s || typeof s !== 'object') return null;
    if (s.closed || s.min) {
      delete s.closed;
      delete s.min;
      try { storage.setItem(GAME_STORAGE_KEY, JSON.stringify(s)); } catch { /* ignore */ }
    }
    return s;
  } catch { return null; }
}

// ⚠️ 挂载点参数命名为 container：若叫 mount 会被下面同名的 function mount() 声明提升覆盖（已踩过）
export function createHost({ mount: container = null, railWidth = 0, focusInput = null } = {}) {
  const offs = [];
  const listeners = { resize: new Set(), visibility: new Set(), blur: new Set(), focus: new Set(), keydown: new Set(), keyup: new Set() };
  const emit = (kind, arg) => { for (const cb of [...listeners[kind]]) { try { cb(arg); } catch { /* ignore */ } } };
  const on = (kind) => (cb) => { listeners[kind].add(cb); return () => listeners[kind].delete(cb); };

  let root = null, screen = null, touchEl = null, headerTitle = null, footerEl = null;
  let win = null, ro = null, rowsCache = [];
  let cells = { cols: 80, rows: 24, cellW: 8, lineH: 16 };
  let measurer = null;

  function activeSessionLike() { return !!root; }

  function measure() {
    if (!screen) return;
    if (!measurer) {
      const cs0 = getComputedStyle(screen);
      measurer = document.createElement('span');
      measurer.style.cssText = 'position:absolute;visibility:hidden;white-space:pre;pointer-events:none';
      measurer.style.font = cs0.font || 'inherit';
      measurer.textContent = '0'.repeat(100);
      // 挂到窗口根节点，**不能**挂进 screen：paint() 首次重建会 textContent='' 把它清掉
      (root || screen).appendChild(measurer);
    }
    const r = measurer.getBoundingClientRect();
    cells.cellW = r.width > 0 ? r.width / 100 : 8;
    const cs = getComputedStyle(screen);
    const lh = parseFloat(cs.lineHeight);
    const fs = parseFloat(cs.fontSize) || 16;
    // line-height 可能算成纯倍数（如 1.2）也可能是 px，两种都要处理
    cells.lineH = !Number.isFinite(lh) || lh <= 0 ? 16 : (lh > 4 ? lh : lh * fs);
    const box = screen.getBoundingClientRect();
    cells.cols = Math.floor(box.width / cells.cellW);
    cells.rows = Math.floor(box.height / cells.lineH);
  }

  function currentDims() {
    measure();
    return { cols: cells.cols, rows: cells.rows };
  }

  function mount(opts = {}) {
    if (!container || typeof document === 'undefined') return { root: null, screen: null, touch: null };

    root = document.createElement('section');
    root.className = 'terminal-window game-window';
    root.setAttribute('tabindex', '-1');
    root.setAttribute('role', 'application');
    root.setAttribute('aria-label', 'Terminal arcade game session');

    const header = document.createElement('header');
    header.className = 'statusbar';
    header.innerHTML = '<span class="traffic-lights">'
      + '<button type="button" class="dot dot-red" data-window-action="close" aria-label="退出游戏" title="退出"></button>'
      + '<button type="button" class="dot dot-yellow" data-window-action="minimize" aria-label="最小化" title="最小化"></button>'
      + '<button type="button" class="dot dot-green" data-window-action="maximize" aria-label="最大化或还原" title="最大化 / 还原"></button>'
      + '</span>';
    headerTitle = document.createElement('span');
    headerTitle.className = 'statusbar-title';
    headerTitle.textContent = opts.title || 'yuan27.top :: arcade';
    const status = document.createElement('span');
    status.className = 'statusbar-status';
    status.textContent = '[arcade]';
    header.append(headerTitle, status);

    screen = document.createElement('pre');
    screen.className = 'game-screen';
    screen.setAttribute('aria-live', 'off');

    touchEl = document.createElement('div');
    touchEl.className = 'game-touch';
    touchEl.hidden = true;
    for (const [cls, label, action] of [['up', '▲', 'up1'], ['down', '▼', 'down1']]) {
      const b = document.createElement('button');
      b.type = 'button';
      b.className = `game-touch-btn game-touch-${cls}`;
      b.dataset.action = action;
      b.textContent = label;
      b.style.touchAction = 'none';
      touchEl.appendChild(b);
    }

    footerEl = document.createElement('div');
    footerEl.className = 'game-footer';
    footerEl.textContent = opts.statusLine || '';

    root.append(header, screen, touchEl, footerEl);
    container.appendChild(root);

    // 绝不复原 closed / minimized（否则红灯关闭过一次，就再也启动不了）
    sanitizeStoredWindowState(browserStorage());

    win = enableWindow(root, {
      handle: header,
      storageKey: GAME_STORAGE_KEY,
      minW: GAME_MIN_W,
      minH: GAME_MIN_H,
      minLeft: railWidth,
      breakpoint: GAME_BREAKPOINT,
      onStateChange: (s) => { if (s.closed && typeof opts.onClose === 'function') opts.onClose(); },
    });

    // enableWindow 可能在初始化期间**同步**结束会话（onStateChange → onClose → destroy → teardown），
    // 那时 root/screen 已被置空。必须立刻干净退出，不能继续碰 DOM。
    if (!root || !screen) return { root: null, screen: null, touch: null };

    // 默认几何：比主窗口小，居中（可通过拖动/缩放改变）
    if (!win.getState().floating) {
      const w = Math.min(760, Math.round(window.innerWidth * 0.72));
      const h = Math.min(520, Math.round(window.innerHeight * 0.64));
      root.classList.add('floating');
      root.style.width = w + 'px';
      root.style.height = h + 'px';
      root.style.left = Math.max(railWidth, Math.round((window.innerWidth - w) / 2)) + 'px';
      root.style.top = Math.round((window.innerHeight - h) / 2) + 'px';
    }

    // ---- listeners（全部登记 offs，teardown 时逐一移除）----
    const kd = (e) => emit('keydown', e);
    const ku = (e) => emit('keyup', e);
    root.addEventListener('keydown', kd);
    root.addEventListener('keyup', ku);
    const bo = () => emit('blur');
    const fo = () => emit('focus');
    root.addEventListener('focusout', onFocusOut);
    window.addEventListener('blur', bo);
    window.addEventListener('focus', fo);          // 与 blur 成对：失焦暂停 → 回焦恢复
    const vis = () => emit('visibility', document.hidden ? 'hidden' : 'visible');
    document.addEventListener('visibilitychange', vis);
    const rs = () => onResizeNotify();
    window.addEventListener('resize', rs);

    if (typeof ResizeObserver === 'function') {
      ro = new ResizeObserver(rs);
      ro.observe(screen);
    }

    offs.push(
      () => root.removeEventListener('keydown', kd),
      () => root.removeEventListener('keyup', ku),
      () => root.removeEventListener('focusout', onFocusOut),
      () => window.removeEventListener('blur', bo),
      () => window.removeEventListener('focus', fo),
      () => document.removeEventListener('visibilitychange', vis),
      () => window.removeEventListener('resize', rs),
      () => { if (ro) { ro.disconnect(); ro = null; } },
    );

    function onFocusOut() {
      // 焦点陷阱：会话活跃时把焦点拉回游戏窗口，避免 Tab 逃回 Shell
      if (!activeSessionLike()) return;
      queueMicrotask(() => { if (activeSessionLike() && root) root.focus(); });
    }

    offs.push(bindTouch());      // 触摸监听器的真正释放入口（不是空操作）
    onResizeNotify();
    return { root, screen, touch: touchEl };
  }

  let rafPending = false;
  function onResizeNotify() {
    if (rafPending) return;
    rafPending = true;
    requestAnimationFrame(() => {
      rafPending = false;
      const dims = currentDims();
      emit('resize', dims);
    });
  }

  // 触摸：pointer 与 touch 双绑定，同一指针只处理一次；返回可释放的 disposer
  const touchBound = new WeakMap();
  function bindTouch() {
    if (!touchEl) return () => {};
    touchEl.hidden = !isCoarse();
    if (touchBound.has(touchEl)) return touchBound.get(touchEl).off;
    const seen = new Set();
    const bound = [];
    const add = (el, type, fn) => { el.addEventListener(type, fn); bound.push(() => el.removeEventListener(type, fn)); };
    const down = (action) => (e) => {
      if (e.pointerId !== undefined && seen.has(e.pointerId)) return;
      if (e.pointerId !== undefined) seen.add(e.pointerId);
      e.preventDefault();
      emit('keydown', { key: action === 'up1' ? 'w' : 's', preventDefault() {}, stopPropagation() {}, __touch: true });
      touchEl.setAttribute('data-active', action);
    };
    const up = (action) => (e) => {
      if (e.pointerId !== undefined) seen.delete(e.pointerId);
      e.preventDefault();
      const key = action === 'up1' ? 'w' : 's';
      emit('keyup', { key });
      if (touchEl.getAttribute('data-active') === action) touchEl.removeAttribute('data-active');
    };
    for (const btn of touchEl.querySelectorAll('.game-touch-btn')) {
      const action = btn.dataset.action;
      add(btn, 'pointerdown', down(action));
      add(btn, 'pointerup', up(action));
      add(btn, 'pointercancel', up(action));
      add(btn, 'pointerleave', up(action));
    }
    const cancelAll = () => {
      seen.clear();
      emit('keyup', { key: 'w' });
      emit('keyup', { key: 's' });
      touchEl.removeAttribute('data-active');
    };
    add(touchEl, 'touchcancel', cancelAll);
    add(touchEl, 'contextmenu', (e) => e.preventDefault());
    const off = () => { while (bound.length) { const f = bound.pop(); try { f(); } catch { /* ignore */ } } seen.clear(); };
    touchBound.set(touchEl, { off });
    return off;
  }

  function isCoarse() {
    return typeof window.matchMedia === 'function' && window.matchMedia(`(max-width: ${GAME_BREAKPOINT}px)`).matches;
  }

  return {
    mount,
    paint(nextRows, _changed) {
      if (!screen) return;
      const changed = Array.isArray(_changed) ? _changed : diffRows(rowsCache, nextRows);
      rowsCache = Array.isArray(nextRows) ? nextRows.slice() : [];
      if (screen.childNodes.length !== rowsCache.length) {
        screen.textContent = '';
        const frag = document.createDocumentFragment();
        for (let i = 0; i < rowsCache.length; i++) {
          const div = document.createElement('div');
          div.className = 'game-row';
          frag.appendChild(div);
        }
        screen.appendChild(frag);
      }
      for (const i of changed) {
        const node = screen.childNodes[i];
        if (node) node.textContent = rowsCache[i] ?? '';
      }
    },
    onResize: on('resize'),
    onVisibility: on('visibility'),
    onBlur: on('blur'),
    onFocus: on('focus'),
    onKeyDown: on('keydown'),
    onKeyUp: on('keyup'),
    now() { return (typeof performance !== 'undefined' && performance.now) ? performance.now() : Date.now(); },
    raf(cb) { return requestAnimationFrame(cb); },
    cancelRAF(h) { if (h !== null && h !== undefined) cancelAnimationFrame(h); },
    focus() { if (root && typeof root.focus === 'function') root.focus({ preventScroll: true }); },
    restoreFocus() {
      if (!focusInput) return;
      // ≤640px 不聚焦：避免移动端弹出软键盘
      if (typeof window.matchMedia === 'function' && window.matchMedia(`(max-width: ${GAME_BREAKPOINT}px)`).matches) return;
      focusInput.focus();
    },
    setTouchVisible(v) { if (touchEl) touchEl.hidden = !v; },
    setStatus(text) { if (footerEl) footerEl.textContent = String(text == null ? '' : text); },
    teardown() {
      const el = root;                  // 先抓引用：不依赖 document / querySelector（无 DOM 环境下也不能抛）
      root = null; screen = null; touchEl = null; headerTitle = null; footerEl = null;
      rowsCache = [];
      while (offs.length) { const off = offs.pop(); try { off(); } catch { /* ignore */ } }
      if (el && el.parentNode) el.parentNode.removeChild(el);
      win = null; ro = null;
    },
  };
}