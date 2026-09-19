// ============================================================
//  desktop.js — 桌面快捷图标（仅桌面端）
//  硬规则（docs 1.3.1）：桌面线只服务桌面端。≤breakpoint 时 **完全不渲染**，
//  不产生"存在但不可达"的界面元素。图标只负责唤起终端，不做第二套内容系统。
// ============================================================

// 必须与 css/style.css 保持一致：桌面端 = `@media (min-width: 641px)`，
// 移动端 = `@media (max-width: 640px)`。
export const DESKTOP_MIN_WIDTH = 641;

// 双击判定窗口（毫秒）。不依赖 dblclick 事件，避免焦点变动导致丢失。
export const DOUBLE_CLICK_MS = 500;

const ICONS = {
  folder:
    '<svg viewBox="0 0 16 16" width="18" height="18" aria-hidden="true">' +
    '<rect x="1.5" y="4" width="13" height="9" rx="1.5" fill="currentColor" opacity="0.85"/>' +
    '<rect x="1.5" y="2.5" width="6" height="3" rx="1.2" fill="currentColor"/></svg>',
  file:
    '<svg viewBox="0 0 16 16" width="18" height="18" aria-hidden="true">' +
    '<rect x="3" y="2" width="10" height="12" rx="1.6" fill="currentColor" opacity="0.85"/></svg>',
  doc:
    '<svg viewBox="0 0 16 16" width="18" height="18" aria-hidden="true">' +
    '<rect x="3" y="2" width="10" height="12" rx="1.6" fill="none" stroke="currentColor" stroke-width="1.4"/>' +
    '<path d="M5.6 6.2h4.8M5.6 8.6h4.8M5.6 11h3" stroke="currentColor" stroke-width="1.2" stroke-linecap="round"/></svg>',
};

// 纯函数：一个入口在终端里等价执行哪些命令（便于测试）。
export function entryCommands(entry) {
  if (entry.command) return [entry.command];
  if (entry.path) return [`cd ${entry.path}`, 'ls'];
  return [];
}

export function initDesktop(el, entries, opts = {}) {
  const { open, refocus, breakpoint = DESKTOP_MIN_WIDTH } = opts;
  if (!el) return { select() {}, destroy() {} };

  // 与 CSS 一致：≥641px 才渲染（移动端完全不渲染）
  const mq = window.matchMedia(`(min-width: ${breakpoint}px)`);
  let mounted = false;

  function select(id) {
    el.querySelectorAll('.desktop-icon').forEach((b) => {
      const on = b.dataset.id === id;
      b.classList.toggle('selected', on);
      b.setAttribute('aria-pressed', String(on));
    });
  }

  function render() {
    el.innerHTML = '';
    for (const entry of entries) {
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'desktop-icon';
      btn.dataset.id = entry.id;
      btn.setAttribute('aria-pressed', 'false');
      btn.setAttribute('aria-label', `打开 ${entry.label}`);
      btn.innerHTML =
        `<span class="desktop-icon-glyph">${ICONS[entry.kind] || ICONS.file}</span>` +
        `<span class="desktop-icon-label">${entry.label}</span>`;
      let lastClick = 0;
      btn.addEventListener('click', (e) => {
        if (e.detail === 0) { // 键盘触发的 click（Enter / Space）
          if (typeof open === 'function') open(entry);
          return;
        }
        // 自己判定双击：click 里 refocus() 改变焦点后，某些浏览器不再派发 dblclick
        const now = Date.now();
        if (now - lastClick < DOUBLE_CLICK_MS) {
          lastClick = 0;
          if (typeof open === 'function') open(entry);
          return;
        }
        lastClick = now;
        select(entry.id); // 鼠标单击 = 选中，且不抢走终端输入焦点
        if (typeof refocus === 'function') refocus();
      });
      el.appendChild(btn);
    }
    mounted = true;
  }

  function apply() {
    if (mq.matches) {
      if (!mounted) render();
    } else {
      // 移动端：不渲染任何桌面入口
      if (mounted) { el.innerHTML = ''; mounted = false; }
    }
  }

  function onDocClick(e) {
    if (!mq.matches) return;
    if (!el.contains(e.target)) select(null);
  }
  document.addEventListener('click', onDocClick);

  const onMq = () => apply();
  if (mq.addEventListener) mq.addEventListener('change', onMq);
  else if (mq.addListener) mq.addListener(onMq);

  apply();

  return {
    select,
    destroy() {
      document.removeEventListener('click', onDocClick);
      if (mq.removeEventListener) mq.removeEventListener('change', onMq);
      el.innerHTML = '';
      mounted = false;
    },
  };
}
