// ============================================================
//  taskbar.js — 任务栏 + 开始菜单（仅桌面端）
//  硬规则（docs 1.3.1）：≤640px **完全不渲染**，不产生不可达 UI。
//  菜单项只调用终端命令或已有设置，不维护第二套内容系统。
// ============================================================
import { entryCommands } from './desktop.js';

export const TASKBAR_MIN_WIDTH = 641;

// 纯函数：开始菜单结构（Explore / Profile 复用 ENTRIES 映射）
export function buildMenu(entries) {
  const byId = new Map(entries.map((e) => [e.id, e]));
  const item = (id) => {
    const e = byId.get(id);
    return e ? { label: e.label, type: 'entry', entry: e } : null;
  };
  const group = (title, items) => ({ title, items: items.filter(Boolean) });
  return [
    group('Explore', [item('about'), item('projects'), item('blog')]),
    group('Profile', [
      { label: 'neofetch', type: 'command', value: 'neofetch' },
      item('resume'),
      item('contact'),
    ]),
    group('Settings', [
      { label: 'Motion', type: 'setting', value: 'motion' },
      { label: 'Sound', type: 'setting', value: 'sound' },
      { label: 'Theme', type: 'setting', value: 'theme' },
    ]),
    group('Actions', [
      { label: 'Focus Terminal', type: 'action', value: 'focus' },
      { label: 'Reset Desktop', type: 'action', value: 'reset' },
    ]),
  ];
}

// 纯函数：设置项点击时等价执行的终端命令（切换 / 轮换主题）
export function settingCommands(kind, state = {}) {
  if (kind === 'motion') return [`motion ${state.motionOff ? 'on' : 'off'}`];
  if (kind === 'sound') return [`sound ${state.soundOn ? 'off' : 'on'}`];
  if (kind === 'theme') {
    const order = state.themes || [];
    if (order.length === 0) return [];
    const i = order.indexOf(state.theme);
    return [`theme ${order[(i + 1) % order.length]}`];
  }
  return [];
}

// 纯函数：一个菜单项等价执行的终端命令（action 由调用方处理）
export function itemCommands(item, state = {}) {
  if (!item) return [];
  if (item.type === 'entry') return entryCommands(item.entry);
  if (item.type === 'command') return [item.value];
  if (item.type === 'setting') return settingCommands(item.value, state);
  return [];
}

export function initTaskbar(el, opts = {}) {
  const { menu = [], onRun, onAction, onWindowClick } = opts;
  const api = {
    setCwd() {}, setWindowState() {}, openMenu() {}, closeMenu() {},
    toggleMenu() {}, isMenuOpen: () => false,
  };
  if (!el) return api;

  const mq = window.matchMedia(`(min-width: ${TASKBAR_MIN_WIDTH}px)`);
  let mounted = false;
  let open = false;

  const startBtn = document.createElement('button');
  startBtn.type = 'button';
  startBtn.className = 'taskbar-start';
  startBtn.textContent = '❯ Start';
  startBtn.setAttribute('aria-haspopup', 'menu');
  startBtn.setAttribute('aria-expanded', 'false');
  startBtn.setAttribute('aria-label', '打开开始菜单');

  const winBtn = document.createElement('button');
  winBtn.type = 'button';
  winBtn.className = 'taskbar-window';
  winBtn.textContent = 'terminal';
  winBtn.setAttribute('aria-label', '终端窗口');

  const cwdEl = document.createElement('span');
  cwdEl.className = 'taskbar-cwd';
  cwdEl.textContent = '/';
  cwdEl.setAttribute('aria-label', '当前目录');

  const menuEl = document.createElement('div');
  menuEl.className = 'start-menu';
  menuEl.setAttribute('role', 'menu');
  menuEl.hidden = true;

  function renderMenu() {
    menuEl.innerHTML = '';
    for (const group of menu) {
      const sec = document.createElement('div');
      sec.className = 'start-menu-group';
      const title = document.createElement('div');
      title.className = 'start-menu-title';
      title.textContent = group.title;
      sec.appendChild(title);
      for (const item of group.items) {
        const btn = document.createElement('button');
        btn.type = 'button';
        btn.className = 'start-menu-item';
        btn.setAttribute('role', 'menuitem');
        btn.textContent = item.label;
        btn.addEventListener('click', () => activate(item));
        sec.appendChild(btn);
      }
      menuEl.appendChild(sec);
    }
  }

  function activate(item) {
    api.closeMenu();
    if (!item) return;
    if (item.type === 'action') {
      if (typeof onAction === 'function') onAction(item.value);
      return;
    }
    if (typeof onRun === 'function') onRun(item);
  }

  function items() {
    return [...menuEl.querySelectorAll('.start-menu-item')];
  }

  api.openMenu = () => {
    if (!mounted) return;
    open = true;
    menuEl.hidden = false;
    startBtn.setAttribute('aria-expanded', 'true');
    const first = items()[0];
    if (first) first.focus();
  };
  api.closeMenu = () => {
    open = false;
    menuEl.hidden = true;
    startBtn.setAttribute('aria-expanded', 'false');
  };
  api.toggleMenu = () => (open ? api.closeMenu() : api.openMenu());
  api.isMenuOpen = () => open;

  api.setCwd = (path) => { cwdEl.textContent = path || '/'; };
  api.setWindowState = (state = {}) => {
    const label = state.minimized ? 'terminal · minimized'
      : state.maximized ? 'terminal · maximized' : 'terminal';
    winBtn.textContent = label;
    winBtn.classList.toggle('is-minimized', !!state.minimized);
  };

  // ---- events ----
  startBtn.addEventListener('click', (e) => { e.stopPropagation(); api.toggleMenu(); });
  winBtn.addEventListener('click', () => { if (typeof onWindowClick === 'function') onWindowClick(); });

  menuEl.addEventListener('keydown', (e) => {
    const list = items();
    const i = list.indexOf(document.activeElement);
    if (e.key === 'ArrowDown') { e.preventDefault(); list[(i + 1) % list.length]?.focus(); }
    else if (e.key === 'ArrowUp') { e.preventDefault(); list[(i - 1 + list.length) % list.length]?.focus(); }
    else if (e.key === 'Escape') { e.preventDefault(); api.closeMenu(); startBtn.focus(); }
    else if (e.key === 'Tab') { api.closeMenu(); }
  });
  menuEl.addEventListener('click', (e) => e.stopPropagation());
  document.addEventListener('click', () => api.closeMenu());

  function mount() {
    renderMenu();
    el.append(startBtn, winBtn, cwdEl, menuEl);
    mounted = true;
  }
  function unmount() {
    el.innerHTML = '';
    menuEl.hidden = true;
    open = false;
    mounted = false;
  }
  function apply() {
    if (mq.matches) { if (!mounted) mount(); }
    else if (mounted) unmount();
  }

  const onMq = () => apply();
  if (mq.addEventListener) mq.addEventListener('change', onMq);
  else if (mq.addListener) mq.addListener(onMq);
  apply();

  return api;
}
