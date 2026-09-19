// ============================================================
//  windowing.js — 类操作系统窗口：拖动 / 缩放 / 最大化 / 最小化 / 复位
//  桌面端启用；≤breakpoint 的移动端由 enableWindow 自动禁用（保持整屏逻辑）。
//  几何纯函数（hitDir / resizeRect / clampPosition）导出以便单元测试。
// ============================================================

export const RESIZE_BORDER = 6;
export const MIN_W = 420;
export const MIN_H = 300;

const CURSOR = {
  n: 'ns-resize', s: 'ns-resize', e: 'ew-resize', w: 'ew-resize',
  ne: 'nesw-resize', sw: 'nesw-resize', nw: 'nwse-resize', se: 'nwse-resize',
};

// 点 (x,y) 落在窗口 rect 的哪个边/角上（''=不在缩放区）。
export function hitDir(rect, x, y, border = RESIZE_BORDER) {
  const d = [];
  if (y - rect.top <= border) d.push('n');
  if (rect.bottom - y <= border) d.push('s');
  if (x - rect.left <= border) d.push('w');
  if (rect.right - x <= border) d.push('e');
  return d.join('');
}

// 从 start 矩形按方向 dir、位移 (dx,dy) 计算新矩形；对边锚定、最小尺寸夹取。
export function resizeRect(start, dir, dx, dy, minW = MIN_W, minH = MIN_H) {
  let { left, top, w, h } = start;
  const horiz = dir.includes('e') || dir.includes('w');
  const vert = dir.includes('n') || dir.includes('s');
  if (dir.includes('e')) w = start.w + dx;
  if (dir.includes('w')) w = start.w - dx;
  if (dir.includes('s')) h = start.h + dy;
  if (dir.includes('n')) h = start.h - dy;
  if (horiz && w < minW) w = minW;
  if (vert && h < minH) h = minH;
  if (dir.includes('w')) left = start.left + (start.w - w);
  if (dir.includes('n')) top = start.top + (start.h - h);
  return { left, top, w, h };
}

// 拖动时夹取位置：水平至少留 minVisible px，标题栏保持在视口内。
export function clampPosition(rect, viewport, minVisible = 120, titleH = 40) {
  const left = Math.min(Math.max(rect.left, minVisible - rect.w), viewport.width - minVisible);
  const top = Math.min(Math.max(rect.top, 0), viewport.height - titleH);
  return { left, top };
}

export function enableWindow(el, opts = {}) {
  const {
    handle = null,
    dock = null,
    minW = MIN_W,
    minH = MIN_H,
    storageKey = null,
    breakpoint = 640,
    titleHeight = 40,
    minVisible = 120,
  } = opts;

  const mq = window.matchMedia(`(max-width: ${breakpoint}px)`);
  let active = !mq.matches;
  let mode = null;   // 'drag' | 'resize' | null
  let dir = '';      // resize direction
  let start = null;  // { x, y, left, top, w, h }
  let normal = null; // 非最大化时的几何 { left, top, w, h }

  const viewport = () => ({ width: window.innerWidth, height: window.innerHeight });
  const readRect = () => {
    const r = el.getBoundingClientRect();
    return { left: r.left, top: r.top, w: r.width, h: r.height };
  };
  const applyGeom = (g) => {
    el.classList.add('floating');
    el.style.left = Math.round(g.left) + 'px';
    el.style.top = Math.round(g.top) + 'px';
    el.style.width = Math.round(g.w) + 'px';
    el.style.height = Math.round(g.h) + 'px';
  };
  const clearGeom = () => {
    el.style.left = el.style.top = el.style.width = el.style.height = '';
  };

  function setCursor(d) {
    for (const k of Object.keys(CURSOR)) el.classList.toggle('cursor-' + k, k === d);
  }

  // ---- persistence ----
  const loadState = () => {
    if (!storageKey) return null;
    try { return JSON.parse(localStorage.getItem(storageKey)); } catch { return null; }
  };
  const saveState = () => {
    if (!storageKey || !normal) return;
    try {
      localStorage.setItem(storageKey, JSON.stringify({
        left: normal.left, top: normal.top, w: normal.w, h: normal.h,
        max: el.classList.contains('maximized'),
        min: el.classList.contains('minimized'),
      }));
    } catch { /* storage unavailable */ }
  };
  const clearState = () => {
    if (storageKey) { try { localStorage.removeItem(storageKey); } catch { /* ignore */ } }
  };

  // ---- window actions ----
  function maximize() {
    if (!el.classList.contains('maximized')) normal = readRect();
    el.classList.add('floating', 'maximized');
    el.style.left = '0px';
    el.style.top = '0px';
    el.style.width = '100vw';
    el.style.height = '100dvh';
    saveState();
  }
  function restore() {
    el.classList.remove('maximized');
    if (normal) applyGeom(normal);
    saveState();
  }
  function toggleMaximize() {
    if (el.classList.contains('maximized')) restore(); else maximize();
  }
  function minimize() {
    if (!el.classList.contains('maximized')) normal = readRect();
    el.classList.remove('maximized');
    el.classList.add('floating', 'minimized');
    if (dock) dock.hidden = false;
    saveState();
  }
  function unminimize() {
    el.classList.remove('minimized');
    if (dock) dock.hidden = true;
    if (normal) applyGeom(normal);
    saveState();
  }
  function reset() {
    el.classList.remove('floating', 'maximized', 'minimized', 'window-drag');
    clearGeom();
    setCursor('');
    normal = null;
    if (dock) dock.hidden = true;
    clearState();
  }

  function restoreFromState() {
    const s = loadState();
    if (!s) return;
    const vp = viewport();
    const g = {
      w: Math.min(s.w || 900, vp.width),
      h: Math.min(s.h || 640, vp.height),
      left: s.left || 0,
      top: s.top || 0,
    };
    const c = clampPosition(g, vp, minVisible, titleHeight);
    g.left = c.left;
    g.top = c.top;
    normal = g;
    applyGeom(g);
    if (s.max) maximize();
    else if (s.min) minimize();
  }

  function setActive(on) {
    if (on === active) return;
    active = on;
    if (!on) {
      el.classList.remove('floating', 'maximized', 'minimized', 'window-drag');
      clearGeom();
      setCursor('');
      document.body.classList.remove('no-select');
      if (dock) dock.hidden = true;
      mode = null;
      dir = '';
    } else {
      restoreFromState();
    }
  }

  // ---- pointer interaction ----
  function onPointerDown(e) {
    if (!active || e.button !== 0 || el.classList.contains('minimized')) return;
    if (e.target.closest && e.target.closest('.dot')) return; // traffic-light buttons

    const maximized = el.classList.contains('maximized');
    const onHandle = handle && handle.contains(e.target);
    const d = maximized ? '' : hitDir(el.getBoundingClientRect(), e.clientX, e.clientY, RESIZE_BORDER);

    if (d) { mode = 'resize'; dir = d; }
    else if (onHandle) { mode = 'drag'; dir = ''; }
    else return;

    if (maximized && mode === 'drag') {
      // OS 行为：拖动最大化窗口 -> 先还原，并让光标落在相近的水平比例处
      const vp = viewport();
      const frac = vp.width ? e.clientX / vp.width : 0.5;
      restore();
      const r = readRect();
      const g = { left: e.clientX - r.w * frac, top: Math.max(0, e.clientY - 20), w: r.w, h: r.h };
      normal = g;
      applyGeom(g);
    }

    if (!el.classList.contains('floating')) { normal = readRect(); applyGeom(normal); }
    if (mode === 'drag') { el.classList.add('window-drag'); setCursor(''); }
    else setCursor(dir);
    start = { x: e.clientX, y: e.clientY, ...readRect() };
    el.setPointerCapture(e.pointerId);
    document.body.classList.add('no-select');
    e.preventDefault();
  }

  function onPointerMove(e) {
    if (!active) return;
    if (!mode) {
      if (el.classList.contains('minimized') || el.classList.contains('maximized')) { setCursor(''); return; }
      setCursor(hitDir(el.getBoundingClientRect(), e.clientX, e.clientY, RESIZE_BORDER));
      return;
    }
    const dx = e.clientX - start.x;
    const dy = e.clientY - start.y;
    if (mode === 'drag') {
      const c = clampPosition(
        { left: start.left + dx, top: start.top + dy, w: start.w, h: start.h },
        viewport(), minVisible, titleHeight,
      );
      el.style.left = Math.round(c.left) + 'px';
      el.style.top = Math.round(c.top) + 'px';
    } else {
      applyGeom(resizeRect(start, dir, dx, dy, minW, minH));
    }
  }

  function onPointerUp(e) {
    if (!active || !mode) return;
    mode = null;
    dir = '';
    el.classList.remove('window-drag');
    setCursor('');
    document.body.classList.remove('no-select');
    try { el.releasePointerCapture(e.pointerId); } catch { /* ignore */ }
    if (!el.classList.contains('maximized') && !el.classList.contains('minimized')) normal = readRect();
    saveState();
  }

  // ---- bindings ----
  el.addEventListener('pointerdown', onPointerDown);
  el.addEventListener('pointermove', onPointerMove);
  el.addEventListener('pointerup', onPointerUp);
  el.addEventListener('pointercancel', onPointerUp);

  if (handle) {
    handle.addEventListener('dblclick', (e) => {
      if (!active) return;
      if (e.target.closest && e.target.closest('.dot')) return;
      toggleMaximize();
    });
  }

  el.querySelectorAll('[data-window-action]').forEach((btn) => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      if (!active) return;
      const action = btn.getAttribute('data-window-action');
      if (action === 'maximize') toggleMaximize();
      else if (action === 'minimize') minimize();
      else if (action === 'reset') reset();
    });
  });

  if (dock) dock.addEventListener('click', () => { if (active) unminimize(); });

  const onMqChange = (e) => setActive(!e.matches);
  if (mq.addEventListener) mq.addEventListener('change', onMqChange);
  else if (mq.addListener) mq.addListener(onMqChange);

  if (active) restoreFromState();

  return { reset, maximize, restore, minimize, unminimize, toggleMaximize };
}
