// ============================================================
//  background.js — 低干扰氛围层（漂浮节点 + 连线）
//  纯函数（mulberry32 / nodeCount / shouldLink / pickMode / fpsFor / dprFor / parseColor）
//  导出以便单元测试；DOM 只在 initBackground() 内访问。
//
//  降级阶梯：
//    full     桌面端：节点 + 连线，30 FPS
//    reduced  窄屏 / 低配：低密度，20 FPS
//    static   移动端 / reduced-motion / motion off：静态极淡网格（CSS）
//    gradient Canvas 不可用：CSS 渐变
// ============================================================

export const MAX_LINK_DIST = 120;
export const NODE_ALPHA = 0.25;
export const LINE_ALPHA = 0.08; // 必须低于 NODE_ALPHA
export const MOUSE_RADIUS = 90;

// Deterministic PRNG so the layout is stable across reloads.
export function mulberry32(seed) {
  let a = seed >>> 0;
  return function rand() {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const clamp = (v, lo, hi) => Math.min(Math.max(v, lo), hi);

// Adaptive node budget by viewport area and device tier.
export function nodeCount(area, tier = 'desktop') {
  if (tier === 'off') return 0;
  if (tier === 'reduced') return clamp(Math.round(area / 80000), 12, 24);
  return clamp(Math.round(area / 40000), 30, 60);
}

export function shouldLink(dist, maxDist = MAX_LINK_DIST) {
  return dist < maxDist;
}

// Choose the rendering mode from the environment. Canvas failure wins.
export function pickMode({
  canvasOk = true, motionOff = false, reducedMotion = false,
  mobile = false, lowPerf = false, narrow = false,
} = {}) {
  if (!canvasOk) return 'gradient';
  if (motionOff || reducedMotion || mobile) return 'static';
  if (lowPerf || narrow) return 'reduced';
  return 'full';
}

export function fpsFor(mode) {
  return mode === 'reduced' ? 20 : 30;
}

export function dprFor(mode, devicePixelRatio) {
  const cap = mode === 'reduced' ? 1 : 1.5;
  return Math.min(devicePixelRatio || 1, cap);
}

export function parseColor(value) {
  const v = String(value || '').trim();
  if (v.startsWith('#')) {
    const h = v.slice(1);
    const full = h.length === 3 ? h.split('').map((c) => c + c).join('') : h;
    if (full.length >= 6) {
      return {
        r: parseInt(full.slice(0, 2), 16),
        g: parseInt(full.slice(2, 4), 16),
        b: parseInt(full.slice(4, 6), 16),
      };
    }
  }
  const m = v.match(/(\d+)\D+(\d+)\D+(\d+)/);
  if (m) return { r: +m[1], g: +m[2], b: +m[3] };
  return { r: 139, g: 148, b: 158 };
}

const MOTION_KEY = 'yuan27.motion';
const SEED_KEY = 'yuan27.bgseed';

function readMotionOff() {
  try { return localStorage.getItem(MOTION_KEY) === 'off'; } catch { return false; }
}
function writeMotionOff(off) {
  try { localStorage.setItem(MOTION_KEY, off ? 'off' : 'on'); } catch { /* ignore */ }
}
function readSeed() {
  try {
    const v = Number(localStorage.getItem(SEED_KEY));
    if (Number.isFinite(v) && v > 0) return v;
    const s = Math.floor(Math.random() * 0xffffffff) || 1;
    localStorage.setItem(SEED_KEY, String(s));
    return s;
  } catch {
    return 1;
  }
}

export function initBackground() {
  const canvas = document.getElementById('bg-canvas');

  const mqMobile = window.matchMedia('(max-width: 640px)');
  const mqReduced = window.matchMedia('(prefers-reduced-motion: reduce)');
  const env = {
    mobile: mqMobile.matches,
    reducedMotion: mqReduced.matches,
    narrow: window.innerWidth < 900,
    lowPerf: (navigator.hardwareConcurrency || 8) <= 2 || (navigator.deviceMemory || 8) <= 2,
    canvasOk: false,
  };

  let ctx = null;
  try {
    ctx = canvas && canvas.getContext ? canvas.getContext('2d') : null;
    env.canvasOk = !!ctx;
  } catch {
    env.canvasOk = false;
  }

  let motionOff = readMotionOff();
  let mode = 'gradient';
  let running = false;
  let raf = 0;
  let last = 0;

  const rand = mulberry32(readSeed());
  const nodes = [];
  const mouse = { x: 0, y: 0, tx: 0, ty: 0, alpha: 0, active: false };
  let color = { r: 139, g: 148, b: 158 };
  let W = 0;
  let H = 0;
  let dpr = 1;
  let interval = 1000 / 30;

  function refreshColor() {
    try {
      color = parseColor(getComputedStyle(document.documentElement).getPropertyValue('--text-muted'));
    } catch { /* keep previous */ }
  }

  function makeNode() {
    return {
      x: rand() * W,
      y: rand() * H,
      vx: (rand() - 0.5) * 0.16, // very slow drift
      vy: (rand() - 0.5) * 0.16,
      r: 0.8 + rand() * 0.9,
    };
  }

  function resize() {
    dpr = dprFor(mode, window.devicePixelRatio);
    W = window.innerWidth;
    H = window.innerHeight;
    canvas.width = Math.round(W * dpr);
    canvas.height = Math.round(H * dpr);
    canvas.style.width = W + 'px';
    canvas.style.height = H + 'px';
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

    const target = nodeCount(W * H, mode === 'reduced' ? 'reduced' : 'desktop');
    while (nodes.length < target) nodes.push(makeNode());
    if (nodes.length > target) nodes.length = target;

    mouse.x = mouse.tx = W / 2;
    mouse.y = mouse.ty = H / 2;
  }

  function draw() {
    // smooth mouse follow (no jumps)
    mouse.x += (mouse.tx - mouse.x) * 0.08;
    mouse.y += (mouse.ty - mouse.y) * 0.08;
    mouse.alpha += ((mouse.active ? 1 : 0) - mouse.alpha) * 0.05;

    ctx.clearRect(0, 0, W, H);
    const { r, g, b } = color;

    // links first (lower alpha, below nodes)
    ctx.lineWidth = 1;
    for (let i = 0; i < nodes.length; i++) {
      const a = nodes[i];
      for (let j = i + 1; j < nodes.length; j++) {
        const c = nodes[j];
        const dx = a.x - c.x;
        const dy = a.y - c.y;
        const d = Math.sqrt(dx * dx + dy * dy);
        if (!shouldLink(d)) continue;
        ctx.strokeStyle = `rgba(${r},${g},${b},${((1 - d / MAX_LINK_DIST) * LINE_ALPHA).toFixed(3)})`;
        ctx.beginPath();
        ctx.moveTo(a.x, a.y);
        ctx.lineTo(c.x, c.y);
        ctx.stroke();
      }
    }

    // subtle mouse glow (small, low alpha), fades out on leave
    if (mouse.alpha > 0.01) {
      const grad = ctx.createRadialGradient(mouse.x, mouse.y, 0, mouse.x, mouse.y, MOUSE_RADIUS);
      grad.addColorStop(0, `rgba(${r},${g},${b},${(0.03 * mouse.alpha).toFixed(3)})`);
      grad.addColorStop(1, `rgba(${r},${g},${b},0)`);
      ctx.fillStyle = grad;
      ctx.beginPath();
      ctx.arc(mouse.x, mouse.y, MOUSE_RADIUS, 0, Math.PI * 2);
      ctx.fill();
    }

    // nodes
    ctx.fillStyle = `rgba(${r},${g},${b},${NODE_ALPHA})`;
    for (const n of nodes) {
      n.x += n.vx;
      n.y += n.vy;
      if (n.x < -12) n.x = W + 12;
      if (n.x > W + 12) n.x = -12;
      if (n.y < -12) n.y = H + 12;
      if (n.y > H + 12) n.y = -12;

      // gentle local push (position only, never velocity -> no vibration)
      if (mouse.alpha > 0.01) {
        const dx = n.x - mouse.x;
        const dy = n.y - mouse.y;
        const d2 = dx * dx + dy * dy;
        if (d2 < MOUSE_RADIUS * MOUSE_RADIUS && d2 > 0.01) {
          const d = Math.sqrt(d2);
          const f = (1 - d / MOUSE_RADIUS) * 0.25 * mouse.alpha;
          n.x += (dx / d) * f;
          n.y += (dy / d) * f;
        }
      }

      ctx.beginPath();
      ctx.arc(n.x, n.y, n.r, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  function frame(ts) {
    if (!running) return;
    raf = requestAnimationFrame(frame);
    if (ts - last < interval) return;
    last = ts;
    draw();
  }

  function start() {
    if (running || !env.canvasOk) return;
    running = true;
    last = 0;
    raf = requestAnimationFrame(frame);
  }

  function stop() {
    running = false;
    if (raf) cancelAnimationFrame(raf);
    raf = 0;
  }

  function applyMode() {
    mode = pickMode({ ...env, motionOff });
    document.body.dataset.bg = mode;
    interval = 1000 / fpsFor(mode);
    if (mode === 'full' || mode === 'reduced') {
      resize();
      if (!document.hidden) start();
    } else {
      stop();
      if (ctx) ctx.clearRect(0, 0, W, H);
    }
  }

  // ---- listeners ----
  let resizeQueued = false;
  window.addEventListener('resize', () => {
    if (resizeQueued) return;
    resizeQueued = true;
    requestAnimationFrame(() => {
      resizeQueued = false;
      env.narrow = window.innerWidth < 900;
      applyMode();
    });
  }, { passive: true });

  document.addEventListener('visibilitychange', () => {
    if (document.hidden) stop();
    else if (mode === 'full' || mode === 'reduced') start();
  });

  // read coordinates only — never preventDefault, never touch focus
  window.addEventListener('pointermove', (e) => {
    mouse.tx = e.clientX;
    mouse.ty = e.clientY;
    mouse.active = true;
  }, { passive: true });
  document.addEventListener('mouseleave', () => { mouse.active = false; });

  const onMq = () => {
    env.mobile = mqMobile.matches;
    env.reducedMotion = mqReduced.matches;
    applyMode();
  };
  if (mqMobile.addEventListener) mqMobile.addEventListener('change', onMq);
  if (mqReduced.addEventListener) mqReduced.addEventListener('change', onMq);

  try {
    new MutationObserver(refreshColor).observe(document.documentElement, {
      attributes: true, attributeFilter: ['data-theme'],
    });
  } catch { /* ignore */ }

  refreshColor();
  applyMode();

  return {
    get mode() { return mode; },
    isMotionOff() { return motionOff; },
    setMotion(off) {
      motionOff = !!off;
      writeMotionOff(motionOff);
      applyMode();
      return mode;
    },
  };
}
