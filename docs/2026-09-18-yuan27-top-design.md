# YUAN27.top 网站重置方案

> 目标：将现有网站重置为一个以 Unix Terminal 为核心交互界面的个人 Portfolio / Blog 系统。
>
> 核心原则：保持纯 HTML + CSS + 原生 JS 的轻量架构，同时补足信息架构、工程质量、移动端体验、SEO、测试与部署安全。

---

## 一、总体结论

原方案的核心技术选型可以保留：

- 纯 HTML + CSS + 原生 JS（ES Modules）
- 无框架、无构建工具
- 虚拟文件系统（Virtual File System）
- Terminal 风格交互
- Markdown 风格内容
- localStorage 保存历史记录和主题
- 静态部署

这个选择适合目前的网站规模，不需要为了"技术栈高级"而引入 React/Vue/Vite。

但原方案更偏向"怎么开发"，还需要补充三个层面：

1. **产品层：信息架构和内容组织**
2. **工程层：解析、错误处理、可访问性、测试**
3. **运维层：部署、备份、回滚**

最终网站不应只是"套了终端皮肤的个人主页"，而应该成为：

> **一个以 Terminal 为交互界面的个人 Portfolio / Blog 系统。**

---

# 二、技术方案

## 2.1 推荐方案：纯 HTML + CSS + 原生 JS

### 优点

- 零依赖
- 零构建链
- 部署简单
- 静态文件直接部署
- ES Modules 可以自然拆分代码
- 适合当前网站规模
- 不需要 Node/npm
- 修改内容简单

### 备选方案

#### React/Vue + Vite

优点：

- 组件化
- 生态丰富

缺点：

- 引入 Node/npm
- 需要构建
- 需要部署 build 产物
- 对当前规模可能属于过度设计

#### Astro/Eleventy

优点：

- Markdown 内容管理优秀
- 更适合静态内容站

缺点：

- 依然引入构建链
- Terminal 交互逻辑仍然需要手写 JS

### 当前结论

**第一版继续使用纯 HTML + CSS + 原生 JS。**

以后如果博客和内容规模显著扩大，可以再考虑 Astro/Eleventy。

---

# 三、产品定位

网站定位：

> **YUAN27.top —— 一个通过虚拟 Unix Terminal 认识 YUAN 的个人网站。**

用户打开网站后，不是看到传统导航栏，而是进入一个 Terminal 环境。

典型体验：

```text
$ help

$ ls

$ cd projects

$ ls

$ cd ai-agent

$ cat readme.md
```

通过执行命令浏览：

- 个人介绍
- 教育经历
- 技能
- 项目
- 博客
- 简历
- 联系方式

这样可以让 Terminal 成为真正的交互模型，而不只是视觉主题。

---

# 四、信息架构

原方案：

```text
/
├── about/
├── projects/
├── blog/
├── contact/
└── readme.md
```

建议扩展为：

```text
/
├── readme.md
│
├── about/
│   ├── bio.md
│   ├── education.md
│   ├── skills.md
│   └── experience.md
│
├── projects/
│   ├── ai-agent/
│   ├── rag/
│   ├── backend/
│   ├── cpu/
│   └── website/
│
├── blog/
│   ├── ai/
│   ├── cs/
│   └── thoughts/
│
├── resume/
│   └── resume.pdf
│
└── contact/
    └── info.md
```

这样以后可以自然增加：

- AI Agent 项目
- RAG 项目
- 后端项目
- MIPS / CPU 课程设计
- CTF / 安全相关项目
- 技术博客
- 个人随笔

---

# 五、文件结构

第一版建议保持适度简单：

```text
<web-root>/
│
├── index.html
│
├── css/
│   ├── theme.css
│   └── style.css
│
├── js/
│   ├── main.js
│   ├── content.js
│   ├── fs.js
│   ├── commands.js
│   ├── terminal.js
│   ├── completion.js
│   ├── history.js
│   └── themes.js
│
└── fonts/
    └── JetBrains-Mono/
```

### 文件职责

| 文件 | 职责 |
|---|---|
| `index.html` | 页面骨架、状态栏、输出区、输入区、移动端按钮 |
| `theme.css` | CSS 变量、主题配色 |
| `style.css` | 布局、终端窗口、响应式、动画 |
| `main.js` | 应用入口、启动动画、事件绑定 |
| `content.js` | 第一版虚拟文件系统和内容数据 |
| `fs.js` | 虚拟文件系统、路径解析、文件操作 |
| `commands.js` | 命令注册和命令实现 |
| `terminal.js` | 输出渲染、打印队列、光标、clear |
| `completion.js` | Tab 自动补全 |
| `history.js` | 命令历史和 localStorage |
| `themes.js` | 主题定义与切换 |

---

# 六、内容管理策略

## V1：content.js

第一版可以把内容集中在：

```text
content.js
```

例如：

```js
export const FS = {
  type: 'dir',
  children: {
    about: {
      type: 'dir',
      children: {
        'bio.md': {
          type: 'file',
          content: '...'
        },
        'skills.md': {
          type: 'file',
          content: '...'
        },
        'resume.pdf': {
          type: 'file',
          binary: true,
          url: 'resume.pdf'
        }
      }
    }
  }
};
```

优点：

- 开发简单
- 修改集中
- 第一版容易维护

## V2：Markdown 外置

当内容增多后改成：

```text
content/
├── about/
│   ├── bio.md
│   ├── education.md
│   └── skills.md
├── projects/
│   ├── project-1.md
│   └── project-2.md
└── blog/
    ├── post-1.md
    └── post-2.md
```

然后通过 `fetch()` 加载。

这样未来可以做到：

> 写 Markdown → 上传 → 网站更新

而不是不断修改大型 `content.js`。

---

# 七、虚拟文件系统设计

文件分为三类：

### 1. 普通文本

```text
bio.md
readme.md
skills.md
```

可以：

```bash
cat bio.md
```

### 2. 链接文件

带 URL：

```js
{
  type: 'file',
  url: 'https://...'
}
```

通过：

```bash
open xxx
```

打开。

### 3. 二进制文件

例如：

```text
resume.pdf
```

执行：

```bash
cat resume.pdf
```

显示：

```text
cat: resume.pdf: binary file
Please use 'open'.
```

执行：

```bash
open resume.pdf
```

打开简历。

---

# 八、Terminal 架构

建议采用：

```text
用户输入
   ↓
Command Parser
   ↓
Command Registry
   ↓
Virtual File System / State
   ↓
Terminal Renderer
```

不要让输入直接执行 Shell。

尤其不要使用：

```js
eval()
```

第一版完全不需要真正执行 Linux 命令。

---

# 九、命令解析器

原方案没有充分拆出 Parser。

建议至少建立：

```text
parser.js
```

负责：

```text
输入字符串
    ↓
tokenize
    ↓
command
args
options
    ↓
command handler
```

例如：

```bash
cat projects/ai-agent/readme.md
```

解析成：

```text
command:
  cat

args:
  projects/ai-agent/readme.md
```

第一版不需要实现完整 Shell，只需要保证基础命令解析可靠。

---

# 十、核心命令

第一版：

```text
ls
cd
pwd
cat
help
clear
```

第二阶段：

```text
tree
open
whoami
history
theme
```

建议增加：

```text
help <command>
```

例如：

```bash
help cat
```

输出：

```text
cat - display file contents

Usage:
    cat <file>

Example:
    cat about/bio.md
```

以后还可以增加：

```bash
man cat
```

---

# 十一、命令错误处理

必须统一设计错误格式。

例如：

```bash
cd abc
```

输出：

```text
cd: abc: No such file or directory
```

```bash
cat abc.md
```

输出：

```text
cat: abc.md: No such file or directory
```

```bash
open bio.md
```

如果不是可打开的文件：

```text
open: bio.md: not a link or binary file
```

未知命令：

```bash
python
```

输出：

```text
python: command not found
```

这样 Terminal 的完整性会明显提高。

---

# 12、Tab 自动补全

不要只实现命令补全。

## 命令补全

```text
he<Tab>
```

→

```text
help

## 路径补全

```text
cd pro<Tab>
```

→

```text
cd projects/
```

## 文件补全

```text
cat pro<Tab>
```

→

```text
cat projects/
```

## 多匹配

```text
cat projects/<Tab>
```

可以显示：

```text
projects/
├── agent/
├── backend/
└── website/
```

Tab 补全应当同时支持：

- 命令
- 目录
- 文件
- 路径

---

# 十三、命令历史

使用：

```text
localStorage
```

保存：

```text
history
```

支持：

```text
↑
↓
```

浏览历史命令。

例如：

```text
$ ls
$ cd projects
$ ls
$ cd ai-agent
$ cat readme.md
```

刷新页面后历史仍然可以保留。

---

# 十四、Terminal Renderer

建议：

```text
terminal.js
```

负责：

- 输出队列
- 逐行输出
- 逐字输出
- 光标
- clear
- 滚动到底部

建议保留原方案的动画速度：

```text
普通输出：40ms / 行
cat：12ms / 字
```

但速度应该最终做成可配置值，方便以后调整。

---

# 十五、主题系统

使用 CSS Variables：

```css
:root {
  --bg: #1a1a1a;
  --text: ...;
  --accent: #58a6ff;
  --success: #3fb950;
  --error: #f85149;
}
```

通过：

```html
data-theme="..."
```

切换主题。

例如：

```bash
theme claude
```

并通过：

```text
localStorage
```

保存选择。

默认主题保持深色 Terminal 风格。

---

# 十六、whoami：个性化核心入口

不要把 `whoami` 只当普通命令。

可以把它设计成个人网站特色：

```text
$ whoami

YUAN

Computer Science Undergraduate
AI / Agent / Backend Development

Currently:
  → Building AI applications
  → Learning backend engineering
  → Exploring LLM / Agent systems
```

这可以成为用户快速了解你的入口。

---

# 十七、启动画面

启动：

```text
ASCII Logo
    ↓
空一行
    ↓
Welcome to YUAN27.top.
Type 'help' to get started.
    ↓
Prompt
```

例如：

```text
$ 
```

配合闪烁光标。

启动动画应当可以关闭或在 `prefers-reduced-motion` 下自动降低动画。

---

# 十八、Easter Eggs

第一版不是必须，但个人网站非常适合。

例如：

```bash
neofetch
```

展示：

```text
OS: YUAN27
Host: yuan27.top
Shell: yuansh
Projects: ...
Blog posts: ...
```

也可以有：

```text
coffee
matrix
sudo hire yuan
```

注意：

> 彩蛋是加分项，不要影响核心浏览体验。

---

# 十九、移动端

原方案：

- 手机全屏
- 13px
- 底部快捷按钮
- `ls`
- `help`
- `cd ..`

这个方向可以保留。

但需要重点测试：

```text
iOS Safari
Android Chrome
```

尤其是：

```text
input focus
    ↓
键盘弹出
    ↓
viewport 高度变化
    ↓
Terminal 是否仍然可见
```

建议优先考虑：

```css
height: 100dvh;
```

而不是单纯：

```css
height: 100vh;
```

同时考虑：

```text
safe-area-inset-bottom
```

避免手机键盘遮挡输入区域。

---

# 二十、可访问性

原方案没有覆盖这一点。

至少增加：

## HTML 语义

```html
<main>
```

```html
<section aria-label="Terminal output">
```

输入框：

```html
<input aria-label="Terminal command input">
```

## 不只依靠颜色

目录、文件、错误等不要完全依靠颜色区分。

## 键盘操作

保证：

- Tab
- Enter
- ↑
- ↓
- Escape

等操作可用。

## 动画

加入：

```css
@media (prefers-reduced-motion: reduce) {
  ...
}
```

减少动画。

---

# 二十一、SEO

这是原方案需要补充的重要部分。

因为内容主要由 JS 动态生成，搜索引擎可能看到的初始 HTML 内容很少。

第一版至少加入：

```html
<title>YUAN27 — AI / Backend / Portfolio</title>

<meta
  name="description"
  content="YUAN27 的个人技术作品集与博客"
/>

<meta property="og:title" content="YUAN27" />
<meta property="og:description" content="Personal Portfolio" />
<meta property="og:image" content="..." />
```

同时准备：

```text
robots.txt
sitemap.xml
favicon
Open Graph image
```

如果以后特别重视 SEO，再考虑：

```text
Astro / Eleventy
```

进行静态生成。

---

# 二十二、部署策略

原方案最后一步是：

```text
拷进 index/
修改 Nginx
下线 WordPress
```

建议不要直接删除旧网站。

正确流程：

```text
旧网站备份
      ↓
新网站部署到临时目录
      ↓
本地 / 线上测试
      ↓
Nginx 切换
      ↓
确认正常
      ↓
再处理旧 WordPress
```

更理想的目录：

```text
website/
├── current/
├── releases/
│   ├── 2026-09-18/
│   └── ...
└── backup/
```

这样以后可以：

```text
v2 出问题
↓
切回 v1
```

---

# 二十三、测试阶段

原方案缺少独立测试阶段。

建议正式加入。

## 浏览器

```text
Desktop:
├── Chrome
├── Edge
└── Firefox

Mobile:
├── Android Chrome
└── iOS Safari
```

## 功能测试

```text
✓ pwd
✓ ls
✓ cd
✓ cd ..
✓ cd /
✓ cat
✓ open
✓ tree
✓ clear
✓ history
✓ theme
✓ whoami
✓ help
✓ Tab
✓ ↑ ↓
✓ 空输入
✓ 连续空格
✓ 不存在的命令
✓ 不存在的文件
✓ 不存在的目录
✓ 根目录 cd
✓ 重复 cd
✓ 路径结尾 /
✓ 相对路径
✓ 绝对路径
✓ 中文内容
✓ 超长内容
✓ 移动端键盘
✓ 窗口缩放
✓ 刷新页面
```

---

# 二十四、推荐的最终开发阶段

原方案：

```text
1. 骨架
2. 核心命令
3. 增强命令
4. 交互
5. 响应式
6. 部署
```

建议修改为：

```text
Phase 0
信息架构 + 内容设计

Phase 1
HTML + CSS 骨架

Phase 2
Terminal Renderer

Phase 3
Virtual File System

Phase 4
Command Parser + Command System

Phase 5
内容填充

Phase 6
交互体验

Phase 7
移动端 / 响应式

Phase 8
SEO + Accessibility

Phase 9
测试

Phase 10
部署

Phase 11
备份 + 回滚机制
```

---

# 二十五、第一阶段具体任务

在正式写大量代码之前，先确定：

## 1. 网站信息架构

```text
/
├── readme.md
├── about/
├── projects/
├── blog/
├── resume/
└── contact/
```

## 2. 确定个人信息

准备：

```text
bio
education
skills
experience
```

## 3. 确定项目

每个项目准备：

```text
项目名称
项目简介
技术栈
项目背景
核心功能
技术难点
个人贡献
GitHub
Demo
截图
```

## 4. 确定博客结构

```text
AI
CS
Backend
Thoughts
```

## 5. 确定 Terminal 命令

第一版：

```text
ls
cd
pwd
cat
open
tree
clear
help
history
theme
whoami
```

---

# 二十六、最终推荐架构

```text
                    YUAN27.TOP
                         │
                ┌────────▼────────┐
                │     Terminal     │
                │  UI / Renderer   │
                └────────┬────────┘
                         │
                  Command Parser
                         │
                ┌────────▼────────┐
                │ Command Registry │
                └────────┬────────┘
                         │
              ┌──────────┴──────────┐
              │                     │
       Virtual File System        State
              │                     │
        ┌─────┼─────┐          localStorage
        │     │     │
      about projects blog
        │     │     │
        └─────┼─────┘
              │
           Content
```

核心原则：

```text
UI
 ↓
Parser
 ↓
Commands
 ↓
Virtual FS
 ↓
Content
```

各层职责尽量不要混在一起。

---

# 二十七、最终优先级

## 🔴 开发前必须确定

1. 信息架构
2. 内容结构
3. 命令解析方式
4. 错误处理
5. 移动端键盘方案
6. SEO 基础
7. 部署备份和回滚

## 🟡 第一版建议完成

8. `help <command>`
9. Tab 路径补全
10. 个性化 `whoami`
11. `prefers-reduced-motion`
12. 完整功能测试
13. favicon / Open Graph / robots / sitemap

## 🟢 后续迭代

14. Markdown 外置
15. `man`
16. Easter Eggs
17. 更多主题
18. PWA
19. 更复杂的虚拟 Shell
20. Astro / Eleventy 静态生成

---

# 二十八、最终目标

最终网站应该让第一次访问的人可以自然地经历：

```text
打开网站
   ↓
ASCII Logo
   ↓
Welcome
   ↓
$ help
   ↓
$ ls
   ↓
$ cd about
   ↓
$ ls
   ↓
$ cat bio.md
   ↓
了解你
   ↓
$ cd ../projects
   ↓
$ ls
   ↓
$ cd ai-agent
   ↓
$ cat readme.md
   ↓
了解项目
   ↓
$ cd /
   ↓
$ open resume.pdf
```

最终效果不是：

> 一个黑色背景的个人主页。

而是：

> **一个完整的、具有个人特色的 Terminal Portfolio。**

同时，它应该具备：

- 足够轻量的技术架构
- 清晰的信息架构
- 良好的移动端体验
- 基础 SEO
- 可访问性
- 可维护的内容系统
- 可测试的命令系统
- 安全的虚拟 Shell 边界
- 可回滚的部署方式

这套方案可以作为之后实际重构 YUAN27.top 的总设计文档。
