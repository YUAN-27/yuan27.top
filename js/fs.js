// Virtual File System operations (pure logic, no DOM — unit-testable).
import { FS } from './content.js';

// Normalize an absolute path: collapse '.', resolve '..', ensure leading '/'.
export function normalize(path) {
  const parts = [];
  for (const seg of path.split('/')) {
    if (seg === '' || seg === '.') continue;
    if (seg === '..') {
      if (parts.length) parts.pop();
      continue;
    }
    parts.push(seg);
  }
  return '/' + parts.join('/');
}

// Resolve a (possibly relative) path against the current working directory.
export function resolve(cwd, path) {
  let p = (path ?? '').trim();
  if (p === '' || p === '.') return cwd;
  if (p === '~') return '/';
  if (p.startsWith('~/')) p = p.slice(1);
  if (p.startsWith('/')) return normalize(p);
  return normalize((cwd === '/' ? '' : cwd) + '/' + p);
}

// Look up a node by absolute path; returns null when missing.
export function getNode(path) {
  const parts = path.split('/').filter(Boolean);
  let node = FS;
  for (const p of parts) {
    if (node.type !== 'dir' || !node.children) return null;
    node = node.children[p];
    if (node === undefined) return null;
  }
  return node;
}

// Sorted entry names of a directory; returns null when not a dir.
export function listDir(path) {
  const node = getNode(path);
  if (!node || node.type !== 'dir') return null;
  return Object.keys(node.children).sort();
}
