# Terminal Arcade / Pong 实现要求与优化提示词

> 2026-09-19 由站点作者下达。Phase 1/2 已完成，**明确采用方案 A：独立 Game Terminal Session**。
> 本文是 `docs/2026-09-19-terminal-arcade-spec.md` 的输入之一；执行阶段规则见文末《二十三、实现顺序》。

你现在要基于现有 `yuan27.top` 类 Unix Terminal 网站架构，实现 Terminal Arcade / Pong。

已有 Phase 1/2 架构调研已经完成，**明确采用方案 A：独立 Game Terminal Session**。不要重新讨论 B/C，也不要擅自改变整体架构。

核心目标：

> 用户在主终端输入 `arcade` 后，相当于运行了一个 Unix 前台程序：主 Shell 会话保持原样，打开一个独立的 Terminal 风格游戏窗口；游戏结束后窗口销毁，主终端恢复输入，历史中保留 `$ arcade`，不清屏、不污染主终端。

---

## 一、必须遵守的架构原则

### 1. 独立 Session

游戏必须拥有独立的：

- DOM 容器
- `Terminal` 实例
- 游戏状态
- 输入状态
- 游戏循环
- 音效状态
- 生命周期

禁止复用主终端 `#output`。

主 Terminal 的历史、滚动内容、输入状态不能被游戏污染。

### 2. 不修改 Shell drain() 机制

现有 Shell 已经具备：

```text
drain()
  ↓
await handler(shell, args)
  ↓
handler 结束
  ↓
继续执行下一条命令
```

因此 `arcade` handler 应该：

```text
创建 Game Session
    ↓
打开游戏窗口
    ↓
await session.start()
    ↓
游戏结束
    ↓
destroy()
    ↓
handler resolve
```

不要为了游戏重新设计 Shell 队列。

### 3. 键盘采用"焦点归属"，不要做全局抢键盘

现有 `keys.js` 只监听主终端 input，不是 `document` 全局监听。

游戏启动：

```text
主 terminal input
        ↓
失去焦点

Game Window
        ↓
获得焦点
        ↓
游戏接管键盘
```

游戏结束：

```text
Game Window
        ↓
destroy
        ↓
主 terminal input.focus()
```

禁止为了游戏增加 document/window 级全局键盘监听器。

---

## 二、必须重点处理的生命周期问题

### 1. activeSession 守卫

必须防止：

- 连续输入两次 `arcade`
- 重复启动
- 重复 ESC
- 窗口关闭和游戏结束同时发生
- destroy() 被调用多次

要求 `activeSession` 作为模块级唯一活动 Session。

`destroy()` 必须幂等：重复调用最终结果只能是「游戏停止 / 监听器全部移除 / RAF 取消 / 窗口销毁 / 焦点恢复」，不能报错，也不能重复执行副作用。

### 2. Session 必须有明确生命周期

建议：

```text
created → running → paused → ended → destroyed
```

不需要为了状态机过度设计，但必须保证状态转换明确。至少处理：start / pause / resume / end / destroy。

### 3. ESC 的特殊处理

ESC 是高风险按键。游戏中 ESC → 结束游戏 → destroy → 恢复主 Shell。

但不能出现：ESC 结束游戏 → 事件继续传播 → 主 Shell 收到 ESC → 清空用户输入。

因此退出游戏的 ESC 事件必须被当前 Game Session 消费。恢复主终端后，不应该把本次 ESC 继续传给 Shell。

---

## 三、输入系统

### 1. 桌面端

Pong 至少支持 `W / S`、`↑ / ↓`、`ESC`。建议 `W / ArrowUp` 上移、`S / ArrowDown` 下移、`ESC` 退出。

对于游戏控制键：

- `preventDefault()`
- 不允许 Space 导致页面滚动
- 不允许方向键导致页面滚动
- 不允许 Tab 意外触发 Shell 补全

但不要阻止所有键。

### 2. 失焦防粘键

必须处理 `blur` 与 `visibilitychange`。用户按住 W 后切换窗口，不能让游戏永久认为 W 仍处于 pressed 状态。

因此失焦时：clear input state + pause game；重新获得焦点后再恢复。

---

## 四、窗口系统

直接复用 `windowing.js` 的 `enableWindow()`。不要重新写拖拽、缩放、最大化、关闭等逻辑。

游戏窗口标题：

```text
yuan27.top :: arcade :: pong
```

建议保持与主 Terminal 相同的状态栏、红黄绿窗口按钮视觉、边框、字体、theme variables。

红色关闭按钮 = 退出游戏。

### 不要加入 Taskbar

现有 taskbar 存在单窗口假设。因此 Game Window 不要注册到 Taskbar，不要修改 Taskbar 架构来迁就 Arcade。

---

## 五、渲染系统

不要每一帧重建整个 DOM。采用：

```text
Game State → gridToString(state) → string[] → diffRows(prev, next) → 只更新变化行
```

核心函数保持纯函数 `gridToString(state)`、`diffRows(prev, next)`，必须可以脱离 DOM 单独测试。

### 静态 / 动态分层

- **静态层**：外框、中线、底部信息、固定 UI —— 只在初始化 / resize 时重建
- **动态层**：Ball、Paddle、Score、必要的状态文字 —— 每帧只更新变化部分

不要为了性能引入 Canvas/WebGL 等额外复杂度。核心视觉是 Unix Terminal + ASCII 字符网格 Pong。

---

## 六、Resize

Resize 不能重置游戏状态。正确行为：重算 grid dimensions → 重建静态框架 → 保留球位置、球速度、挡板位置、比分、game state。

禁止 `resize → restart game`。

---

## 七、移动端

现有 CSS 已规定：`≤640px` 时 `.terminal-window` → `100vw × 100dvh` 全屏。

因此**不要额外实现 Mobile Game Window**：桌面 = 独立窗口，移动端 = 独立全屏 Session，**使用同一套代码**。

必须提供游戏内部触摸控制（例如 ▲/▼ 或上下两个虚拟控制区域），要求：

- 只存在于 Game Session
- 不修改主 Shell
- destroy 时移除所有 listener
- 不影响页面正常滚动
- `touchstart` / `touchend` / `touchcancel` 都正确处理

如果触摸控制已经足够，不要继续增加虚拟摇杆等复杂 UI。

---

## 八、游戏循环

参考现有 `background.js` 的生命周期模式，使用 `requestAnimationFrame`，保证 `start()` / `stop()` 成对出现，destroy 时必须 `cancelAnimationFrame()`。

### Visibility

后台时 pause + clear input；回前台 resume。不能让后台页面持续高速运行。

### reduced-motion

球的移动、挡板移动属于**功能本身**，不能因为 `prefers-reduced-motion` 而关闭。只需要避免额外装饰性动画（本项目本身也不加装饰动画）。

---

## 九、Pong 游戏逻辑

游戏逻辑必须尽可能纯，建议至少拆成 `state` / `update()` / `collision()` / `input()` / `render()`，不要让游戏逻辑直接依赖 DOM。

核心状态至少包括：ball、ball velocity、left paddle、right paddle、score、running / paused。

### 碰撞检测

必须明确处理上边界、下边界、左右挡板、得分边界。避免球卡在墙里、球穿过挡板、高速情况下穿透挡板、碰撞后速度变成 0。

如需可使用简单的碰撞修正：碰撞后将球拉回合法位置。

---

## 十、难度与可玩性

第一版不要做复杂 AI。右侧 Paddle 采用简单 AI：根据 `ball.y` 平滑追踪 + 设置最大移动速度，**不要做"完美预测"**，需要保留一定可玩性。

建议 Easy / Normal，第一版甚至可以只提供 Normal。

不要堆技能、道具、粒子、复杂 AI、大量动画、排行榜系统 —— 先把核心 Pong 做扎实。

---

## 十一、音效

这是对现有架构**唯一需要扩展的既有模块**：`sound.js`。

原则：只新增通用 API，不删除、不改变现有 `key()` / `enter()` 行为。例如增加 `blip(freq, duration, gain, type)`。

Pong 可用于 paddle hit / wall hit / score / game over。

游戏自身维护 `gameMuted`，不要修改全局声音开关：`M` 只切换 Pong 音效，不污染 `yuan27.sound.v1`。

---

## 十二、音频异常必须可降级

WebAudio 可能因浏览器策略、用户未与页面交互、AudioContext 状态异常而播放失败。

要求：**音效失败 ≠ 游戏失败**。所有 sound call 都应该安全失败。禁止因为音频异常导致游戏 Session 崩溃。

---

## 十三、主题

不要新增 `--terminal-fg` / `--terminal-bg` 等重复变量。直接使用现有变量：

```text
--text --text-muted --dir --prompt --border --bg --bg-elevated
--cursor --error --success --link --selection --input --logo-depth
```

游戏必须天然跟随 `data-theme` 切换。JS 不负责主题颜色。

---

## 十四、持久化

使用现有命名规范 `yuan27.arcade.v1`。如需保存是否静音、游戏设置、最高分，必须带 `version`，并做好损坏数据容错 —— `JSON.parse` 失败不能导致整个网站启动失败。

---

## 十五、命令注册

只需要在 `commands.js` 增加 `arcade`，注册到 `category: "Fun"`。

由于 `help` / `summary` / Tab completion / `commandNames` 都从 registry 派生，因此不要重复维护命令列表。

---

## 十六、文件结构

推荐：

```text
js/
├── games/
│   ├── arcade.js
│   ├── session.js
│   ├── input.js
│   ├── renderer.js
│   ├── pong.js
│   └── storage.js
```

具体拆分可以根据实际代码量调整。原则：游戏内部自包含，既有系统最小侵入。现有项目的 `js/` 是扁平结构，因此所有相对路径必须严格验证。

---

## 十七、既有代码修改边界

优先只修改 `commands.js`、`main.js`、`sound.js`、`css/style.css`；新增 `js/games/**`。

尽量不要修改 `keys.js`、`terminal.js`、`windowing.js`、`taskbar.js`、`background.js`、`themes.js`，除非实际实现证明必须修改。

特别是：**不要为了 Arcade 重构已经工作的基础设施。**

---

## 十八、测试要求

必须遵循现有测试体系 `node --test tests/*.test.js`，游戏逻辑优先测试纯函数。至少覆盖：

- **Pong**：初始状态、Paddle 移动、Ball 移动、墙壁碰撞、Paddle 碰撞、得分、重置、游戏结束
- **Input**：W、S、↑、↓、ESC、blur 清空 pressed state
- **Renderer**：gridToString、diffRows
- **Storage**：正常读取、空数据、损坏 JSON、version 不兼容
- **Session**：start、stop、destroy、重复 destroy、重复启动、ESC 退出、visibilitychange

---

## 十九、性能要求

目标不是极限性能，而是小而稳定、不会污染主页面。避免：每帧创建大量 DOM、每帧 `querySelectorAll`、每帧 `innerHTML` 重建整个游戏、不断创建匿名 listener、不断创建 AudioContext。

游戏结束后必须能够证明：`RAF = 0`、`game listeners = 0`、`game DOM = 0`、`activeSession = null`。

---

## 二十、错误处理

游戏失败不能拖垮 Shell。例如 `arcade` → 游戏初始化失败，应该显示简短错误 → 清理 Session → 恢复 Shell，而不是整个页面 JS 崩溃。

---

## 二十一、UI / 视觉原则

视觉关键词：**Unix / Terminal / CRT / 极简 / 复古计算机**。

但不要堆视觉特效。禁止为了"好看"加入：大量 glow、粒子、扫描线、噪点、RGB glitch、过度阴影、复杂渐变、花哨背景、大量动画。

重点放在：字体、间距、边框、状态栏、字符网格、光标、主题一致性。

游戏应该像"一个真正运行在 Unix Terminal 里的小程序"，而不是"一个套着 Terminal 皮肤的网页小游戏"。

---

## 二十二、第一版功能边界（非常重要）

第一版只完成：

```text
arcade 命令 → 独立 Terminal Game Window → Pong → 键盘控制 → 移动端触摸控制
→ 简单 AI → 计分 → ESC / 红灯退出 → 音效 → 主题适配 → 暂停 / visibility
→ 完整 destroy → 测试
```

暂时不要做：Snake、Tetris、排行榜、用户账号、在线对战、复杂 AI、成就系统、积分系统、游戏商店、复杂设置面板、复杂动画。这些留给未来 Arcade 扩展。

---

## 二十三、实现顺序

```text
Phase 3 → 写 Spec → 停止 → 等审阅
Phase 4 → Implementation Plan → 停止 → 等审阅
Phase 5 → TDD → 先测试 → 再实现
Phase 6+ → UI / Integration → 最终验收
```

不要跳过阶段。不要在没有确认的情况下直接修改线上代码。

---

## 二十四、最终验收标准

### Shell

- [ ] `arcade` 可以正常启动
- [ ] 主终端历史没有被污染
- [ ] Shell drain 没有被重构
- [ ] 退出后输入焦点恢复

### Window

- [ ] 可以拖动 / 缩放 / 最大化
- [ ] 红灯可以退出
- [ ] 不进入 Taskbar
- [ ] 移动端自动全屏

### Input

- [ ] W/S、↑/↓、ESC
- [ ] Space 不滚动
- [ ] 方向键不滚动
- [ ] Tab 不触发 Shell 补全
- [ ] blur 不产生粘键

### Game

- [ ] Ball 正常运动 / Paddle 正常运动 / AI 正常工作 / 碰撞正常 / 得分正常 / 游戏不会卡死

### Lifecycle

- [ ] 重复启动安全 / 重复 ESC 安全 / destroy 幂等
- [ ] visibilitychange 正常 / RAF 正确取消 / listener 全部清理

### Mobile

- [ ] 全屏 / 触摸控制 / 横竖屏 resize 不崩 / 退出后触摸 listener 清理

### Theme

- [ ] Light / Dark / 其他现有主题均正常
- [ ] 不新增重复颜色变量

### Sound

- [ ] 音效正常 / M 只影响游戏音效 / WebAudio 失败不会导致游戏崩溃

### Regression

- [ ] 原有 97/97 测试保持通过
- [ ] 新增游戏测试全部通过
- [ ] `help` 正常 / `summary` 正常 / Tab completion 正常 / 原有 Shell 命令全部正常

---

## 最重要的开发原则

优先级：

```text
正确性 > 生命周期安全 > 与现有 Terminal 架构一致 > 可维护性 > 性能 > 视觉效果 > 额外功能
```

- 如果某个"酷炫效果"会增加架构复杂度，删除它。
- 如果某个功能不是第一版 Pong 必需功能，暂缓。
- 如果可以复用现有基础设施，不要重新实现。
- 如果修改既有模块不是绝对必要，不要修改。

最终目标不是"做一个网页小游戏"，而是：**让 Arcade 成为这个 Unix Terminal 系统里一个自然存在、架构干净、生命周期完整、可以继续扩展成 Snake / Tetris 等游戏的原生功能。**

完成每个 Phase 后停止并汇报：1. 修改了什么 2. 为什么这么修改 3. 测试结果 4. 发现的问题 5. 下一阶段准备做什么。未经确认不要跨 Phase 执行。
