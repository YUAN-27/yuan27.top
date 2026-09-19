// Application entry: startup animation, input handling, command dispatch.
import { Terminal } from './terminal.js';
import { History } from './history.js';
import { complete } from './completion.js';
import { initTheme, getThemes, currentTheme } from './themes.js';
import { resolve as resolvePath } from './fs.js';
import { WELCOME, BOOT_LINES, ENTRIES, WORDMARK_HTML, BRAND_NOTE } from './content.js';
import { initDesktop, makeOpener, DESKTOP_RAIL_WIDTH } from './desktop.js';
import { initTaskbar, buildMenu, itemCommands } from './taskbar.js';
import { makeKeyHandler } from './keys.js';
import { commands, commandNames, suggestCommand } from './commands.js';
import { parse } from './parser.js';
import { enableWindow } from './windowing.js';
import { initBackground } from './background.js';
import { initSound } from './sound.js';
import { createSession } from './games/session.js';
import { createHost } from './games/host.js';

const outputEl = document.getElementById('output');
const inputEl = document.getElementById('cmd-input');
const clockEl = document.getElementById('clock');
const windowEl = document.getElementById('terminal-window');

const term = new Terminal(outputEl);
const history = new History();

// The shell object handed to every command handler.
const shell = {
  cwd: '/',
  term,
  history,
  resolve(path) { return resolvePath(this.cwd, path); },
  setCwd(path) { this.cwd = path; },
  error(msg) { return this.term.printText([msg], { className: 'line-error', lineDelay: 0 }); },
  success(msg) { return this.term.printText([msg], { className: 'line-success', lineDelay: 0 }); },
  muted(msg) { return this.term.printText([msg], { className: 'line-muted', lineDelay: 0 }); },
  printLines(lines, opts) { return this.term.printLines(lines, opts); },
  printText(lines, opts) { return this.term.printText(lines, opts); },
  printChars(text, opts) { return this.term.printChars(text, opts); },
};

function syncInputSize() {
  const len = inputEl.value.length;
  inputEl.style.width = Math.max(len, 1) + 'ch';
}

// Serialized command execution: one command at a time, in order.
let taskbar = null;
let sound = null;
let running = false;
const pending = [];

function submitLine(line) {
  inputEl.value = '';
  syncInputSize();
  pending.push(line);
  if (!running) drain();
}

async function drain() {
  running = true;
  while (pending.length) {
    const line = pending.shift();
    term.skip = false;
    term.echo(line);

    const trimmed = line.trim();
    if (trimmed) history.add(trimmed);

    const parsed = parse(line);
    if (parsed) {
      const handler = commands[parsed.command];
      if (!handler) {
        await shell.error(`${parsed.command}: command not found`);
        const s = suggestCommand(parsed.command);
        if (s) await shell.muted(`Did you mean '${s}'?  Try 'help'.`);
      } else {
        await handler(shell, parsed.args);
      }
      if (taskbar) taskbar.setCwd(shell.cwd);
    }
  }
  running = false;
}

// ---- input events ----
inputEl.addEventListener('keydown', makeKeyHandler({
  input: inputEl,
  submit: submitLine,
  history,
  complete,
  commandNames,
  getCwd: () => shell.cwd,
  appendHint: (text) => term.appendHint(text),
  afterInput: syncInputSize,
  onKey: (e) => {
    if (!sound) return;
    if (e.key === 'Enter') sound.enter();
    else if (e.key.length === 1 || e.key === 'Backspace') sound.key();
  },
}));

inputEl.addEventListener('input', syncInputSize);

// ---- boot / skip state ----
let booting = true;
let skipBoot = false;

// ---- focus & skip ---- 
windowEl.addEventListener('click', () => inputEl.focus());
outputEl.addEventListener('click', () => {
  if (booting) skipBoot = true;
  term.skip = true;
});
window.addEventListener('keydown', () => { if (booting) skipBoot = true; });

// ---- window management: drag / resize / maximize / minimize / reset (desktop only) ----
const win = enableWindow(windowEl, {
  handle: windowEl.querySelector('.statusbar'),
  storageKey: 'yuan27.window.v2',
  minLeft: DESKTOP_RAIL_WIDTH,
  onStateChange: (s) => { if (taskbar) taskbar.setWindowState(s); },
});

const runEntry = makeOpener({
  restore: () => { if (win.isMinimized()) win.unminimize(); },
  focus: () => inputEl.focus(),
  run: (cmd) => submitLine(cmd),
});

// ---- desktop shortcuts: 仅桌面端渲染（docs 1.3.1 硬规则）；只负责唤起终端 ----
initDesktop(document.getElementById('desktop'), ENTRIES, {
  open: runEntry,
  refocus() { inputEl.focus(); },
});

// ---- taskbar + start menu（仅桌面端；菜单项只调用终端命令或已有设置）----
function menuState() {
  return {
    motionOff: shell.background ? shell.background.isMotionOff() : false,
    soundOn: shell.sound ? shell.sound.isEnabled() : false,
    themes: getThemes(),
    theme: currentTheme(),
  };
}

taskbar = initTaskbar(document.getElementById('taskbar'), {
  menu: buildMenu(ENTRIES),
  onRun(item) {
    for (const cmd of itemCommands(item, menuState())) submitLine(cmd);
  },
  onAction(action) {
    if (action === 'open') {
      openTerminalFresh();
    } else if (action === 'focus') {
      if (win.getState().closed) win.reopen();
      if (win.isMinimized()) win.unminimize();
      win.reset();
      inputEl.focus();
    } else if (action === 'reset') {
      if (win.getState().closed) win.reopen();
      win.reset();
      submitLine('motion on');
      submitLine('theme claude');
      inputEl.focus();
    }
  },
  onWindowClick() {
    if (win.getState().closed) openTerminalFresh();
    else if (win.isMinimized()) win.unminimize();
    else inputEl.focus();
  },
});
taskbar.setCwd(shell.cwd);
taskbar.setWindowState(win.getState());

// ---- desktop background: low-distraction ambient layer (auto-degrades) ----
shell.background = initBackground();

// ---- typing sound (默认关闭，`sound on` 开启) ----
sound = initSound();
shell.sound = sound;

// ---- terminal arcade: 宿主能力注入（games/arcade.js 不碰 DOM，由装配层这里提供）----
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

// ---- mobile quick buttons ----
document.querySelectorAll('.mobile-toolbar button').forEach((btn) => {
  btn.addEventListener('click', () => submitLine(btn.dataset.cmd));
});

// ---- status bar clock ----
function startClock() {
  const tick = () => {
    const now = new Date();
    const hh = String(now.getHours()).padStart(2, '0');
    const mm = String(now.getMinutes()).padStart(2, '0');
    const ss = String(now.getSeconds()).padStart(2, '0');
    clockEl.textContent = `⏱ ${hh}:${mm}:${ss}`;
  };
  tick();
  setInterval(tick, 1000);
}

// ---- boot screen（可重复播放：重新打开终端时也会走这里）----
async function printBootScreen() {
  // 每次进入（含刷新/重开）都逐行打印；点击/按键可跳过
  const d = (ms) => (skipBoot ? 0 : ms);

  await term.printText(BOOT_LINES, { className: 'line-muted', lineDelay: d(150) });
  await term.printText([''], { lineDelay: 0 });
  // 站点字标：❯ whoami → YUAN27（与 og.png 同款表现）
  term.echo('whoami');
  await term.printLines([WORDMARK_HTML], { className: 'line line-wordmark', lineDelay: 0 });
  await term.printText([BRAND_NOTE], { className: 'line-muted line-wordmark-note', lineDelay: d(60) });
  await term.printText([''], { lineDelay: 0 });
  await term.printText(WELCOME, { lineDelay: d(120) });
  await term.printText([''], { lineDelay: 0 });
}

// 关闭后重新打开 = 全新会话：清屏 + 回根目录 + 重放启动画面（命令历史保留）
async function openTerminalFresh() {
  win.reopen();
  term.clear();
  shell.setCwd('/');
  if (taskbar) taskbar.setCwd('/');
  inputEl.focus();
  await printBootScreen();
}

// ---- boot sequence ----
async function boot() {
  initTheme();
  startClock();

  // 关闭状态下不播放启动动画（重新打开时再播）
  if (!win.getState().closed) await printBootScreen();

  booting = false;

  // Avoid popping the mobile keyboard on load.
  if (window.matchMedia('(min-width: 640px)').matches) inputEl.focus();
}

boot();
