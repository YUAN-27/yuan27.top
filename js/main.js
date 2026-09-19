// Application entry: startup animation, input handling, command dispatch.
import { Terminal } from './terminal.js';
import { History } from './history.js';
import { complete } from './completion.js';
import { initTheme } from './themes.js';
import { resolve as resolvePath } from './fs.js';
import { LOGO, WELCOME, BOOT_LINES } from './content.js';
import { commands, commandNames } from './commands.js';
import { parse } from './parser.js';
import { enableWindow } from './windowing.js';

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
      } else {
        await handler(shell, parsed.args);
      }
    }
  }
  running = false;
}

// ---- input events ----
inputEl.addEventListener('keydown', (e) => {
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
const VISITED_KEY = 'yuan27.visited';

// ---- focus & skip ---- 
windowEl.addEventListener('click', () => inputEl.focus());
outputEl.addEventListener('click', () => {
  if (booting) skipBoot = true;
  term.skip = true;
});
window.addEventListener('keydown', () => { if (booting) skipBoot = true; });

// ---- window management: drag / resize / maximize / minimize / reset (desktop only) ----
enableWindow(windowEl, {
  handle: windowEl.querySelector('.statusbar'),
  dock: document.getElementById('window-dock'),
  storageKey: 'yuan27.window.v1',
});

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

  const logoLines = LOGO.split('\n').filter((l) => l.length > 0);
  // 老访客不再播放慢速动画；点击/按键可跳过
  const repeat = (() => { try { return !!localStorage.getItem(VISITED_KEY); } catch { return false; } })();
  const d = (ms) => (repeat || skipBoot ? 0 : ms);

  await term.printText(BOOT_LINES, { className: 'line-muted', lineDelay: d(150) });
  await term.printText([''], { lineDelay: 0 });
  await term.printText(logoLines, { className: 'logo', lineDelay: d(90) });
  await term.printText([''], { lineDelay: 0 });
  await term.printText(WELCOME, { lineDelay: 0 });
  await term.printText([''], { lineDelay: 0 });

  booting = false;
  try { localStorage.setItem(VISITED_KEY, '1'); } catch { /* ignore */ }

  // Avoid popping the mobile keyboard on load.
  if (window.matchMedia('(min-width: 640px)').matches) inputEl.focus();
}

boot();
