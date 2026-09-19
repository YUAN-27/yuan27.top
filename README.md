# YUAN27.top

一个以 Unix Terminal 为交互界面的个人 Portfolio / Blog。
纯 HTML + CSS + 原生 JS（ES Modules），**无框架、无构建工具**。

## 功能

- 虚拟文件系统（`about/`、`projects/`、`blog/`、`resume/`、`contact/`）
- 命令：`ls` `cd` `pwd` `cat` `open` `tree` `help` `clear` `history` `whoami` `theme`
- Tab 自动补全、↑/↓ 命令历史、逐行(40ms)/逐字(12ms)打字效果、多主题切换
- 响应式（移动端全屏 + 快捷命令按钮）、`prefers-reduced-motion`、基础 SEO / a11y

## 目录结构

```
index.html
css/        theme.css, style.css
js/         main.js content.js fs.js parser.js commands.js terminal.js completion.js history.js themes.js
fonts/      JetBrains Mono（自托管）
assets/     resume.pdf, og.svg, og.png
docs/       设计与部署文档
tests/      node:test 单元测试
```

## 本地预览

```bash
python3 -m http.server 8765
# 浏览器打开 http://localhost:8765
```

## 测试

```bash
node --test tests/*.test.js
```

## 修改内容

站点内容集中在 `js/content.js`（搜索「替换此处」）。改完无需构建，刷新即可。

## 部署

纯静态文件，拷贝到 Web 根目录即可。详见 `docs/`。
