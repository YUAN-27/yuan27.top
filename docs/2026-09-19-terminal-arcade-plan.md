# Terminal Arcade / Pong Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 让 `yuan27.top` 的虚拟终端支持 `arcade pong` —— 以 Unix 前台程序语义打开一个独立的 Terminal 风格游戏窗口，退出后主终端状态零污染。

**Architecture:** 方案 A（独立 Game Terminal Session）。纯逻辑（`storage` / `pong` / `renderer` / `input`）与 DOM（`host`）硬分离；`session` 是生命周期状态机，通过注入的 `host` 接口驱动 DOM；宿主能力由装配层 `main.js` 通过 `shell.ui.openGameSession()` 注入，因此命令层在无 DOM 环境可完整测试。

**Tech Stack:** 原生 ES Modules、零依赖、零构建、`node --test`（**无 jsdom**）、复用既有 `windowing.js` / `terminal.js` 风格与 CSS 变量。

**Spec:** `docs/2026-09-19-terminal-arcade-spec.md`

## Global Constraints

- 零依赖、零构建：不得新增 `package.json` 依赖，不得引入构建步骤。
- 测试命令固定：`node --test tests/*.test.js`；**原有 97 个测试必须始终保持通过**。
- 网格字符白名单：`ASCII U+0020–007E` ∪ `U+2500–257F` ∪ `U+2588` ∪ `U+2192` ∪ `U+276F`。禁用 `●`(U+25CF)、`↑↓`(U+2191/2193) 等子集外字符。
- 只用既有 CSS 变量：`--text --text-muted --dir --prompt --border --bg --bg-elevated --cursor --error --success --link --selection --input --logo-depth`。不得新增 `--terminal-*` 变量。
- 物理量一律归一化到 `[0,1]`；渲染层负责映射到字符格。
- 允许修改的既有文件**仅**：`js/commands.js`、`js/main.js`、`js/sound.js`、`css/style.css`。禁止改 `keys.js`/`terminal.js`/`windowing.js`/`taskbar.js`/`background.js`/`themes.js`/`index.html`。
- 禁止添加 `document`/`window` 级**键盘**监听器；`visibilitychange`/`blur` 生命周期监听除外。
- localStorage key 固定 `yuan27.arcade.v1`；`--reset` 只删它。
- 每个任务结束时 commit；commit message 用 `feat(arcade): ...` / `test(arcade): ...`。

**模块依赖图（锁定，后续任务不得违反）：**

```
commands.js ─► games/arcade.js ─► games/storage.js
                     │            games/pong.js
                     └──(shell.ui.openGameSession 注入)──► main.js
                                                              │
                                        games/session.js ─────┤
                                          ├─ games/input.js   │
                                          └─ games/renderer.js│
                                        games/host.js ────────┘（唯一碰 DOM 的文件）
```

**跨任务接口契约（先看这里，任务里不再重复定义）：**

```js
// storage.js
createStore(storage?) → { load(): Data, save(data): boolean, reset(): void, update(fn): Data }

// pong.js
meta = { id:'pong', title:'PONG', summary:'Classic Pong' }
createState({ rng?, difficulty? }) → state         // 纯状态：phase 'menu'|'serve'|'play'|'gameover'
createGame({ rng?, difficulty? }) → game           // 会话侧适配器：{ state, update, handleKey, render, statusLine, isOver, restart, resize }
update(state, dt, axes) → state                     // axes = { up1, down1, up2, down2 }
handleKey(state, key) → boolean                     // true = 已消费（仅 1/2/Space/Enter）
render(state, frame) → string[]                     // 把动态对象画进 frame.grid
statusLine(state) → string
isOver(state) → boolean
restart(state) → void

// renderer.js
CHAR_RANGES, isAllowedChar(ch)
blankGrid(cols, rows) → string[]
blit(grid, x, y, text) → string[]
box(grid, x, y, w, h) → string[]
layoutFor(cols, rows) → { cols, rows, scoreRow, fieldTop, fieldBottom, fieldRows, innerW, cx }
buildFrame({ title, cols, rows }) → { grid, layout }
gridToString(grid) → string[]
diffRows(prev, next) → number[]
withinWhitelist(grid) → boolean

// input.js
createInputState() → { keys:Set, consumed:Set }
mapAction(key) → 'up1'|'down1'|'up2'|'down2'|'quit'|'confirm'|'mute'|'tab'|'mode1'|'mode2'|null
shouldPrevent(key) → boolean
keyDown(st, key) → boolean        // true = 已处理（需 preventDefault）
keyUp(st, key) → boolean
clearInput(st) → void
axes(st) → { up1, down1, up2, down2 }

// session.js
createSession({ game, host, sfx, store, difficulty, focusInput }) → {
  start(): Promise<void>, pause(), resume(), end(reason), destroy(), exited: Promise<void>,
  getState(): 'created'|'running'|'paused'|'ended'|'destroyed', state /* 游戏状态 */
}
resetActive() / getActive()        // 模块级守卫

// host.js
createHost({ mount, railWidth, focusInput }) → {
  mount(opts) → { root, screen, touch },
  paint(rows, changed),
  setStatus(text),
  onResize(cb) → off, onVisibility(cb) → off, onBlur(cb) → off,
  onFocus(cb) → off, onKeyDown(cb) → off, onKeyUp(cb) → off,
  now(), raf(cb) → h, cancelRAF(h),
  focus(), restoreFocus(), setTouchVisible(b), teardown()
}
```

---

## File Structure

| 文件 | 责任 | 新建/修改 |
|---|---|---|
| `js/games/storage.js` | 版本化持久化 + 容错，注入 storage | 新建 |
| `js/games/pong.js` | Pong 模型：状态/物理/碰撞/得分/AI/按键/渲染 | 新建 |
| `js/games/renderer.js` | 网格工具、布局、静态框架、diff、字符白名单 | 新建 |
| `js/games/input.js` | 按键映射与 pressed 状态机（纯） | 新建 |
| `js/games/session.js` | 生命周期状态机 + 循环 + 装配 | 新建 |
| `js/games/host.js` | 唯一碰 DOM：窗口/enableWindow/焦点/rAF/resize/触摸/绘制 | 新建 |
| `js/games/arcade.js` | 命令入口：参数解析、守卫、错误上报、游戏注册表 | 新建 |
| `js/commands.js` | +1 个 registry 条目 | 修改 |
| `js/main.js` | 装配 `shell.ui` + `sfx` | 修改 |
| `js/sound.js` | +`blip()`（只新增） | 修改 |
| `css/style.css` | `.game-window` / `.game-screen` / `.game-touch` | 修改 |
| `tests/games-*.test.js` | 7 个新测试文件 | 新建 |

---

## Task 1: storage.js — 版本化持久化

**Files:**
- Create: `js/games/storage.js`
- Test: `tests/games-storage.test.js`

**Interfaces:**
- Produces: `ARCADE_KEY='yuan27.arcade.v1'`, `ARCADE_VERSION=1`, `defaultData()`, `normalize(raw)`, `createStore(storage?)`

- [ ] **Step 1: 写失败测试**

```js
// tests/games-storage.test.js
import test from 'node:test';
import assert from 'node:assert/strict';
import { createStore, defaultData, normalize, ARCADE_KEY, ARCADE_VERSION } from '../js/games/storage.js';

// 假 storage：与 localStorage 同接口
function fakeStorage(init = {}) {
  const map = new Map(Object.entries(init));
  return {
    getItem: (k) => (map.has(k) ? map.get(k) : null),
    setItem: (k, v) => map.set(k, String(v)),
    removeItem: (k) => map.delete(k),
    _map: map,
  };
}
const throwing = {
  getItem() { throw new Error('denied'); },
  setItem() { throw new Error('denied'); },
  removeItem() { throw new Error('denied'); },
};

test('defaultData has version and full pong shape', () => {
  const d = defaultData();
  assert.equal(d.version, ARCADE_VERSION);
  assert.deepEqual(Object.keys(d.pong).sort(), ['aiWins', 'bestScore', 'gamesPlayed', 'mode', 'muted', 'playerWins']);
});

test('load on empty storage returns defaults', () => {
  const s = createStore(fakeStorage());
  assert.deepEqual(s.load(), defaultData());
});

test('save then load round-trips', () => {
  const st = fakeStorage();
  const s = createStore(st);
  const d = s.load();
  d.pong.gamesPlayed = 3;
  d.pong.muted = true;
  assert.equal(s.save(d), true);
  const back = createStore(st).load();
  assert.equal(back.pong.gamesPlayed, 3);
  assert.equal(back.pong.muted, true);
});

test('corrupt JSON does not throw and falls back to defaults', () => {
  const s = createStore(fakeStorage({ [ARCADE_KEY]: '{not json' }));
  assert.deepEqual(s.load(), defaultData());
});

test('version mismatch rebuilds defaults', () => {
  const raw = JSON.stringify({ version: 99, pong: { gamesPlayed: 7 } });
  const s = createStore(fakeStorage({ [ARCADE_KEY]: raw }));
  assert.equal(s.load().pong.gamesPlayed, 0);
});

test('wrong field types fall back per-field', () => {
  const raw = JSON.stringify({ version: 1, pong: { gamesPlayed: 'x', muted: 'yes', mode: 'weird', bestScore: 5 } });
  const d = normalize(JSON.parse(raw));
  assert.equal(d.pong.gamesPlayed, 0);
  assert.equal(d.pong.muted, false);
  assert.equal(d.pong.mode, 'normal');
  assert.deepEqual(d.pong.bestScore, { left: 0, right: 0 });
});

test('non-object payload is rejected', () => {
  assert.deepEqual(normalize(null), defaultData());
  assert.deepEqual(normalize([1, 2]), defaultData());
  assert.deepEqual(normalize('str'), defaultData());
});

test('update() reads-modifies-writes and returns data', () => {
  const s = createStore(fakeStorage());
  const d = s.update((cur) => { cur.pong.aiWins += 1; return cur; });
  assert.equal(d.pong.aiWins, 1);
  assert.equal(s.load().pong.aiWins, 1);
});

test('reset removes only the arcade key', () => {
  const st = fakeStorage({ [ARCADE_KEY]: '{}', 'yuan27.theme.v1': 'matrix', 'yuan27.sound.v1': 'on' });
  createStore(st).reset();
  assert.equal(st.getItem(ARCADE_KEY), null);
  assert.equal(st.getItem('yuan27.theme.v1'), 'matrix');
  assert.equal(st.getItem('yuan27.sound.v1'), 'on');
});

test('throwing storage degrades to memory, never throws', () => {
  const s = createStore(throwing);
  assert.deepEqual(s.load(), defaultData());
  assert.equal(s.save(defaultData()), false);
  const d = s.update((cur) => { cur.pong.gamesPlayed = 2; return cur; });
  assert.equal(d.pong.gamesPlayed, 2);
  assert.doesNotThrow(() => s.reset());
});

test('createStore() with no arg does not throw in a DOM-less environment', () => {
  assert.doesNotThrow(() => createStore().load());
});
```

- [ ] **Step 2: 运行测试确认失败**

Run: `node --test tests/games-storage.test.js`
Expected: FAIL —— `Cannot find module '../js/games/storage.js'`

- [ ] **Step 3: 实现**

```js
// ============================================================
//  games/storage.js — Arcade 持久化（版本化 + 容错，纯逻辑）
//  只使用 key: yuan27.arcade.v1，不触碰站点其它 key。
//  任何异常（隐私模式 / 损坏 JSON / 配额满）都必须静默降级，绝不抛出。
// ============================================================

export const ARCADE_KEY = 'yuan27.arcade.v1';
export const ARCADE_VERSION = 1;

export function defaultData() {
  return {
    version: ARCADE_VERSION,
    pong: {
      gamesPlayed: 0,
      playerWins: 0,
      aiWins: 0,
      bestScore: { left: 0, right: 0 },
      muted: false,
      mode: 'normal',
    },
  };
}

const isObj = (v) => v !== null && typeof v === 'object' && !Array.isArray(v);
const num = (v, d) => (typeof v === 'number' && Number.isFinite(v) && v >= 0 ? Math.floor(v) : d);
const bool = (v, d) => (typeof v === 'boolean' ? v : d);

// 版本不符 / 结构损坏 → 整体重建；单字段类型错 → 该字段回落默认
export function normalize(raw) {
  if (!isObj(raw) || raw.version !== ARCADE_VERSION) return defaultData();
  const def = defaultData();
  const p = isObj(raw.pong) ? raw.pong : {};
  const best = isObj(p.bestScore) ? p.bestScore : {};
  return {
    version: ARCADE_VERSION,
    pong: {
      gamesPlayed: num(p.gamesPlayed, def.pong.gamesPlayed),
      playerWins: num(p.playerWins, def.pong.playerWins),
      aiWins: num(p.aiWins, def.pong.aiWins),
      bestScore: { left: num(best.left, 0), right: num(best.right, 0) },
      muted: bool(p.muted, def.pong.muted),
      mode: p.mode === 'easy' ? 'easy' : 'normal',
    },
  };
}

function browserStorage() {
  try { return globalThis.localStorage || null; } catch { return null; }
}

export function createStore(storage = browserStorage()) {
  let memory = defaultData();          // 降级用内存态
  let ok = !!storage;

  const readRaw = () => {
    if (!ok) return null;
    try { return storage.getItem(ARCADE_KEY); } catch { ok = false; return null; }
  };

  return {
    load() {
      const raw = readRaw();
      if (raw == null) return { ...memory };
      let parsed = null;
      try { parsed = JSON.parse(raw); } catch { parsed = null; }
      const data = normalize(parsed);
      memory = data;
      return { ...data, pong: { ...data.pong, bestScore: { ...data.pong.bestScore } } };
    },
    save(data) {
      const safe = normalize(data);
      memory = safe;
      if (!ok) return false;
      try { storage.setItem(ARCADE_KEY, JSON.stringify(safe)); return true; }
      catch { ok = false; return false; }
    },
    update(fn) {
      const cur = this.load();
      const next = typeof fn === 'function' ? (fn(cur) || cur) : cur;
      this.save(next);
      return normalize(next);
    },
    reset() {
      memory = defaultData();
      if (!ok) return;
      try { storage.removeItem(ARCADE_KEY); } catch { /* ignore */ }
    },
  };
}
```

- [ ] **Step 4: 运行测试确认通过**

Run: `node --test tests/games-storage.test.js`
Expected: PASS（11 个测试）

- [ ] **Step 5: 回归 + 提交**

Run: `node --test tests/*.test.js` → Expected: `# fail 0`（97 + 11）

```bash
git add js/games/storage.js tests/games-storage.test.js
git commit -m "feat(arcade): add versioned arcade storage with corrupt-data tolerance"
```

---

## Task 2: pong.js — 模型核心（状态 / 积分 / 碰撞 / 得分）

**Files:**
- Create: `js/games/pong.js`
- Test: `tests/games-pong.test.js`

**Interfaces:**
- Consumes: 无
- Produces: `meta`, `C`（常量）、`createState({rng,difficulty})`、`update(state,dt,axes)`、`serve/launch` 内部、`handleKey`、`isOver`、`restart`、`statusLine`

- [ ] **Step 1: 写失败测试**

```js
// tests/games-pong.test.js
import test from 'node:test';
import assert from 'node:assert/strict';
import { C, meta, createState, update, isOver, restart, statusLine, handleKey } from '../js/games/pong.js';

const fixedRng = (v = 0.5) => () => v;
const newGame = (opts = {}) => createState({ rng: fixedRng(), ...opts });
const speed = (s) => Math.hypot(s.vel.x, s.vel.y);

test('meta exposes id/title/summary', () => {
  assert.equal(meta.id, 'pong');
  assert.ok(meta.title.length > 0 && meta.summary.length > 0);
});

test('initial state is menu with centered ball and zero score', () => {
  const s = newGame();
  assert.equal(s.phase, 'menu');
  assert.deepEqual(s.score, [0, 0]);
  assert.equal(s.ball.x, 0.5);
  assert.equal(s.ball.y, 0.5);
  assert.equal(s.paddles.length, 2);
  assert.equal(s.winner, null);
});

test('all numeric state stays inside [0,1] after many steps', () => {
  const s = newGame();
  handleKey(s, '1');                       // 进入单人
  for (let i = 0; i < 3000; i++) {
    update(s, 1 / 30, { up1: i % 97 < 40, down1: i % 131 < 30 });
    for (const p of s.paddles) {
      assert.ok(p.y >= 0 && p.y + p.h <= 1 + 1e-9, `paddle out of range: ${p.y}`);
    }
    assert.ok(s.ball.y >= -1e-9 && s.ball.y <= 1 + 1e-9, `ball out of range: ${s.ball.y}`);
  }
});

test('paddle moves with axes and stops at walls', () => {
  const s = newGame();
  handleKey(s, '1');
  const y0 = s.paddles[0].y;
  update(s, 0.1, { up1: true });
  assert.ok(s.paddles[0].y < y0, 'up1 should move paddle up');
  for (let i = 0; i < 200; i++) update(s, 0.1, { up1: true });
  assert.equal(s.paddles[0].y, 0);
  for (let i = 0; i < 200; i++) update(s, 0.1, { down1: true });
  assert.equal(s.paddles[0].y, 1 - C.PADDLE_H);
});

test('serve delay then play, ball leaves center toward serve direction', () => {
  const s = newGame();
  handleKey(s, '1');
  assert.equal(s.phase, 'serve');
  update(s, C.SERVE_DELAY + 0.001, {});
  assert.equal(s.phase, 'play');
  assert.ok(Math.abs(s.vel.x) > 0, 'ball must move horizontally');
});

test('top and bottom walls reflect and clamp (no sticking)', () => {
  const s = newGame();
  handleKey(s, '1');
  update(s, C.SERVE_DELAY + 0.001, {});
  s.ball.x = 0.5;
  s.ball.y = 0.02;
  s.vel = { x: 0.0001, y: -1.2 };
  for (let i = 0; i < 60; i++) update(s, 1 / 30, {});
  assert.ok(s.vel.y > 0 || s.ball.y > 0.02, 'must bounce off the top wall');
  assert.ok(s.ball.y >= s.ball.r - 1e-9);
  assert.ok(s.ball.y <= 1 - s.ball.r + 1e-9);
});

test('paddle hit reflects vx and keeps speed magnitude at least SPEED0', () => {
  const s = newGame();
  handleKey(s, '1');
  update(s, C.SERVE_DELAY + 0.001, {});
  const p = s.paddles[0];
  s.ball.x = p.x + p.w + s.ball.r + 0.001;
  s.ball.y = p.y + p.h / 2;
  s.vel = { x: -0.6, y: 0 };
  s.speed = 0.6;
  const before = speed(s);
  for (let i = 0; i < 20 && s.vel.x > 0 === false; i++) update(s, 1 / 60, {});
  assert.ok(s.vel.x > 0, 'vx must flip to the right');
  assert.ok(speed(s) > 0, 'speed must never become 0');
  assert.ok(speed(s) >= before - 1e-6, 'speed must not decrease on hit');
});

test('hit on edge gives steeper angle than hit on center', () => {
  const mk = (offset) => {
    const s = newGame();
    handleKey(s, '1');
    update(s, C.SERVE_DELAY + 0.001, {});
    const p = s.paddles[0];
    s.ball.x = p.x + p.w + s.ball.r + 0.001;
    s.ball.y = p.y + p.h / 2 + offset * (p.h / 2);
    s.vel = { x: -0.7, y: 0 };
    s.speed = 0.7;
    for (let i = 0; i < 10; i++) { update(s, 1 / 120, {}); if (s.vel.x > 0) break; }
    return Math.abs(s.vel.y);
  };
  assert.ok(mk(1) > mk(0), 'edge hit must be steeper than center hit');
});

test('ball speed increases on each paddle hit and is capped', () => {
  const s = newGame();
  handleKey(s, '1');
  update(s, C.SERVE_DELAY + 0.001, {});
  assert.equal(s.speed, C.SPEED0);
  for (let n = 0; n < 40; n++) {
    const p = s.paddles[n % 2];
    s.ball.x = p.x + (n % 2 === 0 ? p.w + s.ball.r + 0.001 : -s.ball.r - 0.001);
    s.ball.y = p.y + p.h / 2;
    s.vel = { x: n % 2 === 0 ? -0.5 : 0.5, y: 0 };
    for (let i = 0; i < 6; i++) update(s, 1 / 120, {});
  }
  assert.ok(s.speed <= C.SPEED_MAX + 1e-9, `speed exceeded cap: ${s.speed}`);
  assert.ok(s.speed > C.SPEED0);
});

test('high-speed ball cannot tunnel through a paddle', () => {
  const s = newGame();
  handleKey(s, '1');
  update(s, C.SERVE_DELAY + 0.001, {});
  const p = s.paddles[0];
  let reflected = false;
  s.ball.x = 0.5;
  s.ball.y = p.y + p.h / 2;
  s.speed = C.SPEED_MAX;
  s.vel = { x: -C.SPEED_MAX, y: 0 };
  for (let i = 0; i < 120; i++) {
    update(s, 1 / 30, {});
    assert.equal(s.score[1], 0, 'ball must not pass the left paddle');
    if (s.vel.x > 0) { reflected = true; break; }
  }
  assert.ok(reflected, 'ball must be reflected by the paddle');
});

test('scoring increments, serves toward the loser, resets speed', () => {
  const s = newGame();
  handleKey(s, '1');
  update(s, C.SERVE_DELAY + 0.001, {});
  s.ball.x = 1.02;
  s.ball.y = 0.5;
  s.vel = { x: C.SPEED_MAX, y: 0 };
  update(s, 1 / 30, {});
  assert.deepEqual(s.score, [1, 0]);
  assert.equal(s.phase, 'serve');
  assert.equal(s.speed, C.SPEED0);
  update(s, C.SERVE_DELAY + 0.001, {});
  assert.ok(s.vel.x > 0, 'serve must head toward the side that lost (right)');
});

test('first to WIN_SCORE wins and phase becomes gameover', () => {
  const s = newGame();
  handleKey(s, '1');
  for (let n = 0; n < C.WIN_SCORE; n++) {
    update(s, C.SERVE_DELAY + 0.001, {});
    s.ball.x = 1.02;
    s.vel = { x: C.SPEED_MAX, y: 0 };
    update(s, 1 / 30, {});
  }
  assert.equal(s.score[0], C.WIN_SCORE);
  assert.equal(s.phase, 'gameover');
  assert.equal(s.winner, 0);
  assert.equal(isOver(s), true);
});

test('restart clears score and returns to serve', () => {
  const s = newGame();
  handleKey(s, '1');
  s.score = [5, 3];
  s.phase = 'gameover';
  restart(s);
  assert.deepEqual(s.score, [0, 0]);
  assert.equal(s.phase, 'serve');
  assert.equal(s.winner, null);
  assert.equal(s.ball.x, 0.5);
});

test('dt is clamped so a huge frame gap cannot teleport the ball', () => {
  const s = newGame();
  handleKey(s, '1');
  update(s, C.SERVE_DELAY + 0.001, {});
  const before = s.ball.x;
  update(s, 5, {});
  assert.ok(Math.abs(s.ball.x - before) <= C.SPEED_MAX * C.DT_MAX + 1e-6);
});

test('serve countdown uses real dt while motion stays clamped', () => {
  const s = newGame();
  handleKey(s, '1');
  assert.equal(s.phase, 'serve');
  // 倒计时是时钟：一次传入 0.901s 就应该发球（若用夹断后的 0.05s 则永远发不出去）
  update(s, C.SERVE_DELAY + 0.001, {});
  assert.equal(s.phase, 'play');
  // 同一帧不得因大 dt 而瞬移：launch() 当次直接返回
  assert.equal(s.ball.x, 0.5);
  // 下一帧的大 dt 被夹断
  const x = s.ball.x;
  update(s, 5, {});
  assert.ok(Math.abs(s.ball.x - x) <= C.SPEED_MAX * C.DT_MAX + 1e-6);
});

test('non-finite dt is ignored instead of corrupting state', () => {
  const s = newGame();
  handleKey(s, '1');
  update(s, C.SERVE_DELAY + 0.001, {});
  const snap = { x: s.ball.x, y: s.ball.y, d: s.serveDelay };
  for (const bad of [NaN, Infinity, -1, undefined]) {
    update(s, bad, {});
    assert.ok(Number.isFinite(s.ball.x) && Number.isFinite(s.ball.y), `dt=${bad} corrupted the ball`);
  }
  assert.deepEqual({ x: s.ball.x, y: s.ball.y, d: s.serveDelay }, snap);
});

test('handleKey only consumes menu/gameover keys', () => {
  const s = newGame();
  assert.equal(handleKey(s, 'x'), false);
  assert.equal(handleKey(s, '1'), true);
  assert.equal(s.mode, 'single');
  s.phase = 'gameover';
  assert.equal(handleKey(s, ' '), true);
  assert.equal(s.phase, 'serve');
});

test('statusLine is non-empty ASCII in every phase', () => {
  const s = newGame();
  for (const ph of ['menu', 'serve', 'play', 'gameover']) {
    s.phase = ph;
    const line = statusLine(s);
    assert.ok(line.length > 0);
    assert.ok([...line].every((c) => c.codePointAt(0) <= 0x7e), `non-ascii in statusLine: ${line}`);
  }
});
```

- [ ] **Step 2: 运行测试确认失败**

Run: `node --test tests/games-pong.test.js`
Expected: FAIL —— `Cannot find module '../js/games/pong.js'`

- [ ] **Step 3: 实现**

```js
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
```

- [ ] **Step 4: 运行测试确认通过**

Run: `node --test tests/games-pong.test.js`
Expected: PASS（18 个测试）

- [ ] **Step 5: 回归 + 提交**

Run: `node --test tests/*.test.js` → Expected: `# fail 0`

```bash
git add js/games/pong.js tests/games-pong.test.js
git commit -m "feat(arcade): add pure pong model with substepped collision"
```

---

## Task 3: pong.js — AI 行为与难度

**Files:**
- Modify: `js/games/pong.js`（无新导出；AI 已由 Task 2 落地，本任务补测试与 `setDifficulty`）
- Test: `tests/games-pong-ai.test.js`

**Interfaces:**
- Consumes: Task 2 的 `createState`、`update`、`C`
- Produces: `setDifficulty(state, name) → boolean`

- [ ] **Step 1: 写失败测试**

```js
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
```

- [ ] **Step 2: 运行测试确认失败**

Run: `node --test tests/games-pong-ai.test.js`
Expected: FAIL —— `setDifficulty is not a function`

- [ ] **Step 3: 实现（在 pong.js 末尾追加）**

```js
export function setDifficulty(state, name) {
  if (name !== 'easy' && name !== 'normal') return false;
  state.difficulty = name;
  return true;
}
```

- [ ] **Step 4: 运行测试确认通过**

Run: `node --test tests/games-pong-ai.test.js`
Expected: PASS（6 个测试）

- [ ] **Step 5: 回归 + 提交**

Run: `node --test tests/*.test.js` → Expected: `# fail 0`

```bash
git add js/games/pong.js tests/games-pong-ai.test.js
git commit -m "test(arcade): cover pong AI tracking, dead zone and difficulty"
```

---

## Task 4: renderer.js — 网格工具 / 布局 / 静态框架

**Files:**
- Create: `js/games/renderer.js`
- Test: `tests/games-renderer.test.js`

**Interfaces:**
- Produces: `CHAR_RANGES`、`isAllowedChar`、`blankGrid`、`blit`、`box`、`layoutFor`、`buildFrame`、`gridToString`、`diffRows`、`withinWhitelist`

- [ ] **Step 1: 写失败测试**

```js
// tests/games-renderer.test.js
import test from 'node:test';
import assert from 'node:assert/strict';
import {
  CHAR_RANGES, isAllowedChar, blankGrid, blit, box,
  layoutFor, buildFrame, gridToString, diffRows, withinWhitelist,
} from '../js/games/renderer.js';

test('whitelist is exactly the font subset ranges', () => {
  // 允许：ASCII + 边界值 U+257F / U+2588 / U+276F / U+2192
  // ⚠️ U+2554（╔）落在 U+2500–257F 区间内，是合法的，不能拿来当反例
  for (const ch of [' ', '~', 'A', 'z', '0', '─', '│', '┌', '┐', '└', '┘', '├', '┤', '█', '→', '❯', '╔', '\u257f']) {
    assert.ok(isAllowedChar(ch), `should allow ${ch}`);
  }
  // 拒绝：半块/点/箭头/汉字/重音，以及区间边界外一格
  for (const ch of ['●', '↑', '↓', '▄', '▀', '\u24ff', '\u2590', '你', 'é', '·']) {
    assert.ok(!isAllowedChar(ch), `should reject ${ch}`);
  }
  assert.equal(CHAR_RANGES.length, 5);
});

test('blankGrid has exact dimensions filled with spaces', () => {
  const g = blankGrid(10, 4);
  assert.equal(g.length, 4);
  for (const row of g) {
    assert.equal(row.length, 10);
    assert.equal(row, ' '.repeat(10));
  }
});

test('blit writes text at a position and never changes row width', () => {
  const g = blankGrid(8, 2);
  blit(g, 2, 1, 'ABC');
  assert.equal(g[1], '  ABC   ');
  assert.equal(g[0], '        ');
  assert.equal(g[1].length, 8);
});

test('blit clips at edges and ignores out-of-range coordinates', () => {
  const g = blankGrid(5, 2);
  blit(g, 3, 0, 'XYZ');
  assert.equal(g[0], '   XY');
  blit(g, -1, 0, 'Q');
  assert.equal(g[0], '   XY');
  blit(g, 0, 9, 'Q');
  assert.equal(g.length, 2);
});

test('box draws a closed rectangle using whitelisted glyphs', () => {
  const g = blankGrid(6, 4);
  box(g, 0, 0, 6, 4);
  assert.equal(g[0], '┌────┐');
  assert.equal(g[3], '└────┘');
  assert.equal(g[1], '│    │');
  assert.ok(withinWhitelist(g));
});

test('layoutFor keeps the playfield strictly inside the frame', () => {
  const L = layoutFor(80, 24);
  assert.equal(L.cols, 80);
  assert.equal(L.rows, 24);
  assert.equal(L.scoreRow, 3);
  assert.equal(L.fieldTop, 4);
  assert.equal(L.fieldBottom, 22);
  assert.equal(L.fieldRows, 19);
  assert.equal(L.innerW, 78);
  assert.equal(L.cx, 40);
  // 场内行必须严格落在边框内部
  assert.ok(L.fieldTop > 2 && L.fieldBottom < L.rows - 1);
});

test('layoutFor clamps to sane bounds and works at the minimum grid', () => {
  const small = layoutFor(20, 8);
  assert.ok(small.cols >= 40 && small.rows >= 12, 'must clamp up to the minimum grid');
  const big = layoutFor(400, 200);
  assert.ok(big.cols <= 120 && big.rows <= 40, 'must clamp down to the maximum grid');
});

test('buildFrame produces a full grid with title and footer inside the whitelist', () => {
  const { grid, layout } = buildFrame({ title: 'yuan27.top :: arcade :: pong', cols: 60, rows: 20 });
  assert.equal(grid.length, layout.rows);
  for (const row of grid) assert.equal(row.length, layout.cols);
  assert.ok(grid[0].startsWith('┌'));
  assert.ok(grid.at(-1).startsWith('└'));
  assert.ok(grid[1].includes('yuan27.top :: arcade :: pong'));
  assert.ok(withinWhitelist(grid));
});

test('buildFrame draws a dashed center line only inside the playfield', () => {
  const { grid, layout } = buildFrame({ title: 'T', cols: 41, rows: 20 });
  const col = layout.cx;
  assert.equal(grid[layout.scoreRow][col], ' ', 'the score row must stay empty at the center');
  assert.equal(grid[0][col], '─', 'the top border must not be the center line');
  assert.equal(grid[layout.fieldTop][col], '│');
  assert.equal(grid[layout.fieldTop + 1][col], ' ', 'the center line must be dashed');
  assert.equal(grid[layout.fieldTop + 2][col], '│');
  assert.equal(grid[layout.fieldBottom][col], '│', 'the last field row must still be dashed');
});

test('gridToString returns the same rows as an array', () => {
  const g = blankGrid(4, 3);
  const lines = gridToString(g);
  assert.equal(lines.length, 3);
  assert.deepEqual(lines, g);
});

test('diffRows reports only changed rows and tolerates length changes', () => {
  assert.deepEqual(diffRows(['a', 'b'], ['a', 'c']), [1]);
  assert.deepEqual(diffRows(['a', 'b'], ['a', 'b']), []);
  assert.deepEqual(diffRows(['a'], ['a', 'b', 'c']), [1, 2]);
  assert.deepEqual(diffRows(['a', 'b', 'c'], ['a']), [1, 2]);
});

test('withinWhitelist detects a single illegal glyph', () => {
  const g = blankGrid(6, 1);
  assert.ok(withinWhitelist(g));
  blit(g, 0, 0, '●');
  assert.ok(!withinWhitelist(g));
});
```

- [ ] **Step 2: 运行测试确认失败**

Run: `node --test tests/games-renderer.test.js`
Expected: FAIL —— `Cannot find module '../js/games/renderer.js'`

- [ ] **Step 3: 实现**

```js
// ============================================================
//  games/renderer.js — 字符网格视图层（纯函数，不碰 DOM）
//
//  字体是子集化的：只有 ASCII + U+2500–257F + U+2588 + U+2192 + U+276F
//  在 css/theme.css 的 unicode-range 里。任何其它字符会掉进回退字体，
//  advance width 改变 → 整个网格错位。所以有 CHAR_RANGES 白名单 + 测试。
// ============================================================

export const CHAR_RANGES = [
  [0x20, 0x7e],     // ASCII
  [0x2192, 0x2192], // →
  [0x2500, 0x257f], // 制表符
  [0x2588, 0x2588], // █
  [0x276f, 0x276f], // ❯
];

export const glyphs = {
  // 原版 Pong（1972）的球与挡板都是矩形：实心块 + 竖线，靠长度区分。
  // 不用 'O'（PONG/GAME OVER 含大写 O 会混淆），不用 '*'（辨识度差）。
  ball: '█',
  paddle: '┃',
  tl: '┌', tr: '┐', bl: '└', br: '┘',
  h: '─', v: '│', vl: '├', vr: '┤',
};

export function isAllowedChar(ch) {
  const c = ch.codePointAt(0);
  return CHAR_RANGES.some(([a, b]) => c >= a && c <= b);
}

export function withinWhitelist(grid) {
  for (const row of grid) for (const ch of row) if (!isAllowedChar(ch)) return false;
  return true;
}

export function blankGrid(cols, rows) {
  const w = Math.max(1, Math.floor(cols));
  const h = Math.max(1, Math.floor(rows));
  return Array.from({ length: h }, () => ' '.repeat(w));
}

// 原地写入；越界自动裁剪，行宽永远不变
export function blit(grid, x, y, text) {
  if (y < 0 || y >= grid.length) return grid;
  const w = grid[y].length;
  if (x >= w || x + text.length <= 0) return grid;
  const start = Math.max(0, x);
  const skip = start - x;
  const t = text.slice(skip, skip + (w - start));
  if (!t) return grid;
  grid[y] = grid[y].slice(0, start) + t + grid[y].slice(start + t.length);
  return grid;
}

export function box(grid, x, y, w, h, g = glyphs) {
  if (w < 2 || h < 2) return grid;
  blit(grid, x, y, g.tl + g.h.repeat(w - 2) + g.tr);
  for (let i = 1; i < h - 1; i++) blit(grid, x, y + i, g.v + ' '.repeat(w - 2) + g.v);
  blit(grid, x, y + h - 1, g.bl + g.h.repeat(w - 2) + g.br);
  return grid;
}

export const GRID_MIN = { cols: 40, rows: 12 };
export const GRID_MAX = { cols: 120, rows: 40 };

export function layoutFor(cols, rows) {
  const c = Math.min(GRID_MAX.cols, Math.max(GRID_MIN.cols, Math.floor(cols)));
  const r = Math.min(GRID_MAX.rows, Math.max(GRID_MIN.rows, Math.floor(rows)));
  // 结构: 0 上边框 / 1 标题 / 2 分隔 / 3 比分 / 4..r-5 场内 / r-4 分隔 / r-3 底栏 / r-2 ? / r-1 下边框
  const scoreRow = 3;
  const fieldTop = 4;
  const fieldBottom = r - 2;      // 底栏是 DOM 元素（.game-footer），网格内不再预留底栏行
  return {
    cols: c,
    rows: r,
    scoreRow,
    fieldTop,
    fieldBottom,
    fieldRows: fieldBottom - fieldTop + 1,
    innerW: c - 2,
    cx: Math.floor(c / 2),
  };
}

// 静态层：只在初始化 / resize 时重建
export function buildFrame({ title = '', cols = 80, rows = 24 } = {}) {
  const layout = layoutFor(cols, rows);
  const { cols: c, rows: r } = layout;
  const grid = blankGrid(c, r);

  box(grid, 0, 0, c, r);
  blit(grid, 1, 1, String(title).slice(0, c - 2));
  blit(grid, 0, 2, glyphs.vl + glyphs.h.repeat(c - 2) + glyphs.vr);

  // 虚线中线：隔行画一个 │（不用 U+250A，保证子集内字形一定存在）
  for (let y = layout.fieldTop; y <= layout.fieldBottom; y++) {
    if ((y - layout.fieldTop) % 2 === 0) blit(grid, layout.cx, y, glyphs.v);
  }

  return { grid, layout };
}

export function gridToString(grid) { return grid.slice(); }

export function diffRows(prev, next) {
  const out = [];
  const n = Math.max(prev.length, next.length);
  for (let i = 0; i < n; i++) if (prev[i] !== next[i]) out.push(i);
  return out;
}
```

- [ ] **Step 4: 运行测试确认通过**

Run: `node --test tests/games-renderer.test.js`
Expected: PASS（12 个测试）

- [ ] **Step 5: 回归 + 提交**

Run: `node --test tests/*.test.js` → Expected: `# fail 0`

```bash
git add js/games/renderer.js tests/games-renderer.test.js
git commit -m "feat(arcade): add character-grid renderer with font-subset whitelist"
```

---

## Task 5: pong — 把模型画进网格

**Files:**
- Modify: `js/games/pong.js`（新增 `render`）
- Test: `tests/games-pong-render.test.js`

**Interfaces:**
- Consumes: Task 2 的 `createState`/`update`/`C`，Task 4 的 `buildFrame`/`blit`/`glyphs`/`gridToString`
- Produces: `render(state, frame) → string[]`

- [ ] **Step 1: 写失败测试**

```js
// tests/games-pong-render.test.js
import test from 'node:test';
import assert from 'node:assert/strict';
import { C, createState, createGame, render } from '../js/games/pong.js';
import { buildFrame, withinWhitelist, diffRows } from '../js/games/renderer.js';

function frame(cols = 60, rows = 20) {
  const f = buildFrame({ title: 'yuan27.top :: arcade :: pong', cols, rows });
  const staticRows = f.grid.slice();
  return { ...f, staticRows };
}

const countOf = (grid, ch) => grid.join('').split(ch).length - 1;   // 供后续断言复用

// 显式进入对局：phase='menu' 时 render() 走菜单分支直接 return，
// 不设 phase 的「渲染测试」会空转（数到的是菜单文本里的字符）。
function playing(score = [0, 0]) {
  const s = createState({ rng: () => 0.5 });
  s.phase = 'play';
  s.score = score;
  s.speed = 0.5;
  s.vel = { x: 0.5, y: 0 };
  return s;
}

test('render returns one row per layout row, all whitelisted', () => {
  const s = createState({ rng: () => 0.5 });
  const f = frame();
  const rows = render(s, f);
  assert.equal(rows.length, f.layout.rows);
  for (const row of rows) assert.equal(row.length, f.layout.cols);
  assert.ok(withinWhitelist(rows));
});

test('render draws the score on the score row', () => {
  const s = createState({ rng: () => 0.5 });
  s.score = [7, 5];
  const f = frame();
  const rows = render(s, f);
  assert.ok(rows[f.layout.scoreRow].includes('07'));
  assert.ok(rows[f.layout.scoreRow].includes('05'));
});

test('render draws two paddles of the expected height inside the field', () => {
  const s = playing();
  const f = frame();
  const rows = render(s, f);
  const field = rows.slice(f.layout.fieldTop, f.layout.fieldBottom + 1).join('');
  const blocks = field.split('┃').length - 1;
  const expectedPer = Math.max(2, Math.round(s.paddles[0].h * f.layout.fieldRows));
  assert.equal(blocks, expectedPer * 2, 'only the two paddles may draw the vertical-bar glyph');
  // 挡板必须分列在左右两侧
  for (const y of rows.slice(f.layout.fieldTop, f.layout.fieldBottom + 1)) {
    const left = y.indexOf('┃');
    const right = y.lastIndexOf('┃');
    if (left >= 0 && right > left) assert.ok(right - left > f.layout.cols / 2, 'paddles must be far apart');
  }
});

test('render draws the ball inside the playfield', () => {
  const s = playing();
  s.ball.x = 0.5;
  s.ball.y = 0.5;
  const f = frame();
  const rows = render(s, f);
  const field = rows.slice(f.layout.fieldTop, f.layout.fieldBottom + 1);
  const cells = field.map((r, i) => ({ r, i })).filter(({ r }) => r.includes('*'));
  assert.equal(countOf(field, '*'), 1, 'exactly one ball cell must be drawn');
  assert.equal(cells.length, 1, 'the ball must be a single row');
});

test('the ball glyph never collides with on-screen text', () => {
  const s = playing();
  const f = frame();
  for (const ph of ['menu', 'serve', 'play', 'gameover']) {
    s.phase = ph;
    const rows = render(s, f);
    const n = countOf(rows, '█');
    assert.ok(n === 0 || n === 1, `phase ${ph} drew ${n} blocks; UI text must not contain the ball glyph`);
  }
});

test('menu phase shows the mode choices and hides the ball', () => {
  const s = createState({ rng: () => 0.5 });
  const f = frame();
  const rows = render(s, f);
  const mid = rows.slice(f.layout.fieldTop, f.layout.fieldBottom + 1).join('\n');
  assert.ok(mid.includes('PONG'));
  assert.ok(mid.includes('[1] Single'));
  assert.ok(mid.includes('[2] Two'));
  assert.ok(!mid.includes('*'), 'the ball must not be drawn in the menu');
});

test('gameover phase shows the winner and final score', () => {
  const s = createState({ rng: () => 0.5 });
  s.score = [11, 4];
  s.winner = 0;
  s.phase = 'gameover';
  const f = frame();
  const mid = render(s, f).slice(f.layout.fieldTop, f.layout.fieldBottom + 1).join('\n');
  assert.ok(mid.includes('PLAYER 1 WINS') || mid.includes('WINS'));
  assert.ok(mid.includes('11'));
  assert.ok(mid.includes('04'));
});

test('render is stable: two identical states produce zero diff', () => {
  const s = createState({ rng: () => 0.5 });
  const f = frame();
  const a = render(s, f);
  const b = render(s, f);
  assert.deepEqual(diffRows(a, b), []);
});

test('render preserves the static frame (only dynamic rows differ)', () => {
  const s = createState({ rng: () => 0.5 });
  const f = frame();
  const rows = render(s, f);
  const changed = diffRows(f.staticRows, rows);
  for (const i of changed) {
    assert.ok(
      i === f.layout.scoreRow || (i >= f.layout.fieldTop && i <= f.layout.fieldBottom),
      `static row ${i} was modified`,
    );
  }
});

test('render never writes outside the playfield for extreme positions', () => {
  const s = playing();
  const f = frame();
  for (const [x, y] of [[0, 0], [1, 1], [0, 1], [1, 0], [-0.5, 0.5], [0.5, 2]]) {
    s.ball.x = x;
    s.ball.y = y;
    const rows = render(s, f);
    assert.equal(rows.length, f.layout.rows);
    assert.ok(withinWhitelist(rows));
    const changed = diffRows(f.staticRows, rows);
    for (const i of changed) {
      assert.ok(
        i === f.layout.scoreRow || (i >= f.layout.fieldTop && i <= f.layout.fieldBottom),
        `ball at (${x},${y}) wrote row ${i} outside the playfield`,
      );
    }
  }
});

// ---- 会话侧适配器 createGame：集成接缝（session 用假 game、arcade 用假 session，谁都不会暴露错配）----

test('createGame returns the session-facing object, not a bare state', () => {
  const g = createGame({ rng: () => 0.5 });
  assert.ok(g.state, 'must expose .state');
  assert.equal(g.state.phase, 'menu');
  for (const fn of ['update', 'handleKey', 'render', 'statusLine', 'isOver', 'restart', 'resize']) {
    assert.equal(typeof g[fn], 'function', `missing ${fn}`);
  }
});

test('the adapter keeps state live so the session can read events for sound', () => {
  const g = createGame({ rng: () => 0.5 });
  g.handleKey('1');
  g.update(C.SERVE_DELAY + 0.001, {});
  assert.equal(g.state.phase, 'play');
  assert.ok(Array.isArray(g.state.events));
  g.state.ball.y = 0.02;
  g.state.vel = { x: 0.001, y: -1 };
  g.update(1 / 30, {});
  assert.ok(g.state.events.includes('wall'), 'events must surface for the sfx layer');
});

test('the adapter renders through the shared frame and resize never resets state', () => {
  const g = createGame({ rng: () => 0.5 });
  g.handleKey('1');
  g.update(C.SERVE_DELAY + 0.001, {});
  const f = buildFrame({ title: 'T', cols: 60, rows: 20 });
  const rows = g.render(f);
  assert.equal(rows.length, f.layout.rows);
  const snap = { x: g.state.ball.x, y: g.state.ball.y, s: g.state.score.slice() };
  g.resize({ cols: 100, rows: 30 });
  assert.deepEqual({ x: g.state.ball.x, y: g.state.ball.y, s: g.state.score.slice() }, snap);
});

test('the adapter restart / isOver / statusLine delegate to the pure functions', () => {
  const g = createGame({ rng: () => 0.5 });
  g.handleKey('1');
  g.state.score = [11, 3];
  g.state.winner = 0;
  g.state.phase = 'gameover';
  assert.equal(g.isOver(), true);
  assert.ok(g.statusLine().includes('Space'));
  g.restart();
  assert.equal(g.isOver(), false);
  assert.deepEqual(g.state.score, [0, 0]);
});
```

- [ ] **Step 2: 运行测试确认失败**

Run: `node --test tests/games-pong-render.test.js`
Expected: FAIL —— `render is not a function`

- [ ] **Step 3: 实现（在 pong.js 末尾追加；并在文件顶部加入 renderer 导入）**

顶部加：

```js
import { blit, glyphs } from './renderer.js';
```

末尾加：

```js
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
```

```js
// ---- 会话侧接口适配（spec §14）：把纯函数 API 包成 session 需要的对象接口 ----
// ⚠️ 这是集成盲区：session 测试用假 game、arcade 测试用假 session，
//    两者都不会暴露「纯状态对象 vs 带方法的游戏对象」错配（烟测抓到过）。
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
    resize: () => {},   // 归一化坐标 ⇒ 改尺寸不改模型
  };
}
```

- [ ] **Step 4: 运行测试通过（10 → 14：含 4 条适配器契约测试）**

Run: `node --test tests/games-pong-render.test.js`
Expected: PASS（10 个测试）

- [ ] **Step 5: 回归 + 提交**

Run: `node --test tests/*.test.js` → Expected: `# fail 0`

```bash
git add js/games/pong.js tests/games-pong-render.test.js
git commit -m "feat(arcade): render pong state into the character grid"
```

---

## Task 6: input.js — 按键映射与 pressed 状态

**Files:**
- Create: `js/games/input.js`
- Test: `tests/games-input.test.js`

**Interfaces:**
- Produces: `createInputState`、`mapAction`、`shouldPrevent`、`keyDown`、`keyUp`、`clearInput`、`axes`、`consume`、`isConsumed`

- [ ] **Step 1: 写失败测试**

```js
// tests/games-input.test.js
import test from 'node:test';
import assert from 'node:assert/strict';
import {
  createInputState, mapAction, shouldPrevent, keyDown, keyUp, clearInput, axes, consume, isConsumed,
} from '../js/games/input.js';

test('maps every documented key', () => {
  const cases = {
    w: 'up1', W: 'up1', s: 'down1', S: 'down1',
    ArrowUp: 'up2', ArrowDown: 'down2',
    Escape: 'quit', q: 'quit', Q: 'quit',
    ' ': 'confirm', Enter: 'confirm',
    m: 'mute', M: 'mute', Tab: 'tab',
    '1': 'mode1', '2': 'mode2',
  };
  for (const [key, action] of Object.entries(cases)) assert.equal(mapAction(key), action, key);
  for (const key of ['a', 'z', 'F5', 'Backspace']) assert.equal(mapAction(key), null, key);
});

test('shouldPrevent is true only for game keys (never blank)', () => {
  for (const k of ['w', 'S', 'ArrowUp', 'ArrowDown', 'Escape', 'q', ' ', 'Tab', 'm', '1', '2']) {
    assert.equal(shouldPrevent(k), true, k);
  }
  for (const k of ['a', 'F5', 'Meta', 'Shift']) assert.equal(shouldPrevent(k), false, k);
});

test('keyDown/keyUp maintain a pressed set', () => {
  const st = createInputState();
  assert.equal(keyDown(st, 'w'), true);
  assert.equal(keyDown(st, 's'), true);
  assert.equal(keyDown(st, 'a'), false, 'unmapped keys are not handled');
  assert.deepEqual(axes(st), { up1: true, down1: true, up2: false, down2: false });
  keyUp(st, 'w');
  assert.deepEqual(axes(st), { up1: false, down1: true, up2: false, down2: false });
});

test('repeated keydown does not double count (auto-repeat safe)', () => {
  const st = createInputState();
  for (let i = 0; i < 20; i++) keyDown(st, 'ArrowUp');
  assert.equal(st.keys.size, 1);
  keyUp(st, 'ArrowUp');
  assert.equal(st.keys.size, 0);
});

test('clearInput wipes pressed state (blur / visibility)', () => {
  const st = createInputState();
  keyDown(st, 'w');
  keyDown(st, 'ArrowDown');
  clearInput(st);
  assert.deepEqual(axes(st), { up1: false, down1: false, up2: false, down2: false });
  assert.equal(st.keys.size, 0);
});

test('opposite keys cancel out in axes', () => {
  const st = createInputState();
  keyDown(st, 'w');
  keyDown(st, 's');
  const a = axes(st);
  assert.equal(a.up1 && a.down1, true, 'both flags are reported; caller decides');
});

test('consume/isConsumed tracks the escape hand-off', () => {
  const st = createInputState();
  assert.equal(isConsumed(st, 'Escape'), false);
  consume(st, 'Escape');
  assert.equal(isConsumed(st, 'Escape'), true);
  clearInput(st);
  assert.equal(isConsumed(st, 'Escape'), false, 'clearing input must also clear consumed marks');
});
```

- [ ] **Step 2: 运行测试确认失败**

Run: `node --test tests/games-input.test.js`
Expected: FAIL —— `Cannot find module '../js/games/input.js'`

- [ ] **Step 3: 实现**

```js
// ============================================================
//  games/input.js — 游戏按键状态机（纯逻辑，不绑 DOM）
//  键盘归属靠「焦点在游戏窗口上」，不添加全局键盘监听。
//  preventDefault 只覆盖游戏用到的键，其余一律透传。
// ============================================================

const MAP = {
  w: 'up1', s: 'down1',
  ArrowUp: 'up2', ArrowDown: 'down2',
  Escape: 'quit', q: 'quit',
  ' ': 'confirm', Enter: 'confirm',
  m: 'mute',
  Tab: 'tab',
  '1': 'mode1', '2': 'mode2',
};

const norm = (key) => (typeof key === 'string' && key.length === 1 ? key.toLowerCase() : key);

export function mapAction(key) {
  return MAP[norm(key)] ?? null;
}

export function shouldPrevent(key) {
  return mapAction(key) !== null;
}

export function createInputState() {
  return { keys: new Set(), consumed: new Set() };
}

// 返回 true = 已被游戏处理（调用方应 preventDefault）
export function keyDown(state, key) {
  const action = mapAction(key);
  if (!action) return false;
  state.keys.add(action);
  return true;
}

export function keyUp(state, key) {
  const action = mapAction(key);
  if (!action) return false;
  state.keys.delete(action);
  return true;
}

export function clearInput(state) {
  state.keys.clear();
  state.consumed.clear();
}

export function consume(state, key) {
  state.consumed.add(norm(key));
}

export function isConsumed(state, key) {
  return state.consumed.has(norm(key));
}

export function axes(state) {
  return {
    up1: state.keys.has('up1'),
    down1: state.keys.has('down1'),
    up2: state.keys.has('up2'),
    down2: state.keys.has('down2'),
  };
}
```

- [ ] **Step 4: 运行测试确认通过**

Run: `node --test tests/games-input.test.js`
Expected: PASS（7 个测试）

- [ ] **Step 5: 回归 + 提交**

Run: `node --test tests/*.test.js` → Expected: `# fail 0`

```bash
git add js/games/input.js tests/games-input.test.js
git commit -m "feat(arcade): add game keyboard state machine"
```

---

## Task 7: session.js — 生命周期状态机（注入 host）

**Files:**
- Create: `js/games/session.js`
- Test: `tests/games-session.test.js`

**Interfaces:**
- Consumes: `input.js`（`createInputState`/`keyDown`/`keyUp`/`clearInput`/`axes`/`consume`/`isConsumed`）、`renderer.js`（`diffRows`）
- Produces: `createSession(opts) → Session`，`getActive()`、`resetActive()`

- [ ] **Step 1: 写失败测试（用假 host，无 DOM）**

```js
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
```

- [ ] **Step 2: 运行测试确认失败**

Run: `node --test tests/games-session.test.js`
Expected: FAIL —— `Cannot find module '../js/games/session.js'`

- [ ] **Step 3: 实现**

```js
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
```

> 说明：`host` 的 `onKeyDown/onKeyUp/onFocus/setStatus` 已在**跨任务契约块**登记。真 host 在 **Task 10** 实现，Task 7 的假 host 必须同步具备这些方法（否则 `session.start()` 一上来就 TypeError，而不是「模块找不到」的预期失败）。

- [ ] **Step 4: 运行测试确认通过**

Run: `node --test tests/games-session.test.js`
Expected: PASS（17 个测试）

- [ ] **Step 5: 回归 + 提交**

Run: `node --test tests/*.test.js` → Expected: `# fail 0`

```bash
git add js/games/session.js tests/games-session.test.js
git commit -m "feat(arcade): add idempotent game session lifecycle"
```

---

## Task 8: arcade.js — 命令入口与守卫

**Files:**
- Create: `js/games/arcade.js`
- Test: `tests/games-arcade.test.js`

**Interfaces:**
- Consumes: `storage.js`、`pong.js`、`session.js` 的 `getActive/resetActive`
- Produces: `GAMES`、`parseArcadeArgs(args)`、`runArcade(shell, args)`

- [ ] **Step 1: 写失败测试**

```js
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
```

- [ ] **Step 2: 运行测试确认失败**

Run: `node --test tests/games-arcade.test.js`
Expected: FAIL —— `Cannot find module '../js/games/arcade.js'`

- [ ] **Step 3: 实现**

```js
// ============================================================
//  games/arcade.js — 命令入口（唯一对外接口）
//  不导入 host/session 实现：宿主能力由装配层 main.js 通过
//  shell.ui.openGameSession(...) 注入，因此本模块在无 DOM 环境可完整测试。
// ============================================================
import { createStore } from './storage.js';
import { meta as pongMeta, createGame as createPong } from './pong.js';
import { getActive } from './session.js';

export const GAMES = {
  [pongMeta.id]: { meta: pongMeta, create: createPong },
};

const LIST = Object.values(GAMES).map((g) => g.meta);

export function parseArcadeArgs(args = []) {
  const list = Array.isArray(args) ? args : [];
  if (list.length === 0) return { action: 'list' };
  const first = String(list[0]);
  if (first === '--list' || first === '-l') return { action: 'list' };
  if (first === '--help' || first === '-h') return { action: 'help' };
  if (first === '--reset') return { action: 'reset' };
  if (list.length > 1) return { action: 'unknown', id: list.join(' ') };
  if (GAMES[first]) return { action: 'play', id: first };
  return { action: 'unknown', id: first };
}

function listLines() {
  return [
    'YUAN27 TERMINAL ARCADE',
    '',
    ...LIST.map((m) => `  ${m.id.padEnd(10)} ${m.summary}`),
    '',
    'Type: arcade pong',
  ];
}

function helpLines() {
  return [
    'arcade - launch terminal arcade games',
    '',
    'Usage:',
    '    arcade                 list games',
    '    arcade <game>          launch a game in its own terminal session',
    '    arcade --list          list games',
    '    arcade --help          show this help',
    '    arcade --reset         reset arcade data (high scores, mute)',
    '',
    'Example:',
    '    arcade pong',
    '',
    'Pong controls:',
    '    W / S                  move player 1 paddle',
    '    Up / Down              move player 2 paddle (two-player mode)',
    '    Space                  serve / play again',
    '    M                      mute game sound only',
    '    ESC / Q                quit the game session',
    '',
    'The game runs in its own terminal window; the main terminal is not modified.',
  ];
}

export async function runArcade(shell, args) {
  const parsed = parseArcadeArgs(args);
  const store = createStore();

  if (parsed.action === 'list') return shell.printText(listLines(), { lineDelay: 0 });
  if (parsed.action === 'help') return shell.printText(helpLines(), { lineDelay: 0 });

  if (parsed.action === 'reset') {
    try { store.reset(); } catch { /* ignore */ }
    return shell.success('arcade: data reset (scores and mute cleared)');
  }

  if (parsed.action === 'unknown') {
    await shell.error(`arcade: unknown game '${parsed.id}'`);
    return shell.muted(`Available games: ${LIST.map((m) => m.id).join(', ')}`);
  }

  const entry = GAMES[parsed.id];
  // 守卫放在命令层，且不在 session.js（而 session.js 只依赖 input/renderer 两个纯模块）
  if (getActive()) return shell.error('arcade: a session is already running');
  if (!shell.ui || typeof shell.ui.openGameSession !== 'function') {
    return shell.error('arcade: no game host available');
  }

  let session = null;
  try {
    session = shell.ui.openGameSession({
      game: entry.create({ difficulty: store.load().pong.mode }),
      store,
      sfx: shell.ui.sfx || {},
      title: `yuan27.top :: arcade :: ${entry.meta.id}`,
    });
  } catch (err) {
    return shell.error(`arcade: failed to start session (${err && err.message ? err.message : 'unknown'})`);
  }

  try {
    await session.start();
  } catch (err) {
    try { session.destroy(); } catch { /* ignore */ }
    return shell.error(`arcade: failed to start session (${err && err.message ? err.message : 'unknown'})`);
  }

  try {
    await session.exited;
  } catch { /* ignore */ }
  return undefined;
}
```

- [ ] **Step 4: 运行测试确认通过**

Run: `node --test tests/games-arcade.test.js`
Expected: PASS（11 个测试）

- [ ] **Step 5: 回归 + 提交**

Run: `node --test tests/*.test.js` → Expected: `# fail 0`

```bash
git add js/games/arcade.js tests/games-arcade.test.js
git commit -m "feat(arcade): add arcade command surface and session guard"
```

---

## Task 9: 注册命令 + 装配 + 音效扩展

**Files:**
- Modify: `js/commands.js`（registry +1 条目）
- Modify: `js/main.js`（注入 `shell.ui`）
- Modify: `js/sound.js`（+`blip`）
- Test: `tests/games-registration.test.js`、`tests/sound.test.js`（新建）

**Interfaces:**
- Consumes: `arcade.runArcade`、`session.createSession`、`host.createHost`（Task 10 提供，本任务先按契约调用）
- Produces: registry 里的 `arcade` 条目、`shell.ui.openGameSession`、`sound.blip(freq, dur, gain, type)`

- [ ] **Step 1: 写失败测试**

```js
// tests/games-registration.test.js
import test from 'node:test';
import assert from 'node:assert/strict';
import { registry, commandNames } from '../js/commands.js';
import { complete } from '../js/completion.js';

test('arcade is registered in the Fun category', () => {
  assert.ok(registry.arcade, 'registry.arcade missing');
  assert.equal(registry.arcade.category, 'Fun');
  assert.equal(typeof registry.arcade.run, 'function');
  assert.ok(registry.arcade.summary.length > 0);
  assert.ok(registry.arcade.help.includes('Usage'));
});

test('commandNames and tab completion pick arcade up automatically', () => {
  assert.ok(commandNames.includes('arcade'));
  const r = complete('ar', '/', commandNames);
  assert.ok(r && r.replace && r.replace.startsWith('arcade'));
});

test('help output includes arcade (derived from the registry)', async () => {
  const out = [];
  const shell = {
    cwd: '/',
    term: { clear() {} },
    error: (m) => out.push(m), success: (m) => out.push(m), muted: (m) => out.push(m),
    printLines: (l) => out.push(Array.isArray(l) ? l.join('\n') : l),
    printText: (l) => out.push(Array.isArray(l) ? l.join('\n') : l),
    printChars: (t) => out.push(t),
  };
  await registry.help.run(shell, []);
  assert.ok(out.join('\n').includes('arcade'));
});
```

```js
// tests/sound.test.js
import test from 'node:test';
import assert from 'node:assert/strict';
import { initSound } from '../js/sound.js';

test('blip exists and never throws without WebAudio', () => {
  const s = initSound();
  assert.equal(typeof s.blip, 'function');
  assert.doesNotThrow(() => s.blip(440, 0.03, 0.03));
  assert.doesNotThrow(() => s.blip(NaN, -1, 99, 'nope'));
});

test('blip is silent while sound is off and key/enter behaviour is unchanged', () => {
  const s = initSound();
  s.setEnabled(false);
  assert.equal(s.isEnabled(), false);
  assert.doesNotThrow(() => { s.key(); s.enter(); s.blip(300, 0.02, 0.02); });
  assert.equal(typeof s.key, 'function');
  assert.equal(typeof s.enter, 'function');
  assert.equal(typeof s.setEnabled, 'function');
});
```

- [ ] **Step 2: 运行测试确认失败**

Run: `node --test tests/games-registration.test.js tests/sound.test.js`
Expected: FAIL —— `registry.arcade` 为 `undefined`；`s.blip is not a function`

- [ ] **Step 3a: 扩展 `js/sound.js`（只新增）**

在 `return { ... }` 对象里加一个方法（其余不动）：

```js
    // 通用音效入口（Arcade 使用）。安全失败：任何异常都不得影响调用方。
    blip(freq = 440, dur = 0.03, gain = 0.03, type = 'square') {
      try {
        if (!Number.isFinite(freq) || !Number.isFinite(dur) || !Number.isFinite(gain)) return;
        blip(Math.max(20, Math.min(12000, freq)), Math.max(0.005, Math.min(1, dur)), Math.max(0.0001, Math.min(0.3, gain)), type);
      } catch { /* ignore */ }
    },
```

**Step 3b: 注册命令（`js/commands.js`）**

在 `registry` 对象末尾（`sudo` 之后）加：

```js
  arcade: {
    category: 'Fun',
    summary: 'Launch terminal arcade games',
    help: `arcade - launch terminal arcade games

Usage:
    arcade                 list games
    arcade <game>          launch a game in its own terminal session
    arcade --list          list games
    arcade --help          show this help
    arcade --reset         reset arcade data (scores, mute)

Example:
    arcade pong`,
    run: (shell, args) => runArcade(shell, args),
  },
```

并在文件顶部 import 区加：

```js
import { runArcade } from './games/arcade.js';
```

**Step 3c: 装配（`js/main.js`）**

在 import 区加：

```js
import { createSession } from './games/session.js';
import { createHost } from './games/host.js';
```

在 `sound = initSound(); shell.sound = sound;` 之后加：

```js
// ---- terminal arcade: 宿主能力注入（arcade.js 不碰 DOM，由这里装配）----
shell.ui = {
  sfx: {
    paddle: () => sound.blip(440, 0.03, 0.03),
    wall: () => sound.blip(300, 0.02, 0.022),
    score: () => sound.blip(180, 0.08, 0.03),
    over: () => sound.blip(120, 0.18, 0.035, 'triangle'),
  },
  openGameSession({ game, store, sfx, title }) {
    const host = createHost({
      mount: document.body,
      railWidth: DESKTOP_RAIL_WIDTH,
      focusInput: inputEl,
    });
    return createSession({ game, host, sfx, store, title });
  },
};
```

- [ ] **Step 4: 运行测试确认通过**

Run: `node --test tests/*.test.js`
Expected: PASS（97 原有 + 新增全部通过；`# fail 0`）

- [ ] **Step 5: 提交**

```bash
git add js/commands.js js/main.js js/sound.js tests/games-registration.test.js tests/sound.test.js
git commit -m "feat(arcade): register arcade command, wire host, extend sound with blip"
```

---

## Task 10: host.js — DOM 宿主（窗口 / 焦点 / 循环 / resize / 触摸）

**Files:**
- Create: `js/games/host.js`

（本任务不碰 CSS：窗口 / 屏幕 / 触摸样式全部在 Task 11）

**Interfaces:**
- Produces: `createHost({ mount, railWidth, focusInput }) → host`，实现完整契约（含 `onKeyDown/onKeyUp/onFocus`）

- [ ] **Step 1: 先补一条契约测试（不触 DOM 的守卫）**

```js
// tests/games-host.test.js
import test from 'node:test';
import assert from 'node:assert/strict';
import { createHost } from '../js/games/host.js';

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
```

- [ ] **Step 2: 运行测试确认失败**

Run: `node --test tests/games-host.test.js`
Expected: FAIL —— `Cannot find module '../js/games/host.js'`

- [ ] **Step 3: 实现**

```js
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

export function createHost({ mount = null, railWidth = 0, focusInput = null } = {}) {
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
      measurer = document.createElement('span');
      measurer.style.cssText = 'position:absolute;visibility:hidden;white-space:pre;font:inherit';
      measurer.textContent = '0'.repeat(100);
      screen.appendChild(measurer);
    }
    const r = measurer.getBoundingClientRect();
    cells.cellW = r.width > 0 ? r.width / 100 : 8;
    const cs = getComputedStyle(screen);
    const lh = parseFloat(cs.lineHeight);
    cells.lineH = Number.isFinite(lh) && lh > 0 ? lh : 16;
    const box = screen.getBoundingClientRect();
    cells.cols = Math.floor(box.width / cells.cellW);
    cells.rows = Math.floor(box.height / cells.lineH);
  }

  function currentDims() {
    measure();
    return { cols: cells.cols, rows: cells.rows };
  }

  function mount(opts = {}) {
    if (!mount || typeof document === 'undefined') return { root: null, screen: null, touch: null };

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
    mount.appendChild(root);

    win = enableWindow(root, {
      handle: header,
      storageKey: GAME_STORAGE_KEY,
      minW: GAME_MIN_W,
      minH: GAME_MIN_H,
      minLeft: railWidth,
      breakpoint: GAME_BREAKPOINT,
      onStateChange: (s) => { if (s.closed && typeof opts.onClose === 'function') opts.onClose(); },
    });

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
```

- [ ] **Step 4: 运行测试确认通过**

Run: `node --test tests/games-host.test.js`
Expected: PASS（2 个测试）

- [ ] **Step 5: 回归 + 提交**

Run: `node --test tests/*.test.js` → Expected: `# fail 0`

```bash
git add js/games/host.js tests/games-host.test.js
git commit -m "feat(arcade): add DOM host for the game terminal window"
```

---

## Task 11: CSS — 游戏窗口 / 屏幕 / 触摸

**Files:**
- Modify: `css/style.css`

- [ ] **Step 1: 追加样式（放在 `.terminal-window.maximized` 规则之后）**

```css
/* ---- terminal arcade: game session window ---- */
.game-window {
  z-index: calc(var(--z-window) + 10);
  min-width: 320px;
}
.game-screen {
  flex: 1 1 auto;
  margin: 0;
  padding: 8px 10px;
  overflow: auto;
  font-family: inherit;
  font-size: inherit;
  line-height: 1.2;
  color: var(--text);
  background: var(--bg);
  white-space: pre;
  tab-size: 1;
  outline: none;
}
.game-row { white-space: pre; }
.game-footer {
  flex: 0 0 auto;
  padding: 6px 10px;
  border-top: 1px solid var(--border);
  background: var(--bg-elevated);
  color: var(--text-muted);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
.game-touch { display: none; }
.game-touch[hidden] { display: none; }

/* ≤640px：窗口规则已由 .terminal-window 通配成全屏；这里只打开触摸控制 */
@media (max-width: 640px) {
  .game-touch {
    display: flex;
    gap: 10px;
    padding: 8px 12px;
    padding-bottom: calc(8px + env(safe-area-inset-bottom, 0px));
    border-top: 1px solid var(--border);
    background: var(--bg-elevated);
  }
  .game-touch-btn {
    flex: 1 1 0;
    min-height: 48px;
    font: inherit;
    font-size: 18px;
    color: var(--text);
    background: var(--input);
    border: 1px solid var(--border);
    border-radius: 8px;
    touch-action: none;
    user-select: none;
    -webkit-user-select: none;
    -webkit-tap-highlight-color: transparent;
  }
  .game-touch-btn:active,
  .game-touch[data-active] .game-touch-btn[data-active] { color: var(--dir); }
  .game-footer { font-size: 12px; }
}
```

- [ ] **Step 2: 检查 CSS 未破坏既有测试**

Run: `node --test tests/*.test.js`
Expected: `# fail 0`（`fonts.test.js` 会解析 `css/theme.css`，本任务不动它）

- [ ] **Step 3: 提交**

```bash
git add css/style.css
git commit -m "feat(arcade): style the game window, screen and touch controls"
```

---

## Task 12: 集成验收 + 部署

**Files:**
- Modify: 无代码改动（发现问题则回到对应任务修）
- Verify: 线上 release + 手工清单

- [ ] **Step 1: 全量测试**

Run: `node --test tests/*.test.js`
Expected: `# tests 196`、`# fail 0`（既有 97 + 新增 99）

- [ ] **Step 2: 本地静态检查**

Run: `for f in js/*.js js/games/*.js; do node --check "$f" || echo "FAIL $f"; done`
Expected: 无输出

- [ ] **Step 3: 语法/相对路径自检**

Run: `grep -rn "from '\.\./" js/games/`
Expected: 只出现 `../windowing.js`（host.js）——其余都是 `./`（目录层级正确）

- [ ] **Step 4: 部署到 preview release 并逐项手工验收（Spec §15 清单）**

```bash
NEW=/opt/1panel/www/sites/yuan27.top/releases/$(date +%Y-%m-%d)-arcade
cp -a "$(readlink -f /opt/1panel/www/sites/yuan27.top/current)/." "$NEW/"
cp -a js/games "$NEW/js/games"
cp -a js/commands.js js/main.js js/sound.js "$NEW/js/"
cp -a css/style.css "$NEW/css/"
docker exec 1Panel-openresty-S88A openresty -t && docker exec 1Panel-openresty-S88A openresty -s reload
```

在浏览器打开 `https://yuan27.top/preview/`（Basic Auth `yuan` / `preview2026`）逐项验收，重点是 DevTools 手工断言：

```js
// 会话结束后在 Console 依次确认：
document.querySelectorAll('.game-window').length        // → 0
document.querySelectorAll('.game-screen').length        // → 0
// RAF 与监听器：Performance 面板确认无残留帧回调；Event Listeners 面板确认 window/document 上无游戏 keydown
// 主终端历史：输出区仍保留 "❯ arcade pong"，输入框可正常输入
```

- [ ] **Step 5: 通过后切换正式站（沿用既有流程：相对软链 + 切回 preview 锚点）**

```bash
cd /opt/1panel/www/sites/yuan27.top
ln -sfn releases/$(date +%Y-%m-%d)-arcade current     # 必须相对链接！
docker exec 1Panel-openresty-S88A openresty -s reload
readlink current
curl -s -o /dev/null -w '%{http_code}\n' --resolve yuan27.top:443:127.0.0.1 https://yuan27.top/
```

- [ ] **Step 6: 推送仓库**

```bash
git add -A && git commit -m "feat(arcade): pong in an isolated terminal session" && git push
```

---

## Self-Review（写完计划后按 Spec 逐节核对）

| Spec 节 | 对应任务 | 状态 |
|---|---|---|
| §3 架构 / 注入缝 | Task 7（session+假 host）、Task 8（shell.ui） | ✅ |
| §4 生命周期 / 幂等 destroy / activeSession | Task 7 | ✅ |
| §4.5 窗口 / 红灯退出 / 不入 taskbar | Task 10（`onClose` → `end('window-closed')`） | ✅ |
| §5 输入 / 焦点归属 / ESC 消费 / Tab 陷阱 / 防粘键 | Task 6 + Task 7（`onKeyDown`）+ Task 10（`onFocusOut`） | ✅ |
| §6 渲染 / 归一化 / 静态动态分层 / diff / resize | Task 2（归一化）+ Task 4（renderer）+ Task 5（pong.render） | ✅ |
| §6.3 字符白名单 | Task 4（`CHAR_RANGES` + 测试） | ✅ |
| §7 模型 / 子步长 / 碰撞 / 得分 / 发球 | Task 2 | ✅ |
| §7.5 AI | Task 3 | ✅ |
| §8 移动端触摸 / 不弹键盘 | Task 10（`bindTouch` / `restoreFocus`）+ Task 11（CSS） | ✅ |
| §9 主题（只用既有变量） | Task 11（全部用 `var(--*)`，无新变量） | ✅ |
| §10 音效（只新增 blip / 局部静音） | Task 9（blip）+ Task 7（`muted` 门控） | ✅ |
| §11 持久化 / `--reset` 只删一个 key | Task 1 + Task 8 | ✅ |
| §12 错误处理 | Task 7（update 抛错 → end + onError）＋ Task 8（start 失败 → shell.error）＋ Task 1（storage 容错） | ✅ |
| §13 测试 | Task 1–10 每任务自带测试文件 | ✅ |
| §14 未来扩展 | Task 8 的 `GAMES` 注册表 + 统一游戏接口 | ✅ |
| §15 验收清单 | Task 12 | ✅ |

**类型/命名一致性**：`createGame`/`update`/`render`/`handleKey`/`statusLine`/`isOver`/`restart` 在各任务中签名一致；`host` 契约在 Task 7 使用、Task 10 实现、Task 10 测试校验；`sfx` 键名（`paddle/wall/score/over`）在 Task 7 与 Task 9 一致。

**已知偏差**：`host.js` 比上游推荐的 6 文件拆分多出一个文件，理由已写入 Spec §16.2（无 jsdom，纯逻辑与 DOM 必须分离）。

---

## 验证记录（计划写完后实测，2026-09-19）

把本计划的 Task 1–8 代码块**抽取到 `/tmp/plan-verify/` 真实执行**（不碰仓库、不碰线上）：

```
Task 1-8 抽取结果：js/games/{storage,pong,renderer,input,session,arcade}.js + 8 个测试文件
node --test tests/*.test.js  →  # tests 92   # pass 92   # fail 0
```

首轮执行败 8 个，均为计划真缺陷，已修：

| 失败用例 | 根因 | 修法 |
|---|---|---|
| `arcade --help prints usage` | `helpLines()` 里没有字面量 `arcade pong` | 补 `Example:` 行 |
| `whitelist is exactly…` | 反例 `╔`(U+2554) **落在** U+2500–257F 区间内，本应合法 | 反例改为 U+24FF/U+2590/U+2580/U+2584 |
| `layoutFor keeps the playfield…` | 期望值写错（fieldBottom 20/fieldRows 17） | 改为 22 / 19，并把底栏交给 DOM 元素（.game-footer），网格不再预留底栏行 |
| `buildFrame draws a dashed center line…` | 断言写错（拿比分行当分隔线） | 改为断言比分行中心为空 + 首行/末行均虚线 |
| `start mounts, focuses…` | session 未显式 `host.focus()`，假 host 的 `log.focus` 恒 0 | session.start() 里加 `host.focus()`（单一所有者），host.mount() 不再自己 focus |
| `a second session cannot start…` | `setup()` 每次都 `resetActive()`，把第一个会话的注册抹掉了 | `setup({ fresh: false })` 保留注册 |
| `escape ends the session…` | 测试的事件桩缺 `stopPropagation`，而 session 会调它 | 加 `keyEvent()` 事件桩，并断言 `stopped === true` |
| `a throwing update cancels its frame…` | 假 host 的 `cancelRAF` 只计数、不从队列移除，`pendingFrames()` 永远非 0 | `raf()` 存 `{h,cb}`，`cancelRAF` 按句柄 splice |

额外验证（同样实测）：

```
Task 10 host.js 惰性宿主路径  → 2/2 通过（无 DOM 环境下不抛）
Task 9 sound.blip 补丁打在真实 js/sound.js 上 → 2/2 通过
```

新增测试总数：**92（Task 1–8）+ 2（host）+ 2（sound）+ 3（registration）= 99** ⇒ 全线应为 97 + 99 = **196**。

> ⚠️ 该验证只覆盖 **纯逻辑与无 DOM 路径**。Task 10 的窗口/焦点/ResizeObserver/触摸，以及 Task 11 的 CSS、Task 12 的浏览器验收，**必须**在浏览器里手工验收（无 jsdom）。

---

之后进入 Phase 5（TDD，按 Task 1→12 顺序执行），每完成一个 Task 停下汇报。**等待你确认本计划后再开始写代码。**

---

## Phase 5 执行记录（2026-09-19，TDD 实现）

按 Task 1→11 顺序落地，每个 Task 先写测试、跑出不通过、再实现、再转绿、单独提交。

```
js/games/  1154 行（storage 88 / pong 273 / renderer 108 / input 66 / session 215 / host 267 / arcade 110）
tests/     1643 行（12 个新测试文件）
最终：node --test tests/*.test.js → # tests 208  # pass 208  # fail 0
（既有 97 + 新增 111：纯逻辑 92 + host 结构 6 + 集成 4 + 注册 3 + sound 2 + 适配器 4）
```

### 执行中被真实测试抓出的 3 个缺陷（都是单测盲区）

| # | 缺陷 | 根因 | 抓到它的东西 |
|---|---|---|---|
| B9 | `createHost({ mount })` 的挂载点参数被同名的 `function mount()` **声明提升覆盖** ⇒ `host.mount()` 必定 TypeError | 参数与函数同名；inert-host 测试只走 `mount = null` 分支，恰好绕过 | 端到端烟测 |
| B10 | 量字宽的隐藏 span 被挂进 `screen`，而 `paint()` 首次重建会 `textContent=''` 把它清掉 ⇒ `cellW` 退化为 8px、列数算错 | 测量节点挂在了会被重建的容器里 | 端到端烟测 |
| B11 | `pong.createGame()` 返回**纯状态对象**，而 session 需要**带方法的游戏对象** ⇒ `game.render is not a function` | 两个单元测试各自用桩，接缝无人跑 | 端到端烟测 |

修法：参数改名 `container`；测量节点挂到窗口根节点并显式拷贝 font、`line-height` 兼容倍数型；拆成 `createState`（纯）/`createGame`（适配器）。

### B12 我的验证工具也曾说谎（记录在案）

第一版 DOM 桩没模拟两件真实语义：`textContent=''` 会清空子节点、`append(fragment)` 是把**子节点**搬进父节点。于是：

- 烟测误报「只渲染了 2 行」；
- 更糟的是，据此写的 host 单测是**假阳性**（两次 paint 恰好凑出 `childNodes.length === 2`，行文本落在 fragment 桩上）。

修正桩的保真度后，单测与烟测才真正在测行。**结论：桩的保真度本身要被怀疑。**

### 新增的第 12 个测试文件

`tests/games-integration.test.js`（4 条）：全链路 mount → 菜单 → 对局 → ESC 清理；每帧字符白名单；连续 3 次会话零残留；visibility 暂停清键。
计划原本写「host 的 DOM 部分不写单测」，**这是被证据推翻的偏差**：轻量 DOM 桩抓住了 3 个真 bug，值得长期守着。交互细节仍必须在浏览器里手工验收。

### 仍未验证（必须浏览器手工过）

Task 10 的真实布局/拖拽/缩放/最大化、焦点陷阱与 Tab、`ResizeObserver`、触摸按钮、`≤640px` 全屏、四主题配色、音效听感、Task 12 的完整验收清单。

### 球字形变更（2026-09-19 部署后，作者要求）

`*` → **`█`**（球）+ 挡板 `█` → **`┃`**，理由：原版 Pong（1972）的球与挡板都是矩形，靠长度区分更贴合原版。

- **零字体改动**：`█`(U+2588) 与 `┃`(U+2503) 都已在现网字体子集内，宽度均 600/1000 = 0.6em。
- 同步改动：`renderer.js` 的 `glyphs`、4 处测试断言（受影响的 `games-pong-render` / `games-integration`）。
- 顺带验证过但**未采用**的候选：`●`(U+25CF) / `○`(U+25CB) / `◉`(U+25C9) —— 需重建字体子集（已实测可行：官方 v2.304 源字体 + `pyftsubset`，+3 码点、132 个旧字形轮廓零变化、体积 +284B），留作备选。

### 上线后事故：红灯关闭 → 再也启动不了（B13）

作者在 preview 实测报 `arcade: failed to start session (Cannot read properties of null (reading 'addEventListener'))`。

**根因**：`host.js` 为游戏窗口复用了 `enableWindow` 的 `storageKey` 持久化，而它会**连同 `closed`/`min` 一起存**。
红灯是设计好的「退出游戏」方式 ⇒ 写入 `closed:true`；下一次 `arcade pong` 时 `enableWindow → restoreFromState()`
**同步**执行 `close()` → `onStateChange → onClose → end() → destroy() → teardown()`（`root = null`），
而 `mount()` 还在继续跑 → `root.addEventListener` 撞上 `null`。

**修复**（`6995216`）：`sanitizeStoredWindowState()` 只继承几何、永远丢掉 `closed`/`min`；`mount()` 在 `enableWindow` 之后
加 `if (!root || !screen) return` 干净退出；新增 4 条回归测试（含"预置 closed 状态仍能启动"的端到端用例）。

**教训**：① 复用别人的持久化前要问清"它存了什么"（几何 vs 生命周期状态）；② `onStateChange` 这类回调可能在初始化**中途**同步触发销毁，mount 必须可重入安全；③ 单测盲区只有端到端链路能暴露。

### 上线后修整：默认窗口尺寸（B14）

作者反馈"pong 窗口默认大小不对"。实测旧默认 760×520 ⇒ 屏幕盒 738×430 ⇒ **网格仅 87×25、场地 20 行、挡板 4 格**，在大屏上明显偏小偏扁。
修法：`defaultGameGeom()` 以 `GRID_MAX`（120×40）反推窗口尺寸并夹到视口内。附带修掉一个真 bug：**内联几何会覆盖 `≤640px` 的全屏媒体查询** ⇒ 之前移动端游戏窗口根本没全屏。key 升到 `yuan27.arcade.window.v2`（不沿用旧几何）。新增 6 条几何测试。

### 赛制：三局两胜（作者要求补上局数）

原实现是"单局先到 11 分即结束"，**没有局数概念**。现改为 **`BEST_OF = 3`（三局两胜，先赢 2 局）**，每局仍先到 11 分。

- 新增 `phase: 'intermission'`（局间）：显示 `END OF GAME n` / 局胜者 / `GAMES x - y  BEST OF 3` / `[Space] Next Game`。
- `gameover` 改为**整场结束**：`MATCH OVER` / `PLAYER WINS 2 - 1` / `LAST GAME 11 - 07` / `[Space] New Match`（开新比赛，局分清零）。
- 比分行两侧常驻局分进度 `x/2`；菜单写明 `BEST OF 3 - FIRST TO 11`；`arcade --help` 与 registry help 同步。
- 新局发球朝上一局的失分方；`nextGame()` 与 `restart()` 语义分离（下一局 vs 新比赛）。
- 顺带把**战绩真正落库**：此前 `yuan27.arcade.v1` 的 `gamesPlayed/playerWins/aiWins/bestScore` 从未被写过，现在在比赛结束事件里由 session 写入一次（写失败静默）。
- 测试 +14（`pong` 25 / `pong-render` 19 / `session` 19），全量 **232/232**。

### 赛制定稿：单局定胜负（作者最终要求）

先按要求做成三局两胜，随后作者改回**单局先到 11 分**。实现方式不是删代码，而是**常量驱动**：

- `C.BEST_OF = 1` ⇒ `winsNeeded() = ceil(BEST_OF/2) = 1` ⇒ 首局即比赛；`intermission` 分支不可达（保留）。
- 所有多局相关 UI（比分行 `x/1`、菜单 `BEST OF`、`MATCH OVER`、`New Match`）**按 `BEST_OF > 1` 条件化**，单局制下完全不出现。
- 帮助文案改为 `PONG_FORMAT`（arcade.js，从 `BEST_OF`/`WIN_SCORE` 推导），避免改常量后文档漂移。
- 多局路径用 `withBestOf(3, fn)` 测试辅助保留覆盖：三局两胜的局间、发球方向、赛点结束、新比赛全部仍被测到。
