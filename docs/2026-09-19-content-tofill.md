# 待补充信息清单（Placeholder → Real）

> 用途：站点当前所有**占位内容**集中记录于此。功能实现完成后，按本文件逐项提供真实信息，我据此替换。
> 定位方法：在 `js/content.js` 中搜索「← 替换此处」。
> 更新：2026-09-19

---

## A. 个人档案（`neofetch` / `whoami`）

位置：`js/content.js` → `PROFILE`

| 字段 | 当前占位 | 需要你提供 |
|---|---|---|
| `user` | YUAN27 | 显示名 |
| `host` | yuan27.top | 站点域名（一般不改） |
| `role` | AI / Backend Developer | 一句话身份 |
| `school` | HUST | 学校 / 单位 |
| `focus` | Agent · RAG · Backend | 3 个方向关键词 |
| `projects` | 12 | 项目数量（真实） |
| `blog` | 24 posts | 文章数量（真实） |
| `status` | Building quietly | 一句状态签名 |

同时 `WHOAMI`（`whoami` 命令）里的几行也需要确认或重写。

---

## B. `about/`

| 文件 | 当前内容 | 需要你提供 |
|---|---|---|
| `bio.md` | 占位自我介绍 | 一段话介绍你自己 |
| `education.md` | 2022–2026 B.Sc. CS | 学校、专业、时间、课程 |
| `skills.md` | Python/C++/FastAPI… | 你的真实技能栈 |
| `experience.md` | 占位 | 实习 / 科研 / 项目经历 |

---

## C. `projects/`（agent / rag / backend / mips / website）

每个 `readme.md` 统一需要：

- 项目名 / 简介
- 技术栈
- 背景
- 核心功能
- 技术难点
- 个人贡献
- 状态（进行中 / 已完成 / 归档）

每个目录下的 `github` 链接文件目前是占位 URL（`https://github.com/yuan27/...`），需要真实仓库地址；如有 Demo / 截图也一并提供。

> 注：目录名已按路线图对齐（`ai-agent` → `agent`，`cpu` → `mips`），`backend` 与 `experience.md` 作为额外内容保留，如需删除请告知。

---

## D. `blog/`（ai / cs / thoughts）

每个分类下的 `.md` 需要：标题、日期、正文（或站外真实文章链接）。
当前 `llm-agents.md`、`os-notes.md`、`hello-world.md` 均为占位。

---

## E. `contact/`

| 项 | 当前占位 | 需要你提供 |
|---|---|---|
| `links.md` | `yuan@yuan27.top` / `github.com/yuan27` | 真实邮箱、GitHub 等 |
| `email` 链接文件 | `mailto:yuan@yuan27.top` | 真实邮箱 |
| `github` 链接文件 | `https://github.com/yuan27` | 真实主页 |

---

## F. 简历

`assets/resume.pdf` 目前是生成的占位 PDF，需替换为真实简历（同名覆盖即可，`resume` 命令 / `open resume/resume.pdf` 会打开它）。

---

## G. 隐藏文件与彩蛋（P1 新增）

入口：`cat .secret` / `cat .note` / `cat .birthday`；列表：`ls -a`、`tree -a`

| 文件 | 当前占位 | 需要你提供 |
|---|---|---|
| `.secret` | “You found something that was not listed in the docs.” + 占位 | 一句有趣的个人宣言 |
| `.note` | “给认真探索到这里的人：” + 占位 | 给探索者的一句话 |
| `.birthday` | `🎂 03-14` | 真实生日 / 纪念日 |

## H. 趣味命令文案（P1 新增）

位置：`js/content.js` → `FUN`

| 项 | 当前 | 需要 |
|---|---|---|
| `FUN.coffee` | 咖啡 ASCII + `Coffee initialized.` / `Productivity +10` | 可保留，或改成你的说法 |
| `FUN.sudoHire` | `[sudo] password for recruiter:` → `Access granted.` → 引导到 `contact/links.md` | 改成你自己的语气 |
| `FUN.fortunes` | 3 句名言 + 1 条占位 | 换成你喜欢的句子（2–5 条） |

## I. 站点级（可选）

- `sitemap.xml` 的 `<lastmod>`（内容更新后同步）
- `assets/og.png` 分享图（现为通用占位图，可换成真实品牌图）
- `favicon.svg` / `favicon.ico` / `apple-touch-icon.png`（现为简单终端图形）

---

## 建议提供顺序

1. **A（neofetch 档案）** —— 首屏展示价值最高
2. **E（contact）** —— 验收要求「3 次命令内找到联系方式」
3. **B（about）** —— 让别人了解你是谁
4. **C（projects）** —— 体现技术能力
5. **F（简历）**
6. **D（博客）**
