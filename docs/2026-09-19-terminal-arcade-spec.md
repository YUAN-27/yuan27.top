# Terminal Arcade / Pong — 技术 Spec

- **状态**：Phase 3 产出，**待人工审阅**
- **日期**：2026-09-19
- **上游文档**：`docs/2026-09-19-terminal-arcade-task.md`（决策）、`docs/2026-09-19-terminal-arcade-requirements.md`（实现要求）
- **架构方案**：**A — 独立 Game Terminal Session**（Phase 2 已确认，本 Spec 不再讨论 B/C）
- **第一版范围**：只做 Pong

---

## 0. 范围与非目标

### In scope（第一版）

`arcade` 命令 → 独立 Terminal 风格游戏窗口 → Pong → 键盘 + 触摸 → 简单 AI → 计分 → ESC/红灯退出 → 音效 → 主题适配 → 暂停/visibility → 完整 destroy → 测试。

### Out of scope（明确不做，留给未来）

Snake / Tetris / 排行榜 / 账号 / 在线对战 / 复杂 AI / 成就 / 积分 / 游戏商店 / 复杂设置面板 / 复杂动画 / Canvas / WebGL / 第三方游戏引擎 / 扫描线 / 噪点 / 粒子 / 霓虹 / glitch。

---

## 1. Product Goal

用户在主终端输入 `arcade pong`，等价于在 Unix 里运行一个**前台程序**：

```
$ arcade pong        ← 保留在主终端历史中，不清屏
   ↓（Shell 被前台程序占住，drain() 的 await 自然阻塞）
┌──────── Game Terminal ────────┐
│ yuan27.top :: arcade :: pong  │
│           07      05          │
│  █        O          █        │
└───────────────────────────────┘
   ↓ ESC（或红灯、或比赛结束）
$ _                  ← 焦点回到主终端输入行，历史仍在
```

**核心不变量**：主终端的 DOM 内容、滚动历史、`cwd`、输入框值、键盘 handler、焦点**在游戏前后完全一致**（唯一变化是历史里多了一行 `arcade pong`）。

---

## 2. User Flow

### 2.1 命令面

| 输入 | 行为 |
|---|---|
| `arcade` | 列出可用游戏（ASCII 表格 + `Type: arcade pong`） |
| `arcade pong` | 打开游戏会话 |
| `arcade --list` | 同 `arcade` |
| `arcade --help` | 用法说明（走 registry 的 `help`） |
| `arcade --reset` | 只删 `yuan27.arcade.v1`，回报已重置 |
| `arcade <unknown>` | `arcade: unknown game '<x>'` + 可用列表（沿用 shell 错误风格） |
| 会话进行中输入 `arcade` | 不启动第二个实例，报 `arcade: a session is already running` |

### 2.2 会话内流程

```
选择模式（仅首次进入）
  [1] Single Player   [2] Two Players   [Q] Quit
        ↓
比赛（先到 11 分）
        ↓
结束画面：胜者 + 最终比分 + 累计战绩 + [Space] 再来一局 / [ESC] 退出
```

- 单人模式：左侧为玩家（`W`/`S`），右侧为 AI。
- 双人模式：左侧 `W`/`S`，右侧 `↑`/`↓`（ArrowUp/ArrowDown）。
- 比赛中按 `M` 切换**游戏内静音**；`Space` 发球/继续；`ESC`/`Q` 退出。

### 2.3 退出路径（都必须走同一条 destroy 通道）

`ESC` · `Q` · 窗口红灯（close）· 结束画面选退出 · 初始化失败兜底。

---

## 3. Architecture

### 3.1 模块与依赖

```
commands.js  registry.arcade  ────────────► js/games/arcade.js   （命令入口：参数/守卫/错误）
                                                    │
                                                    ▼
                                             js/games/session.js （生命周期状态机 + 装配）
                                              │    │    │    │    │
                        ┌─────────────────────┘    │    │    │    └──────────────┐
                        ▼                          ▼    ▼    ▼                  ▼
                js/games/host.js          input.js pong.js renderer.js     storage.js
                （唯一大量碰 DOM）          （纯）  （纯）   （纯）            （纯）
```

### 3.2 文件职责

| 文件 | 职责 | 是否碰 DOM |
|---|---|---|
| `js/games/arcade.js` | 参数解析、`activeSession` 守卫、游戏注册表、错误上报到 shell | 否 |
| `js/games/session.js` | 状态机（created/running/paused/ended/destroyed）、幂等 `destroy()`、`exited` Promise、装配 host+model+view+input | 否（通过注入的 host） |
| `js/games/host.js` | 建游戏窗口 DOM（复用 `.terminal-window` 结构）、`enableWindow`、焦点、rAF、ResizeObserver/resize、触摸按钮、把 model 的输出写进 DOM | **是（唯一）** |
| `js/games/input.js` | 按键 → 动作映射；pressed 集合；`applyKey`/`clear`；ESC 消费标记 | 否（纯状态机） |
| `js/games/renderer.js` | 网格工具（`blankGrid`/`blit`/`box`）、`layoutFor()`、静态框架 `buildFrame()`、`gridToString()`、`diffRows()`、`CHAR_WHITELIST` | 否（纯） |
| `js/games/pong.js` | 模型：`createPong()` / `update(state, dt, input)` / 碰撞 / 得分 / AI / `reset` / `render(state, frame)` | 否（纯） |
| `js/games/storage.js` | 版本化 `load/save/reset`，损坏容错（注入 storage 对象） | 否（纯） |

> 说明：相对上游文档的推荐拆分为 6 个文件，这里拆成 7 个 —— 唯一原因是**把纯逻辑与 DOM 彻底分离**（测试环境无 jsdom，见 §13）。`host.js` 是唯一允许出现 `document` 的文件。

### 3.3 注入缝（测试与解耦）

`session.js` 接受一个 `host` 对象，接口固定：

```js
host = {
  mount(ui)            // 建窗口 DOM + enableWindow，返回 { root, screen, touchEl, closeBtn }
  onResize(cb)         // 返回取消函数
  onVisibility(cb)     // 返回取消函数
  now()                // 时间源（默认 performance.now）
  raf(cb) / cancelRAF(handle)
  focus() / restoreFocus()
  paint(rows, changed) // 把行数组写进 DOM
  setTouchVisible(bool)
  teardown()           // 移除 DOM、监听器、样式
}
```

`session.js` 只依赖这个接口 ⇒ 测试可注入**假 host**，在没有 DOM 的环境下完整测生命周期（§13）。

### 3.4 对既有代码的修改边界

| 文件 | 改动 |
|---|---|
| `js/commands.js` | +1 个 registry 条目（`arcade`，`category: 'Fun'`） |
| `js/main.js` | 装配：把 `openGameSession` 注入 `shell.ui`；其余**一行不动**（尤其 `drain()`） |
| `js/sound.js` | **只新增**通用 `blip(freq, dur, gain, type)`；现有 `key()/enter()` 行为不变 |
| `css/style.css` | 新增 `.game-window` / `.game-screen` / `.game-touch` 段 |
| `js/games/**` | 全新 |

**不改**：`keys.js`、`terminal.js`、`windowing.js`、`taskbar.js`、`background.js`、`themes.js`、`index.html`、`fs.js`、`parser.js`、`content.js`。

---

## 4. Session Lifecycle

### 4.1 状态机

```
created ──start()──► running ◄──resume()──┐
                       │  │               │
               pause() │  │ end(reason)   │
                       ▼  │               │
                    paused┘───────────────┘
                       │
                    end(reason)
                       ▼
                     ended ──destroy()──► destroyed（终态）
```

- `end(reason)` 之后**自动**紧接着 `destroy()`（调用方不需要两步）。
- `resume()` 仅在 `paused` 且未 `ended/destroyed` 时有效，否则是 no-op。

### 4.2 `destroy()` 幂等契约

```text
destroy(); destroy(); destroy();
```

- 第 1 次：执行清理，`state = 'destroyed'`，resolve `exited`。
- 第 2、3 次：**立刻返回**，不重复任何副作用、不抛错。
- 清理清单（必须全部为 0/空）：

```text
cancelAnimationFrame 已调用，raf handle = null
host.teardown() 已执行：窗口 DOM 从 document 移除
keydown / keyup / blur / focusin / visibilitychange / resize / touch* 监听器全部移除
host.onResize/onVisibility 的取消函数已调用
pressed 集合已清空
activeSession = null
焦点已交还主终端输入行（≥640px 才 focus，移动端不 focus，避免弹出软键盘）
```

### 4.3 `activeSession` 守卫

模块级唯一变量。

- 启动前：若 `activeSession !== null` → 拒绝，不建任何 DOM。
- 清理时：只在 `activeSession === self` 时置 `null`（防止旧会话复位掉新会话）。

### 4.4 前台程序语义

`arcade` 命令 handler：

```js
async run(shell, args) {
  ...
  const session = createSession({...});
  activeSession = session;
  await session.exited;        // ← 阻塞 shell 队列（drain() 的 await 自然生效）
  return;
}
```

不允许改动 `drain()`；不允许 fire-and-forget（否则提示符立刻回来，违背前台程序语义）。

### 4.5 与窗口系统的关系

- 复用 `enableWindow(gameEl, { handle: header, storageKey: 'yuan27.arcade.window.v1', minW: 420, minH: 260, minLeft: DESKTOP_RAIL_WIDTH, breakpoint: 640, onStateChange })`。
- **红色关闭按钮 = 退出游戏**：`onStateChange` 检测到 `closed === true` → `session.end('window-closed')`。
- **不注册进 taskbar**（`taskbar.js` 的单窗口假设不迁就）。
- 默认几何：`min(760px, 72vw) × min(520px, 64dvh)`，居中；`z-index: calc(var(--z-window) + 10)`（主窗口之上、菜单之下）。`≤640px` 时由既有 CSS 通配规则自动全屏。

---

## 5. Input Lifecycle

### 5.1 按键表

| 键 | 会话内含义 | 是否 `preventDefault()` |
|---|---|---|
| `W` / `w` | 左挡板上移 | 是 |
| `S` / `s` | 左挡板下移 | 是 |
| `ArrowUp` | 右挡板（双人）/ 无（单人） | 是 |
| `ArrowDown` | 右挡板（双人）/ 无（单人） | 是 |
| `Escape` | 退出会话 | 是 + **消费**（见 5.4） |
| `Q` / `q` | 退出会话（比赛中）/ 选择退出（菜单） | 是 |
| `Space` | 发球 / 再来一局 | 是 |
| `M` / `m` | 切换游戏内静音 | 是 |
| `1` / `2` | 模式选择（仅菜单） | 是 |
| `Tab` | **焦点陷阱**：吞掉，不让焦点逃出游戏窗口 | 是 |
| 其它键 | 透传（不拦截） | 否 |

> `↑`/`↓` 两个箭头**不出现在网格画面上**（字体子集只含 U+2192，见 §6.3）；底部提示栏用 ASCII：`[W/S] P1  [Up/Down] P2  [ESC] Quit`。

### 5.2 焦点归属（不做全局抢占）

- 游戏窗口根元素 `tabindex="-1"`，`start()` 时 `.focus()`。
- 监听器绑在**游戏窗口根元素**上（keydown/keyup），**不添加任何 `document`/`window` 级键盘监听**。
- 主终端 `inputEl` 在会话期间只是**失焦**，代码零改动；`keys.js` 不感知游戏存在。
- 会话结束：`inputEl.focus()`（仅 `≥640px`，沿用 `main.js` 启动时避免移动端弹键盘的先例）。
- 焦点守护：`focusout` 且会话活跃且 `state !== 'destroyed'` → 把焦点拉回游戏窗口根（对抗 Tab/点击导致焦点逃逸）。

### 5.3 防粘键

`blur`（窗口级）与 `visibilitychange`（document）：

```text
失去焦点 / 页面隐藏
   ↓
input.clear()          （清空 pressed 集合，杜绝"W 永远按下"）
   ↓
session.pause()        （停止 rAF）
重新获得焦点 / 页面可见
   ↓
session.resume()
```

> `visibilitychange` 与 `blur` 属于**生命周期监听**（允许绑在 document/window 上）；被 §5.2 禁止的是**键盘**的全局监听。二者不可混淆。

### 5.4 ESC 消费契约（高风险按键）

```text
按 ESC
 → 游戏 keydown handler：preventDefault() + stopPropagation() + input.markConsumed('Escape')
 → session.end('esc')
 → destroy 排到当前任务之后（queueMicrotask），避免在事件处理中同步销毁 DOM
 → 主终端 inputEl 在 ESC 结束前不会被聚焦
```

不变量：**退出后主终端输入框的值不被 ESC 清空、不产生额外历史记录、不出现重复退出**。（测试覆盖：模拟 ESC keydown → `input.value` 与 `history.all().length` 不变。）

---

## 6. Rendering

### 6.1 坐标与尺寸（resize 不重置状态的前提）

**物理量全部使用归一化坐标 `[0,1]`**，与网格尺寸无关：

```js
state = {
  ball: { x, y, r },            // r ≈ 0.014（半径，归一化）
  vel:  { x, y },               // 单位: 1/秒
  paddles: [
    { x: 0.030, w: 0.012, y, h: 0.180, vy },   // y = 顶端，归一化
    { x: 0.958, w: 0.012, y, h: 0.180, vy },
  ],
  score: [0, 0],
  phase: 'menu' | 'serve' | 'play' | 'gameover',
  serveDelay, winner, mode, speed
}
```

视图层把归一化坐标映射到当前网格，因此 `resize` 只需重算 layout，**模型状态原封不动**。

### 6.2 布局

```js
layoutFor(cols, rows) → {
  cols, rows,
  fieldTop, fieldBottom,      // 场内上下边界（行号）
  ballCells,                  // 球占几格（固定 1）
  paddleCells,                // 挡板高度格数 = max(2, round(h * fieldRows))
  centerRow, sepRow...
}
```

网格尺寸：`cols = clamp(floor(screenW / cellW), 40, 120)`，`rows = clamp(floor(screenH / lineH), 12, 40)`；`cellW/lineH` 每次 resize 用一次隐藏测量元素取得（**不是每帧测量**）。

归一化坐标 → 行号的映射（唯一公式，避免歧义）：

```text
row = fieldTop + round(y * (fieldRows - 1))      // y ∈ [0,1] 顶端→底端
fieldRows = fieldBottom - fieldTop + 1
ballRow = fieldTop + round(ball.y * (fieldRows - 1))
paddleRow0 = fieldTop + round(paddle.y * (fieldRows - 1))
paddleRows = max(2, round(paddle.h * fieldRows))
```

挡板行号需夹到 `[fieldTop, fieldBottom - paddleRows + 1]`，保证画得下。

静态框架由 `buildFrame({ title, status, footer, cols, rows })` 生成：顶栏（标题 + 比分）、分隔线、场内区、分隔线、底栏（按键提示）。**静态层只在初始化/resize 重建**；游戏只往场内区 `blit` 动态对象。

### 6.3 字符集硬约束（关键发现）

站点字体是**子集化**的，`css/theme.css` 的 `unicode-range` 只覆盖：

```text
ASCII（latin-400/700）
U+2192 (→)
U+2500–257F（制表符 ─ │ ┌ ┐ └ ┘ ├ ┤ ┬ ┴ ┼）
U+2588（█）
U+276F（❯）
```

**任何其它字符都会落到回退字体，advance width 变化 → 整个网格错位。**

因此游戏网格只使用：ASCII + 上表字符。

| 元素 | 字符 | 理由 |
|---|---|---|
| 边框/中线 | `─ │ ┌ ┐ └ ┘ ├ ┤` | U+2500–257F，已覆盖 |
| 挡板 | `┃` | U+2503（制表符区，已覆盖）；竖线跨满行高，3 格堆叠成一条连续的厚挡板 |
| 球 | `█` | U+2588 实心块；原版 Pong（1972）的球本来就是方块，靠**长度**与挡板区分。**不用** `O`（`PONG`/`GAME OVER` 含大写 O）、**不用** `*`（小字号辨识度差） |
| 比分/标题/提示 | ASCII 数字与字母 | — |

§13 会加一条测试：**渲染器输出的所有字符必须落在允许集合内**。

### 6.4 静态 / 动态分层与 diff

```text
静态层（初始化 + resize 才重建）
  边框、分隔线、中线、标题行、底部按键提示

动态层（每帧）
  gridToString → string[]（整帧的"真值"）
      ↓ diffRows(prev, next) → [{ row, text, html }]
      ↓ 只对变化行写 DOM
```

- `gridToString(grid) → string[]`：纯函数，行数组。
- `diffRows(prev, next) → number[]`：返回**变化的行号**（契约：长度不同时按较短者比较，多出的行全部视为变化）。
- 动态行若有配色需求（球用 `--dir`、挡板用 `--text`），该行构造为带 `<span>` 的 HTML；其余行保持纯文本。`diffRows` 比较的是**纯文本内容**（配色不影响 diff 判定）。
- 禁止：每帧重建整块 DOM、每帧 `querySelectorAll`、每帧 `innerHTML` 重建静态层、每帧创建匿名监听器。

### 6.5 Resize 契约

```text
resize
 → 重算 cellW/lineH → layoutFor
 → 重建静态层
 → 用新 layout 渲染下一帧
模型状态（球/速度/挡板/比分/phase）完全保留
```

禁止 `resize → restart`。`ResizeObserver` 优先，降级 `window.resize`；回调做 rAF 合并（避免连续触发刷爆）。

---

## 7. Pong 模型（纯逻辑）

### 7.1 常量（首版）

| 常量 | 值 | 说明 |
|---|---|---|
| `SPEED0` | 0.62 /s | 初始球速 |
| `SPEED_MAX` | 1.55 /s | 速度上限 |
| `SPEEDUP` | ×1.04 | 每次被挡板击回 |
| `PADDLE_H` | 0.180 | 挡板高度（归一化） |
| `PADDLE_SPEED` | 1.5 /s | 挡板移动速度 |
| `MAX_BOUNCE_VY` | 0.75 | 出射角的垂直分量上限（边缘更斜） |
| `WIN_SCORE` | 11 | 先到 11 分获胜 |
| `SERVE_DELAY` | 0.9 s | 得分后中央停顿 |
| `AI_SPEED` | 1.05 /s | AI 挡板最大速度（`normal`） |
| `SUBSTEP_MAX` | 0.004 | 子步长上限（防穿透） |

### 7.2 积分（防穿透的关键）

`update(state, dt, input)` 内部**按固定子步长积分**：

```text
steps = ceil(max(|vx|, |vy|) * dt / SUBSTEP_MAX)
for i in 1..steps: substep(dt / steps)
```

理由：最大速度 1.55/s、帧间隔 1/30s ⇒ 单帧位移 0.052，**远大于挡板厚度 0.012** ⇒ 不分子步必然穿透。子步长 ≤0.004 < 0.012，保证不可穿透。

`dt` 上限夹断（`min(dt, 0.05)`）：页面卡顿或后台返回时不会瞬移。

**两个 dt，职责不同（不得合并）**：

| 用途 | 取值 | 理由 |
|---|---|---|
| 发球倒计时（`serveDelay`） | **真实 dt**（仅夹掉负数/非有限值） | 倒计时是「时钟」，卡顿后必须跟上真实时间；若也用夹断值，一次 0.9s 的更新永远发不出球 |
| 物理（挡板/球/子步） | `clamp(dt, 0, 0.05)` | 防止卡顿后瞬移与穿透；`launch()` 设完速度立即 `return`，所以发球那一帧球不会移动 |

`dt` 为非有限值（`NaN`/`Infinity`/负）时按 `0` 处理，不得污染状态。

### 7.3 碰撞

| 情形 | 处理 |
|---|---|
| 上/下墙 | `y` 夹到 `[r, 1-r]` 并翻转 `vy` 符号；同时**位置修正**（拉回合法范围），杜绝卡墙 |
| 挡板（AABB，归一化空间） | 仅在球**朝挡板方向运动**时判定（`vx<0` 判左，`vx>0` 判右）；命中后把球 x 设为挡板面外侧 `±r`，翻转 `vx`，并按撞击偏移重算 `vy` |
| 出射角 | `t = clamp((ballY - paddleCenterY) / (PADDLE_H/2), -1, 1)`；`vy = t * MAX_BOUNCE_VY + 0.15 * paddleVy/speed`，再按当前速率归一化 `vx`（保证速度大小不变） |
| 加速 | 每次挡板命中：`speed = min(speed * SPEEDUP, SPEED_MAX)`；球的速度永远 `≥ SPEED0`，**碰撞后速度不得为 0** |
| 得分 | `ball.x + r < 0` → 右方得分；`ball.x - r > 1` → 左方得分；随后进入 `serve` 阶段 |
| 发球 | 球回中央，`vx` 方向**朝失分方**，`vy` 随机小角度（`|vy| ≤ 0.3`，避免开局就贴墙） |

### 7.4 阶段与结束

- `menu`：模式选择（`1`/`2`/`Q`），不跑球。
- `serve`：`serveDelay` 倒计时结束 → `play`。
- `play`：正常积分。
- `gameover`：任一方到 `WIN_SCORE` → 定格，记录战绩，显示胜者 + 最终比分 + `[Space] Again  [ESC] Quit`。

### 7.5 AI（首个版本刻意简单）

```text
目标 = 球心 y - PADDLE_H/2（当前帧快照，不做预测、不做完美追踪）
每帧朝目标移动，最大速度 AI_SPEED
死区：|球心 - 挡板中心| < 0.01 时不动（避免抖动）
仅当球朝 AI 方向运动时追击（vx > 0）
```

难度只区分 `easy` / `normal`（`AI_SPEED` 与死区），**首版默认 `normal`**；不引入技能/道具/粒子。

### 7.6 决策注入

`createPong({ rng })` —— 随机数注入（发球角度），保证测试可复现（传固定序列的假 rng）。

---

## 8. Mobile

- `≤640px`：既有 CSS 通配规则（`style.css:388`）让任何 `.terminal-window` 变成 `100vw × 100dvh` 全屏 ⇒ **游戏窗口自动全屏，无需移动端专用窗口实现**。
- 触摸控件（仅存在于游戏会话内部）：
  - 左侧 `▲` / `▼` 大按钮（高度 ≥ 44px，`touch-action: none`，`user-select: none`）。
  - 事件：`pointerdown` / `pointerup` / `pointercancel` / `pointerleave`；**同时保留 `touchstart/touchend/touchcancel` 兜底**，与 pointer 事件去重（同一指针 id 只处理一次）。
  - 按下 = 上升/下降，抬起/取消 = 停止；`touchcancel` 必须停止运动（防粘键）。
  - 不依赖 hover；按钮不遮挡网格（网格可滚动/自适应高度）。
  - 会话销毁时全部监听器移除（走 §4.2 清单）。
- 不弹软键盘：`start()` 不在移动端调用 `inputEl.focus()`；`restoreFocus()` 在 `≤640px` 时跳过。
- 横竖屏切换 = resize → 走 §6.5（不重置状态）。
- 单人在移动端同样可用；双人模式在移动端以"玩家 + AI"降级？**否** —— 双人模式仍可选，但右侧挡板无触摸按钮时给出提示（`mobile: 双人模式建议使用键盘`），不做虚拟双摇杆（§22 边界）。

---

## 9. Theme

- 只用**现有**变量：`--text` `--text-muted` `--dir` `--prompt` `--border` `--bg` `--bg-elevated` `--cursor` `--error` `--success` `--link` `--selection` `--input` `--logo-depth`。
- **不新增** `--terminal-fg` 之类重复变量。
- 映射：边框/中线 `--border`，挡板与球同为 `--text`（**单色**，忠于原版 Pong，靠形状/长度区分），比分 `--text` + 标签 `--text-muted`，底部提示 `--text-muted`，结束/错误 `--error`/`--success`。
- 主题切换是纯 CSS（`data-theme`）⇒ 游戏天然跟随，**JS 不读写颜色**。

---

## 10. Sound

- `sound.js` **只新增**：`blip(freq, duration, gain, type)`；内部 `try/catch` 全包，失败静默；`AudioContext` 保持单例复用（不得每帧创建）。
- 现有 `key()` / `enter()` 行为与签名不变（97/97 必须保持）。
- 音效映射：击挡板 440Hz·0.03s / 撞墙 300Hz·0.02s / 得分 180Hz·0.08s / 结束 120→90Hz。
- 门控顺序：`全局 sound on` **且** `!gameMuted` 才发声。
- 游戏内 `M`：只切 `gameMuted`（存 `yuan27.arcade.v1`），**不触碰** `yuan27.sound.v1`、不调用 `setEnabled()`。
- **音频失败 ≠ 游戏失败**：任何 sound 调用都不得抛出异常影响会话。

---

## 11. Persistence

Key：`yuan27.arcade.v1`（不污染 `yuan27.window.v2` / `yuan27.sound.v1` / `yuan27.theme.v1`）。

```json
{
  "version": 1,
  "pong": {
    "gamesPlayed": 0,
    "playerWins": 0,
    "aiWins": 0,
    "bestScore": { "left": 0, "right": 0 },
    "muted": false,
    "mode": "normal"
  }
}
```

> Pong 没有传统"最高分"，`bestScore` 记录最大分差局的比分（用于结束画面展示）；不引入排行榜。

规则：
- `version` 不匹配 / 缺失 → **丢弃并重建默认值**（不抛错）。
- `JSON.parse` 失败 / 读到非对象 / 字段类型不对 → 返回默认值（整个网站启动不受影响）。
- `localStorage` 不可用（隐私模式）→ 全部操作静默降级为内存态。
- `arcade --reset` **只** `removeItem('yuan27.arcade.v1')`，其他站点数据一律不动。

---

## 12. Error Handling

| 场景 | 行为 |
|---|---|
| 会话初始化抛错 | 捕获 → 主终端 `arcade: failed to start session`（`--error` 样式）→ 走 §4.2 清理 → 焦点归还 → **页面 JS 不崩** |
| 游戏 update/render 抛错 | 捕获 → 结束会话并输出一行错误 → 清理 → 焦点归还（不允许半死不活的循环） |
| 音频 API 缺失/失败 | 静默（§10） |
| `localStorage` 失败 | 静默降级（§11） |
| 重复启动 | 拒绝 + 提示（§4.3） |
| 重复 ESC / destroy | 幂等（§4.2） |
| 窗口红灯与 ESC 同时 | 幂等 destroy 保证只清理一次 |

---

## 13. Testing

`node --test tests/*.test.js`，**环境无 jsdom、无 devDependencies** ⇒ 只有纯函数 + 注入依赖可测；`host.js` 的 DOM 部分不写单测，靠 §15 手工验收。新增测试文件：

| 测试文件 | 用例数 | 覆盖 |
|---|---|---|
| `tests/games-storage.test.js` | 11 | 正常读写、空、损坏 JSON、版本不符、类型错、写入失败降级、`--reset` 只删一个 key |
| `tests/games-pong.test.js` | 18 | 初始状态、球/挡板移动、上下墙（含位置修正）、挡板碰撞、出射角、加速上限、**高速不穿透**、得分与发球方向、先到 11、restart、dt 夹断、非有限 dt、`serveDelay` 用真实 dt |
| `tests/games-pong-ai.test.js` | 6 | 只在球逼近时追击、死区不抖动、限速、easy<normal、`setDifficulty` 校验、不出界 |
| `tests/games-renderer.test.js` | 12 | 字符白名单（含区间边界）、`blankGrid`/`blit`/`box`、`layoutFor` 边界与钳制、`buildFrame`、虚线中线、`gridToString`、`diffRows` |
| `tests/games-pong-render.test.js` | 14 | 行为/尺寸、比分、球、菜单、结束画面、diff 稳定、静态层不被污染、越界坐标、**适配器 `createGame` 契约** |
| `tests/games-input.test.js` | 7 | 全部按键映射、`preventDefault` 白名单、pressed 集合、自重复安全、`clearInput`、ESC 消费标记 |
| `tests/games-session.test.js` | 17 | 状态机全流程、重复启动拒绝、假 host 下的 pause/resume、ESC 消费与焦点、**幂等 destroy**、resize 不重置、抛错自愈、无残留帧 |
| `tests/games-arcade.test.js` | 11 | 命令面全集、未知游戏、`--reset`、`await exited`、启动失败兜底、**真 session 守卫** |
| `tests/games-host.test.js` | 6 | 契约完整性、惰性宿主不抛、**挂载到容器**、测量节点不进 screen、只重写变化行、`setStatus` |
| `tests/games-integration.test.js` | 4 | **全链路**（mount→菜单→对局→ESC 清理）、每帧字符白名单、连续 3 次会话零残留、暂停清键 |
| `tests/games-registration.test.js` | 3 | registry 归类、`commandNames`/Tab 补全自动收录、`help` 输出 |
| `tests/sound.test.js` | 2 | `blip` 存在且安全失败、关闭时静音且 `key/enter` 行为不变 |

> `games-host` / `games-integration` 用**自建最小 DOM 桩**（无 jsdom、零依赖）。那是被证据推翻的原始判断：
> 计划原本写「host 的 DOM 部分不写单测」，但轻量桩抓住了 3 个真缺陷（见 §16.1）。桩的保真度本身
> （`textContent=''` 清空子节点、`append(fragment)` 搬子节点）也必须被怀疑 —— 第一版桩曾让测试假阳性。

不变量（每个测试都要守）：

```text
原有 97/97 保持通过
命令面 help / summary / Tab 补全 自动包含 arcade（不手工维护列表）
```

---

## 14. Future Games Extension

新增游戏 = **加一个模块 + 一行注册**，不改 `session.js` / `host.js` / `renderer.js`：

```js
// js/games/pong.js 对外接口（约定）
export const meta = { id: 'pong', title: 'PONG', summary: 'Classic Pong' };
export function createGame({ cols, rows, rng, storage, frame }) {
  return {
    state,                          // 纯数据
    update(dt, input) {},           // 只改 state
    handleKey(key) → boolean,       // true = 已消费
    render(frame) → string[],       // 纯：把本游戏的动态对象画进 renderer 给的静态框架
    resize(layout, frame) {},       // 重算布局相关，不重置状态
    statusLine() → string,          // 底栏提示
    isOver() → boolean,
    restart() {},
  };
}
```

静态框架（边框/分隔线/标题/底栏）由 `renderer.buildFrame()` 提供并在 resize 时重建；游戏模块**只负责动态对象**（球、挡板、比分数字、阶段文案），因此新增游戏不会重复实现外框。

`arcade.js` 内 `const GAMES = { pong }`；未来 `snake`/`tetris` 只需实现同一接口。命令面、会话生命周期、渲染管线、持久化、主题、音效**全部复用**。

---

## 15. 验收清单（对应上游 §24）

**Shell**：`arcade` 可启动 · 主终端历史无污染 · `drain()` 未重构 · 退出后焦点恢复
**Window**：可拖 · 可缩放 · 可最大化 · 红灯退出 · 不入 taskbar · 移动端自动全屏
**Input**：`W/S` · `↑/↓` · `ESC` · Space 不滚页 · 方向键不滚页 · Tab 不触发 Shell 补全 · blur 无粘键
**Game**：球运动 · 挡板 · AI · 碰撞 · 得分 · 不卡死
**Lifecycle**：重复启动安全 · 重复 ESC 安全 · destroy 幂等 · visibilitychange 正常 · RAF 取消 · listener 清理
**Mobile**：全屏 · 触摸控制 · 横竖屏 resize 不崩 · 退出后触摸监听清理
**Theme**：四个主题（claude/light/matrix/dracula）正常 · 未新增重复颜色变量
**Sound**：音效正常 · `M` 只影响游戏 · WebAudio 失败不崩
**Regression**：原 97/97 通过 · 新测试全通过 · `help`/`summary`/Tab 补全正常 · 原有命令全正常

> 逐项验证里，**`RAF = 0` / `game listeners = 0` / `game DOM = 0` / `activeSession = null`** 四条通过浏览器 DevTools 手工确认（无 jsdom，无法自动化）。

---

## 16. 已知约束与风险（Phase 3 期间发现）

| # | 发现 | 影响与决策 |
|---|---|---|
| 1 | **字体子集限制**：只有 ASCII + U+2500–257F + U+2588 + U+2192 + U+276F | 球不能用 `●`（U+25CF）、提示不能用 `↑↓`（U+2191/2193）⇒ 球用 `█`（避开与 `PONG`/`GAME OVER` 撞字）、挡板用 `┃`，提示用 `Up/Down`；加字符白名单测试守住 |
| 2 | **测试无 jsdom** | 纯逻辑与 DOM 必须硬分离 ⇒ 7 文件拆分（比上游推荐多 `host.js`），`session.js` 通过注入 host 才可测 |
| 3 | **`enableWindow` 是单元素闭包** | 第二个元素再实例化一次即可，但**必须自带 `storageKey`**，否则与主窗口几何互相覆盖 |
| 4 | **高速穿透** | 单帧位移 0.052 > 挡板厚度 0.012 ⇒ 子步长积分是**必需项**，不是优化项 |
| 5 | **taskbar 单窗口假设** | 游戏窗口不注册进 taskbar；不改 taskbar |
| 6 | **移动端焦点** | `restoreFocus()` 必须跳过 `≤640px`，否则退出游戏会弹出软键盘 |
| 7 | **`sound.js` 是唯一被改的既有模块** | 只新增 `blip()`，现有方法签名与行为不变 |

---

## 16.1 Phase 5 实现期间发现并修复的缺陷

| # | 缺陷 | 根因 | 抓到它的东西 |
|---|---|---|---|
| B9 | `createHost({ mount })` 的挂载点参数被同名 `function mount()` **声明提升覆盖** ⇒ `host.mount()` 必崩 | 参数与函数同名；惰性宿主测试只走 `mount = null` 分支 | 端到端集成测试 |
| B10 | 量字宽的隐藏 span 挂进 `screen`，`paint()` 首次重建 `textContent=''` 把它清掉 ⇒ `cellW` 退化、列数算错 | 测量节点放在了会被重建的容器内 | 端到端集成测试 |
| B11 | `pong.createGame()` 返回纯状态对象，session 需要带方法的游戏对象 ⇒ `game.render is not a function` | 两个单元测试各自用桩，接缝无人跑 | 端到端集成测试 |

修法：参数改名 `container`；测量节点挂到窗口根节点、显式拷贝 font、`line-height` 兼容倍数与 px；拆成 `createState`（纯）/ `createGame`（会话侧适配器，签名见 §14）。

**教训**：桩与桩之间的接缝是盲区 ⇒ 必须有一条真正把全链路串起来的测试；且 DOM 桩的保真度本身要被怀疑。

---

## 17. 实现顺序（Phase 5 用，先列不执行）

```
1. storage.js + 测试
2. pong.js（模型/物理/AI）+ 测试
3. renderer.js（网格/布局/diff/字符白名单）+ 测试
4. input.js（映射/pressed/ESC 消费）+ 测试
5. session.js（状态机/幂等 destroy）+ 假 host 测试
6. arcade.js（命令面/守卫/错误）+ 测试
7. commands.js 注册 + main.js 装配 + sound.js 扩展
8. host.js（DOM/窗口/rAF/resize/触摸）
9. css/style.css 游戏样式
10. 手工验收清单（§15）+ 部署
```

每步完成后 `node --test` 必须全绿（97 + 新增）。
