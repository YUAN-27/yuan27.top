// Application entry: startup animation, input handling, command dispatch.
import { Terminal } from './terminal.js';
import { History } from './history.js';
import { complete } from './completion.js';
import { initTheme, getThemes, currentTheme } from './themes.js';
import { resolve as resolvePath } from './fs.js';
import { LOGO, WELCOME, BOOT_LINES, ENTRIES, frameLogo } from './content.js';
import { initDesktop, makeOpener, DESKTOP_RAIL_WIDTH } from './desktop.js';
import { initTaskbar, buildMenu, itemCommands } from './taskbar.js';
import { commands, commandNames, suggestCommand } from './commands.js';
import { parse } from './parser.js';
import { enableWindow } from './windowing.js';
import { initBackground } from './background.js';
import { initSound } from './sound.js';

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
inputEl.addEventListener('keydown', (e) => {
  // 输入音效（默认关闭；只在真实按键时发声）
  if (e.key === 'Enter') sound.enter();
  else if (e.key.length === 1 || e.key === 'Backspace') sound.key();

  if (e.key === 'Enter') {
    e.preventDefault();
    submitLine(inputEl.value);
  } else if (e.key === 'ArrowUp') {
    e.preventDefault();
    inputEl.value = history.up(inputEl.value);
    syncInputSize();
  } else if (e.key === 'ArrowDown') {
    e.preventDefault();
    inputEl.value = history.down();
    syncInputSize();
  } else if (e.key === 'Tab') {
    e.preventDefault();
    const r = complete(inputEl.value, shell.cwd, commandNames);
    if (r) {
      if (r.replace) {
        inputEl.value = r.replace;
        syncInputSize();
      } else if (r.list) {
        term.appendHint(r.list.join('   '));
      }
    }
  } else if (e.key === 'Escape') {
    inputEl.value = '';
    syncInputSize();
  } else if (e.key === 'ArrowLeft' || e.key === 'ArrowRight') {
    // Keep the caret at the end so the block cursor stays predictable.
    e.preventDefault();
  }
});

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
    if (action === 'focus') {
      if (win.isMinimized()) win.unminimize();
      win.reset();
      inputEl.focus();
    } else if (action === 'reset') {
      win.reset();
      submitLine('motion on');
      submitLine('theme claude');
      inputEl.focus();
    }
  },
  onWindowClick() {
    if (win.isMinimized()) win.unminimize();
    else inputEl.focus();
  },
});
taskbar.setCwd(shell.cwd);
taskbar.setWindowState(win.getState());

// ---- desktop background: low-distraction ambient layer (auto-degrades) ----
shell.background = initBackground();

// ---- typing sound (默认关闭，`sound on` 开启) ----
shell.sound = initSound();

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

// ---- boot sequence ----
async function boot() {
  initTheme();
  startClock();

  const logoLines = frameLogo(LOGO);
  // 每次进入（含刷新）都逐行打印；点击/按键可跳过
  const d = (ms) => (skipBoot ? 0 : ms);

  await term.printText(BOOT_LINES, { className: 'line-muted', lineDelay: d(150) });
  await term.printText([''], { lineDelay: 0 });
  await term.printText(logoLines, { className: 'logo', lineDelay: d(70) });
  await term.printText([''], { lineDelay: 0 });
  await term.printText(WELCOME, { lineDelay: d(120) });
  await term.printText([''], { lineDelay: 0 });

  booting = false;

  // Avoid popping the mobile keyboard on load.
  if (window.matchMedia('(min-width: 640px)').matches) inputEl.focus();
}

boot();
