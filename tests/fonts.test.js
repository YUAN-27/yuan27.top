import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const root = path.resolve(fileURLToPath(new URL('..', import.meta.url)));
const css = readFileSync(path.join(root, 'css/theme.css'), 'utf8');

test('theme.css declares the symbol subset (fixes box-drawing misalignment)', () => {
  assert.match(css, /jetbrains-mono-symbols-400\.woff2/, '缺少 400 符号子集');
  assert.match(css, /jetbrains-mono-symbols-700\.woff2/, '缺少 700 符号子集');
  const ranges = [...css.matchAll(/unicode-range:\s*([^;]+);/g)].map((m) => m[1].replace(/\s/g, ''));
  assert.ok(ranges.some((r) => r.includes('U+2500-257F')), '缺少制表符范围 U+2500-257F');
  assert.ok(ranges.some((r) => r.includes('U+2588')), '缺少方块 U+2588');
  assert.ok(ranges.some((r) => r.includes('U+276F')), '缺少提示符 U+276F');
  assert.ok(ranges.some((r) => r.includes('U+2192')), '缺少箭头 U+2192');
});

test('theme.css latin faces declare a non-overlapping unicode-range', () => {
  const latinFaces = css.split('@font-face').filter((b) => b.includes('latin-400') || b.includes('latin-700'));
  assert.equal(latinFaces.length, 2);
  for (const face of latinFaces) {
    assert.match(face, /unicode-range:/, 'latin face 需要显式 unicode-range');
  }
  // latin 子集不应覆盖制表符区间，否则与符号子集冲突
  for (const face of latinFaces) {
    const range = face.match(/unicode-range:\s*([^;]+);/)[1];
    assert.ok(!range.includes('2500'), 'latin face 不应包含 U+2500 区间');
  }
});

test('every self-hosted font file referenced by theme.css exists', () => {
  const refs = [...css.matchAll(/url\('\.\.\/fonts\/([^']+)'\)/g)].map((m) => m[1]);
  assert.ok(refs.length >= 4, `引用的字体文件过少: ${refs.length}`);
  for (const file of refs) {
    assert.ok(existsSync(path.join(root, 'fonts', file)), `缺少字体文件: ${file}`);
  }
});
