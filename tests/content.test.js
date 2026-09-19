import test from 'node:test';
import assert from 'node:assert/strict';
import { LOGO, frameLogo } from '../js/content.js';

test('frameLogo: boxes every line to the same width', () => {
  const out = frameLogo(LOGO);
  assert.ok(out.length >= 3, '至少有上边框 + 内容 + 下边框');
  const widths = new Set(out.map((l) => l.length));
  assert.equal(widths.size, 1, `行宽不一致: ${[...widths].join(',')}`);
  assert.ok(out[0].startsWith('╔') && out[0].endsWith('╗'), '上边框');
  assert.ok(out.at(-1).startsWith('╚') && out.at(-1).endsWith('╝'), '下边框');
  for (const line of out.slice(1, -1)) {
    assert.ok(line.startsWith('║') && line.endsWith('║'), `侧边框: ${line}`);
  }
});

test('frameLogo: keeps the art intact inside the frame', () => {
  const art = LOGO.split('\n').filter((l) => l.length > 0);
  const body = frameLogo(LOGO).slice(1, -1);
  assert.equal(body.length, art.length);
  body.forEach((line, i) => {
    assert.ok(line.includes(art[i].trimEnd()), `第 ${i} 行内容丢失`);
  });
});

test('frameLogo: empty input -> empty output', () => {
  assert.deepEqual(frameLogo(''), []);
  assert.deepEqual(frameLogo('\n\n'), []);
});

test('frameLogo: width still fits the narrowest phones with the mobile font clamp', () => {
  const chars = frameLogo(LOGO)[0].length;
  assert.equal(chars, 58, `边框后应为 58 字符，实际 ${chars}`);
  // 移动端字号 = min(10px, (100vw - 24px) / 36)；JetBrains Mono 字宽 = 0.6em
  const content = (w) => w - 24; // output 左右 padding 12px
  for (const vw of [320, 360, 375, 390, 414]) {
    const font = Math.min(10, content(vw) / 36);
    const width = chars * 0.6 * font;
    assert.ok(width <= content(vw), `${vw}px 下溢出: ${width} > ${content(vw)}`);
  }
});
