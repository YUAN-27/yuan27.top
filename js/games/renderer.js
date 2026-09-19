// ============================================================
//  games/renderer.js — 字符网格视图层（纯函数，不碰 DOM）
//
//  字体是子集化的：只有 ASCII + U+2500–257F + U+2588 + U+2192 + U+276F
//  在 css/theme.css 的 unicode-range 里。任何其它字符会掉进回退字体，
//  advance width 改变 → 整个网格错位。所以有 CHAR_RANGES 白名单 + 测试。
// ============================================================

export const CHAR_RANGES = [
  [0x20, 0x7e],     // ASCII
  [0x2192, 0x2192], // →
  [0x2500, 0x257f], // 制表符
  [0x2588, 0x2588], // █
  [0x276f, 0x276f], // ❯
];

export const glyphs = {
  // 原版 Pong（1972）的球与挡板都是矩形，所以这里用实心块 + 坚线，形状靠长度区分。
  // 避坑记录：不要用 'O'（菜单 'PONG'、'GAME OVER' 里有大写 O，会与球混淆），
  // 也不要用 '*'（小字号下辨识度差）。'█'(U+2588) 与 '┃'(U+2503) 均在字体子集内且宽度 600。
  ball: '█',
  paddle: '┃',
  tl: '┌', tr: '┐', bl: '└', br: '┘',
  h: '─', v: '│', vl: '├', vr: '┤',
};

export function isAllowedChar(ch) {
  const c = ch.codePointAt(0);
  return CHAR_RANGES.some(([a, b]) => c >= a && c <= b);
}

export function withinWhitelist(grid) {
  for (const row of grid) for (const ch of row) if (!isAllowedChar(ch)) return false;
  return true;
}

export function blankGrid(cols, rows) {
  const w = Math.max(1, Math.floor(cols));
  const h = Math.max(1, Math.floor(rows));
  return Array.from({ length: h }, () => ' '.repeat(w));
}

// 原地写入；越界自动裁剪，行宽永远不变
export function blit(grid, x, y, text) {
  if (y < 0 || y >= grid.length) return grid;
  const w = grid[y].length;
  if (x >= w || x + text.length <= 0) return grid;
  const start = Math.max(0, x);
  const skip = start - x;
  const t = text.slice(skip, skip + (w - start));
  if (!t) return grid;
  grid[y] = grid[y].slice(0, start) + t + grid[y].slice(start + t.length);
  return grid;
}

export function box(grid, x, y, w, h, g = glyphs) {
  if (w < 2 || h < 2) return grid;
  blit(grid, x, y, g.tl + g.h.repeat(w - 2) + g.tr);
  for (let i = 1; i < h - 1; i++) blit(grid, x, y + i, g.v + ' '.repeat(w - 2) + g.v);
  blit(grid, x, y + h - 1, g.bl + g.h.repeat(w - 2) + g.br);
  return grid;
}

export const GRID_MIN = { cols: 40, rows: 12 };
export const GRID_MAX = { cols: 120, rows: 40 };

export function layoutFor(cols, rows) {
  const c = Math.min(GRID_MAX.cols, Math.max(GRID_MIN.cols, Math.floor(cols)));
  const r = Math.min(GRID_MAX.rows, Math.max(GRID_MIN.rows, Math.floor(rows)));
  // 结构: 0 上边框 / 1 标题 / 2 分隔 / 3 比分 / 4..r-5 场内 / r-4 分隔 / r-3 底栏 / r-2 ? / r-1 下边框
  const scoreRow = 3;
  const fieldTop = 4;
  const fieldBottom = r - 2;      // 底栏是 DOM 元素（.game-footer），网格内不再预留底栏行
  return {
    cols: c,
    rows: r,
    scoreRow,
    fieldTop,
    fieldBottom,
    fieldRows: fieldBottom - fieldTop + 1,
    innerW: c - 2,
    cx: Math.floor(c / 2),
  };
}

// 静态层：只在初始化 / resize 时重建
export function buildFrame({ title = '', cols = 80, rows = 24 } = {}) {
  const layout = layoutFor(cols, rows);
  const { cols: c, rows: r } = layout;
  const grid = blankGrid(c, r);

  box(grid, 0, 0, c, r);
  blit(grid, 1, 1, String(title).slice(0, c - 2));
  blit(grid, 0, 2, glyphs.vl + glyphs.h.repeat(c - 2) + glyphs.vr);

  // 虚线中线：隔行画一个 │（不用 U+250A，保证子集内字形一定存在）
  for (let y = layout.fieldTop; y <= layout.fieldBottom; y++) {
    if ((y - layout.fieldTop) % 2 === 0) blit(grid, layout.cx, y, glyphs.v);
  }

  return { grid, layout };
}

export function gridToString(grid) { return grid.slice(); }

export function diffRows(prev, next) {
  const out = [];
  const n = Math.max(prev.length, next.length);
  for (let i = 0; i < n; i++) if (prev[i] !== next[i]) out.push(i);
  return out;
}
