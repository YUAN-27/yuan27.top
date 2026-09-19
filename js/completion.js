// Tab completion for command names and paths.
import { getNode, resolve as resolvePath } from './fs.js';

function commonPrefix(strings) {
  if (!strings.length) return '';
  let p = strings[0];
  for (const s of strings) {
    while (!s.startsWith(p)) p = p.slice(0, -1);
    if (p === '') break;
  }
  return p;
}

// Returns:
//   null                       nothing to complete
//   { replace: 'new input' }   a unique completion
//   { list: ['a', 'b/'] }      multiple matches (dirs already have trailing '/')
export function complete(input, cwd, commandNames) {
  if (input === '') return null;

  const trailingSpace = /\s$/.test(input);
  const tokens = input.split(/\s+/).filter(Boolean);
  if (tokens.length === 0) return null;

  const lastToken = trailingSpace ? '' : tokens[tokens.length - 1];

  // --- command completion (first word) ---
  if (tokens.length === 1 && !trailingSpace) {
    const matches = commandNames.filter((c) => c.startsWith(lastToken)).sort();
    if (matches.length === 0) return null;
    if (matches.length === 1) return { replace: matches[0] + ' ' };
    return { list: matches };
  }

  // --- path completion ---
  const prefix = lastToken;
  const replaceStart = input.length - prefix.length;

  let searchDirPath;
  let base;
  if (prefix === '') {
    searchDirPath = cwd;
    base = '';
  } else {
    const idx = prefix.lastIndexOf('/');
    const dirPart = idx >= 0 ? prefix.slice(0, idx + 1) : '';
    base = idx >= 0 ? prefix.slice(idx + 1) : prefix;
    searchDirPath = resolvePath(cwd, dirPart || '.');
  }

  const dirNode = getNode(searchDirPath);
  if (!dirNode || dirNode.type !== 'dir') return null;

  const names = Object.keys(dirNode.children)
    .filter((n) => (!n.startsWith('.') || base.startsWith('.')) && n.startsWith(base))
    .sort();

  if (names.length === 0) return null;

  if (names.length === 1) {
    const child = dirNode.children[names[0]];
    const completion = child.type === 'dir' ? names[0] + '/' : names[0] + ' ';
    return { replace: input.slice(0, replaceStart) + completion };
  }

  // Multiple matches: extend the common prefix if possible, else list them.
  const cp = commonPrefix(names);
  if (cp.length > base.length) {
    return { replace: input.slice(0, replaceStart) + cp };
  }
  return {
    list: names.map((n) => (dirNode.children[n].type === 'dir' ? n + '/' : n)),
  };
}
