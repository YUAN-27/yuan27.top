# yuan27.top「Terminal Arcade」终端小游戏系统——架构设计与实施任务

> 决策文档。2026-09-19 由站点作者下达，作为 Terminal Arcade 的唯一需求来源。
> 执行顺序见《二十、实现顺序》：Phase 1 调研 → Phase 2 方案 → Phase 3 Spec → Phase 4 计划 → Phase 5 TDD 实现。

## 一、核心目标

为现有 `yuan27.top` 浏览器虚拟终端增加一个 **Terminal Arcade 终端小游戏系统**。

最重要的产品体验不是“游戏模式覆盖当前 Shell”，而是模拟 Unix 环境中运行一个游戏程序后的独立运行空间：

```text
主终端

$ ls
...
$ arcade pong

→ 创建/打开一个独立的「游戏终端」
→ 游戏在新的终端实例中运行
→ 主终端状态保持不变
→ 游戏退出后，关闭游戏终端
→ 自动回到原来的主终端
```

因此，游戏终端应该在视觉和交互上表现为一个**独立 Terminal Session / Terminal Window**，而不是简单清空当前终端 DOM 后运行游戏。

整个功能仍然属于 `yuan27.top`，不能变成独立项目。

---

## 二、现有项目事实与不可违反的约束

当前站点：

- 浏览器虚拟终端
- 原生 ES Modules
- 零依赖
- 零构建
- 不引入 React / Vue / Canvas 游戏框架等额外体系
- 当前测试：97/97 通过
- 使用 Node `node --test`
- 遵循 TDD
- 新功能必须增加对应测试

当前命令系统：

```js
registry = {
    category,
    summary,
    help,
    async run(shell, args)
}
```

新增游戏应该通过注册表接入，因此：

- `help` 自动发现
- Tab 补全自动发现
- 命令生命周期遵循现有 Shell 体系

当前终端渲染：

```text
echo()
printText()
printLines()
```

终端内容以 DOM 行为基本渲染单位：

- 支持 HTML 行
- 支持主题变量
- 使用等宽字体
- 当前没有 Canvas 游戏渲染系统

当前键盘系统：

```text
keys.js
makeKeyHandler()
```

由现有 Shell 独占键盘。

游戏运行期间必须能够：

```text
主终端键盘
      ↓
暂时转移给游戏终端
      ↓
游戏结束
      ↓
完整恢复主终端键盘
```

不能通过添加全局 `keydown` 监听器的方式粗暴抢占键盘。

---

## 三、核心产品模型：双 Terminal Session

不要把游戏实现成：

```text
Shell
 ↓
清空 Shell
 ↓
Pong
```

而应该抽象成：

```text
TerminalManager
│
├── MainTerminalSession
│      └── Shell
│
└── GameTerminalSession
       └── Arcade Game
```

概念上：

```text
┌──────────────────────────────────────┐
│ Main Terminal                        │
│                                      │
│ $ arcade pong                        │
│                                      │
└──────────────────┬───────────────────┘
                   │ launch
                   ▼
        ┌─────────────────────────┐
        │ Game Terminal           │
        │                         │
        │ ┌─────────────────────┐ │
        │ │                     │ │
        │ │       PONG          │ │
        │ │                     │ │
        │ │       ●             │ │
        │ │                     │ │
        │ │   █             █   │ │
        │ │   █             █   │ │
        │ │                     │ │
        │ └─────────────────────┘ │
        │                         │
        │ Q / ESC  quit           │
        └─────────────────────────┘
                   │
                   │ exit
                   ▼
             Main Terminal
```

这里的“另开一个终端”指**站点内部的新 Terminal UI / Session**。

不要默认打开新的浏览器 Tab 或系统终端窗口。

---

## 四、推荐的视觉表现

游戏终端应该让用户明显感觉到：

> “我刚刚启动了一个新的终端程序。”

而不是：

> “网页突然切换成了一个游戏页面。”

建议使用现有 Terminal 的：

- 等宽字体
- 主题变量
- 背景
- 边框
- 光标
- 文本渲染机制

但游戏终端可以拥有独立的 Terminal Header，例如：

```text
┌────────────────────────────────────────────┐
│ yuan27.top :: arcade :: pong               │
├────────────────────────────────────────────┤
│                                            │
│                  07    05                  │
│                                            │
│        █                         █         │
│        █              ●          █         │
│        █                         █         │
│                                            │
│                                            │
├────────────────────────────────────────────┤
│ [W/S] Player 1    [↑/↓] Player 2   [ESC]  │
└────────────────────────────────────────────┘
```

不要使用过度赛博化的：

- 发光
- 扫描线
- 大量粒子
- 霓虹渐变
- 噪点
- 装饰性动画

整体保持：

**Unix / Terminal / Retro Computer / 极简**

---

## 五、第一款游戏：Pong

第一阶段只实现：

```bash
arcade pong
```

不要一次性开发 Snake、Tetris 等多个游戏。

但架构必须允许未来增加：

```bash
arcade snake
arcade tetris
arcade ...
```

---

## 六、Pong 游戏模式

支持两个模式：

### 1. Single Player

```bash
arcade pong
```

进入游戏后选择：

```text
PONG

[1] Single Player
[2] Two Players
[Q] Quit
```

Single Player：

```text
Player       vs       AI
```

AI 必须简单、稳定、可调难度。

第一版本不要追求复杂 AI。

---

### 2. Two Players

建议：

```text
Player 1:
W / S

Player 2:
Arrow Up / Arrow Down
```

并允许：

```text
ESC / Q
```

退出。

---

## 七、游戏终端生命周期

这是本次实现最重要的架构要求。

执行：

```bash
arcade pong
```

时：

### Step 1

主 Shell 正常解析命令。

### Step 2

创建新的 Game Terminal Session。

### Step 3

保存当前主终端状态：

- 当前 DOM
- Shell 输入状态
- 光标状态
- 当前键盘 handler
- 当前焦点
- 必要的终端状态

### Step 4

Game Terminal 获得：

- 独立 DOM 容器
- 独立游戏状态
- 独立键盘 handler
- 独立 animation loop / timer
- 独立生命周期

### Step 5

游戏开始。

### Step 6

游戏退出：

```text
stop game loop
↓
remove game listeners
↓
destroy game session
↓
restore main terminal
↓
restore main keyboard handler
↓
restore focus
```

必须保证：

> 游戏退出后，主终端与进入游戏之前完全一致。

---

## 八、不要破坏现有 Shell

游戏启动后：

```text
Shell input
    ↓
disabled / suspended
```

但不能删除 Shell。

游戏退出：

```text
Game Input
    ↓
release
↓
Shell Input
```

尤其注意：

- 不允许残留 keydown listener
- 不允许残留 animation frame
- 不允许残留 timer
- 不允许游戏退出后主 Shell 无法输入
- 不允许 ESC 退出后出现重复监听
- 不允许重复启动游戏导致多个 game loop

---

## 九、渲染策略

优先使用：

## 字符网格 + DOM

不要引入 Canvas。

原因：

1. 网站本身就是 Terminal。
2. 游戏需要与现有字体、主题保持一致。
3. DOM 行渲染可以复用现有终端体系。
4. 零依赖、零构建。
5. 保持“终端里运行程序”的真实感。

例如：

```text
┌──────────────────────────────────────┐
│                                      │
│                  ●                   │
│                                      │
│  █                                   │
│  █                         █         │
│  █                         █         │
│                                      │
│            07        05              │
│                                      │
└──────────────────────────────────────┘
```

游戏内部维护逻辑坐标：

```text
x
y
velocityX
velocityY
paddle1Y
paddle2Y
score1
score2
```

然后将游戏状态映射到字符网格。

不要让游戏逻辑直接依赖 DOM。

推荐：

```text
Game State
    ↓
Game Engine
    ↓
Character Grid Renderer
    ↓
Terminal DOM
```

---

## 十、游戏循环

游戏逻辑与渲染分离：

```text
Input
  ↓
Game State
  ↓
Update
  ↓
Collision
  ↓
Score
  ↓
Render
```

使用浏览器合适的动画机制。

必须：

- 可以暂停
- 可以停止
- 可以销毁
- 游戏退出后不能继续运行
- 不产生无限 requestAnimationFrame
- 不产生 timer 泄漏

---

## 十一、输入系统

必须设计独立的：

```text
GameInputController
```

而不是直接修改现有 `keys.js`。

生命周期：

```text
Shell Key Handler
      ↓
suspend
      ↓
Game Key Handler
      ↓
game exits
      ↓
destroy
      ↓
Shell Key Handler
      ↓
resume
```

游戏需要：

```text
W
S
ArrowUp
ArrowDown
Escape
Q
Space
```

具体按键根据游戏状态决定是否启用。

---

## 十二、移动端

站点已有规则：

```text
≤640px
↓
只渲染全屏 Terminal
```

因此移动端不能出现桌面层错乱。

Pong 第一版支持触摸。

提供：

```text
┌───────────────┐
│               │
│     PONG      │
│               │
│               │
│               │
│               │
│   ▲       ▲   │
│   │       │   │
│   ▼       ▼   │
└───────────────┘
```

触摸控制必须：

- 有明确按钮
- 不依赖 hover
- 不阻止页面正常布局
- 按钮尺寸适合触摸
- 不影响 Shell
- 游戏退出后移除 Pointer / Touch listeners

如果某个设备确实无法支持游戏，应当：

```text
GAME UNAVAILABLE

This game requires keyboard or touch input.

[Q] Return to terminal
```

而不是出现错乱界面。

---

## 十三、主题系统

Pong 不使用固定绿色。

自动继承现有：

```text
claude
light
matrix
dracula
```

游戏只使用抽象主题变量，例如：

```text
--terminal-fg
--terminal-muted
--terminal-accent
--terminal-border
--terminal-bg
```

不要在 Pong 中硬编码主题颜色。

主题切换后，游戏终端也应该正确响应。

---

## 十四、声音

复用现有：

```text
sound module
```

游戏不能创建第二套全局音频系统。

遵循：

```text
sound off
↓
游戏静音

sound on
↓
游戏音效可用
```

游戏可以提供局部：

```text
M
```

用于游戏内部静音。

但不能覆盖全局 Sound 状态。

---

## 十五、持久化

使用：

```text
localStorage
```

Key：

```text
yuan27.arcade.v1
```

不要污染：

```text
yuan27.window.v2
```

建议保存：

```json
{
    "version": 1,
    "pong": {
        "highScore": 0,
        "gamesPlayed": 0,
        "wins": 0
    }
}
```

必须设计版本字段。

支持：

```bash
arcade --reset
```

只清除：

```text
yuan27.arcade.v1
```

不得删除其他站点数据。

---

## 十六、命令设计

正式入口：

```bash
arcade
```

支持：

```bash
arcade
arcade pong
arcade --help
arcade --list
arcade --reset
```

未来：

```bash
arcade snake
arcade tetris
```

`arcade` 必须进入现有 command registry。

因此：

- `help` 自动显示
- Tab 自动补全
- command summary 自动出现
- 命令错误处理遵循现有 Shell 风格

例如：

```text
$ arcade unknown

arcade: unknown game 'unknown'

Available games:
  pong
```

---

## 十七、错误与边界情况

必须处理：

### 重复启动

```bash
arcade pong
```

已经处于 Pong 时，不允许再启动第二个游戏实例。

### 重复 ESC

不能：

```text
destroy()
destroy()
```

导致异常。

### 页面失焦

浏览器切换 Tab / 窗口失焦后，应考虑暂停游戏或至少停止不必要的输入状态。

避免：

```text
W keydown
→ 用户切换窗口
→ W 永远保持按下
```

### Resize

终端尺寸改变时：

```text
recalculate grid
```

但不要破坏当前游戏状态。

### Reduced Motion

遵循：

```text
prefers-reduced-motion
```

减少非必要动画。

---

## 十八、测试要求

当前：

```text
97/97
```

必须保持全部通过。

新增功能必须增加测试。

至少覆盖：

## Command

```text
arcade
arcade pong
arcade --help
arcade --list
arcade --reset
```

## Game State

测试：

- 初始状态
- 球移动
- Paddle 移动
- 碰撞
- 得分
- 游戏结束
- restart

## Input

测试：

- W
- S
- ArrowUp
- ArrowDown
- ESC
- Q

## Session Lifecycle

重点测试：

```text
launch
→ suspend shell
→ game active
→ exit
→ destroy
→ restore shell
```

确保：

```text
不会出现重复 listener
不会出现重复 game loop
不会丢失 shell 状态
```

## Persistence

测试：

```text
save
load
version
reset
```

---

## 十九、推荐目录结构

在不破坏现有项目结构的前提下，推荐类似：

```text
js/
├── games/
│   ├── index.js
│   ├── arcade.js
│   ├── terminal-session.js
│   ├── game-input.js
│   ├── renderer.js
│   ├── storage.js
│   └── pong/
│       ├── index.js
│       ├── game.js
│       ├── state.js
│       ├── ai.js
│       └── renderer.js
```

实际目录必须先检查现有项目结构，再决定最终位置。

**不要为了遵循这个示例目录而强行重构现有代码。**

---

## 二十、实现顺序

严格按照以下阶段进行。

## Phase 1 — 调研现有架构

先读取：

- command registry
- Shell 执行流程
- DOM renderer
- `keys.js`
- sound module
- theme system
- localStorage 封装
- responsive/mobile terminal
- 测试结构

不要写代码。

输出：

```text
现有架构分析
依赖关系
潜在冲突
建议接入点
```

## Phase 2 — 提出 2～3 个架构方案

重点比较：

### A
独立 Game Terminal Session

### B
当前 Terminal Modal / Overlay

### C
当前 Terminal 内模式切换

比较：

- 用户体验
- 实现复杂度
- 键盘生命周期
- DOM 复用
- 移动端
- 可扩展性
- 测试成本

然后给出推荐方案。

## Phase 3 — 编写 Spec

写入：

```text
docs/
```

至少包含：

- Product Goal
- User Flow
- Architecture
- Terminal Session Lifecycle
- Input Lifecycle
- Rendering
- Pong State
- Mobile
- Theme
- Sound
- Persistence
- Error Handling
- Testing
- Future Games Extension

**这一阶段结束后停止。**

等待人工审阅 Spec。

## Phase 4 — 实施计划

Spec 审阅通过后，再输出：

```text
Implementation Plan
```

按小步骤拆分。

## Phase 5 — TDD 实现

顺序：

```text
tests
↓
command integration
↓
terminal session
↓
input lifecycle
↓
renderer
↓
pong engine
↓
AI
↓
touch
↓
sound
↓
persistence
```

每个阶段保持测试通过。

---

## 二十一、重要设计原则

整个实现遵守以下原则：

### 1. Terminal First

游戏必须看起来像 Terminal 中运行的程序。

### 2. Session Isolation

游戏 Terminal 与主 Terminal 状态隔离。

### 3. Clean Lifecycle

进入游戏和退出游戏必须都是完整生命周期。

### 4. Zero Dependency

不引入新的第三方依赖。

### 5. No Canvas

第一版 Pong 使用字符网格 + DOM。

### 6. Theme Native

游戏继承网站主题。

### 7. Mobile Aware

≤640px 不破坏现有全屏 Terminal 规则。

### 8. Test First

保持现有 97/97，并为新功能增加测试。

### 9. Extensible

未来能够自然增加：

```text
Snake
Tetris
2048
Minesweeper
...
```

但第一阶段只实现 Pong。

### 10. 不做过度设计

不要加入：

- 扫描线
- 噪点
- 大量粒子
- 霓虹光效
- 复杂过渡动画
- 第三方游戏引擎
- Canvas
- WebGL

视觉重点应该是：

> **Unix Terminal + Retro Arcade + 极简现代 Web。**

---

## 二十二、最终体验目标

用户最终应该能够在 yuan27.top 中完成：

```text
$ help

...

arcade    launch terminal arcade games

$ arcade

┌──────────────────────────────────────┐
│          YUAN27 TERMINAL ARCADE      │
│                                      │
│  pong       Classic Pong             │
│                                      │
│  Type: arcade pong                   │
└──────────────────────────────────────┘

$ arcade pong

        ↓

┌──────────────────────────────────────┐
│ yuan27.top :: arcade :: pong         │
├──────────────────────────────────────┤
│                                      │
│            07      05                 │
│                                      │
│  █                       █           │
│  █           ●           █           │
│  █                       █           │
│                                      │
│                                      │
├──────────────────────────────────────┤
│ W/S       Player 1                   │
│ ↑/↓       Player 2                   │
│ ESC/Q     Exit                       │
└──────────────────────────────────────┘

        ↓ ESC

$ _
```

用户的感觉应该是：

> **“我在 yuan27.top 的 Unix 环境里运行了一个游戏程序，而这个程序打开了自己的终端会话。”**

而不是：

> **“我点击了一个网页上的 Pong 游戏。”**

这应当成为整个 Terminal Arcade 系统的核心产品体验。
