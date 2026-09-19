// Command registry — single source of truth for handlers, help and completion.
// Adding a command = adding one entry here (help + Tab completion pick it up automatically).
import { getNode, resolve as resolvePath } from './fs.js';
import { WHOAMI, PROFILE, NEOFETCH_ART } from './content.js';
import { getThemes, setTheme, currentTheme } from './themes.js';

const escapeHtml = (s) =>
  String(s).replace(/[&<>"']/g, (c) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
  }[c]));

const CATEGORY_ORDER = ['Core', 'Explore', 'Profile', 'Settings', 'Fun'];

function buildHelpLines() {
  const byCat = new Map();
  for (const [name, def] of Object.entries(registry)) {
    if (!byCat.has(def.category)) byCat.set(def.category, []);
    byCat.get(def.category).push([name, def.summary]);
  }
  const lines = ['Available commands:', ''];
  for (const cat of CATEGORY_ORDER) {
    const entries = byCat.get(cat);
    if (!entries || entries.length === 0) continue;
    lines.push(cat);
    for (const [name, summary] of entries) lines.push('  ' + name.padEnd(11) + ' ' + summary);
    lines.push('');
  }
  lines.push('Try: neofetch   tree   cat about/bio.md');
  return lines;
}

export const registry = {
  // ---- Core ----
  help: {
    category: 'Core',
    summary: 'Show available commands',
    help: `help - show available commands

Usage:
    help
    help <command>

Example:
    help cat`,
    async run(shell, args) {
      if (args[0]) {
        const def = registry[args[0]];
        if (!def) return shell.error(`help: ${args[0]}: no help topics match`);
        return shell.printText(def.help.split('\n'), { lineDelay: 15 });
      }
      return shell.printText(buildHelpLines(), { lineDelay: 15 });
    },
  },

  clear: {
    category: 'Core',
    summary: 'Clear terminal',
    help: `clear - clear the screen

Usage:
    clear`,
    run(shell) {
      shell.term.clear();
    },
  },

  tree: {
    category: 'Core',
    summary: 'Show site structure',
    help: `tree - display directory tree

Usage:
    tree [path]

Example:
    tree
    tree projects`,
    async run(shell, args) {
      const target = args[0] ?? '.';
      const path = resolvePath(shell.cwd, target);
      const node = getNode(path);
      if (!node) return shell.error(`tree: ${target}: No such file or directory`);
      if (node.type !== 'dir') return shell.error(`tree: ${target}: Not a directory`);

      const lines = [path];
      const walk = (dir, prefix) => {
        const names = Object.keys(dir.children).sort();
        names.forEach((name, i) => {
          const last = i === names.length - 1;
          const child = dir.children[name];
          const isDir = child.type === 'dir';
          lines.push(`${prefix}${last ? '└── ' : '├── '}${name}${isDir ? '/' : ''}`);
          if (isDir) walk(child, prefix + (last ? '    ' : '│   '));
        });
      };
      walk(node, '');

      return shell.printText(lines, { lineDelay: 30 });
    },
  },

  history: {
    category: 'Core',
    summary: 'Show command history',
    help: `history - show command history

Usage:
    history`,
    async run(shell) {
      const items = shell.history.all();
      if (items.length === 0) return shell.muted('No commands in history.');
      return shell.printText(
        items.map((c, i) => `${String(i + 1).padStart(3)}  ${c}`),
        { lineDelay: 10 },
      );
    },
  },

  // ---- Explore ----
  ls: {
    category: 'Explore',
    summary: 'List directory contents',
    help: `ls - list directory contents

Usage:
    ls [path]

Example:
    ls
    ls projects`,
    async run(shell, args) {
      const target = args[0] ?? '.';
      const path = resolvePath(shell.cwd, target);
      const node = getNode(path);
      if (!node) return shell.error(`ls: ${target}: No such file or directory`);
      if (node.type !== 'dir') return shell.error(`ls: ${target}: Not a directory`);

      const names = Object.keys(node.children).sort();
      if (names.length === 0) return;

      const html = names.map((name) => {
        const child = node.children[name];
        if (child.type === 'dir') {
          return `<span class="dir">${escapeHtml(name)}/</span>`;
        }
        if (child.link) {
          return `<a class="link" href="${escapeHtml(child.url)}" target="_blank" rel="noopener">${escapeHtml(name)}</a> <span class="muted">→ ${escapeHtml(child.url)}</span>`;
        }
        if (child.binary) {
          return `<a class="link" href="${escapeHtml(child.url)}" target="_blank" rel="noopener">${escapeHtml(name)}</a> <span class="muted">(binary)</span>`;
        }
        return `<span>${escapeHtml(name)}</span>`;
      });

      return shell.printLines(html, { lineDelay: 40 });
    },
  },

  cd: {
    category: 'Explore',
    summary: 'Change directory',
    help: `cd - change working directory

Usage:
    cd <dir>      enter directory
    cd ..         go up one level
    cd ~  /  cd / go to root

Example:
    cd about`,
    async run(shell, args) {
      const target = args[0] ?? '~';
      const path = resolvePath(shell.cwd, target);
      const node = getNode(path);
      if (!node) return shell.error(`cd: ${target}: No such file or directory`);
      if (node.type !== 'dir') return shell.error(`cd: ${target}: Not a directory`);
      shell.setCwd(path);
    },
  },

  pwd: {
    category: 'Explore',
    summary: 'Print working directory',
    help: `pwd - print working directory

Usage:
    pwd`,
    async run(shell) {
      return shell.printText([shell.cwd], { lineDelay: 0 });
    },
  },

  cat: {
    category: 'Explore',
    summary: 'Read file',
    help: `cat - print file contents

Usage:
    cat <file> [file...]

Example:
    cat about/bio.md`,
    async run(shell, args) {
      if (args.length === 0) return shell.error('cat: missing file operand');
      for (const arg of args) {
        const path = resolvePath(shell.cwd, arg);
        const node = getNode(path);
        if (!node) {
          await shell.error(`cat: ${arg}: No such file or directory`);
          continue;
        }
        if (node.type === 'dir') {
          await shell.error(`cat: ${arg}: Is a directory`);
          continue;
        }
        if (node.binary) {
          await shell.error(`cat: ${arg}: binary file`);
          await shell.muted("Please use 'open'.");
          continue;
        }
        if (node.link) {
          await shell.printText([`${arg}: link → ${node.url}`], { lineDelay: 0 });
          await shell.muted("Use 'open' to follow.");
          continue;
        }
        await shell.printChars(node.content, { charDelay: 12 });
      }
    },
  },

  open: {
    category: 'Explore',
    summary: 'Open external resource',
    help: `open - open a link or binary file

Usage:
    open <file>

Example:
    open resume/resume.pdf`,
    async run(shell, args) {
      const arg = args[0];
      if (!arg) return shell.error('open: missing file operand');
      const path = resolvePath(shell.cwd, arg);
      const node = getNode(path);
      if (!node) return shell.error(`open: ${arg}: No such file or directory`);
      if (node.link || node.binary) {
        window.open(node.url, '_blank', 'noopener,noreferrer');
        return shell.success(`Opening ${arg} …`);
      }
      return shell.error(`open: ${arg}: not a link or binary file`);
    },
  },

  // ---- Profile ----
  neofetch: {
    category: 'Profile',
    summary: "Show Yuan's profile summary",
    help: `neofetch - show profile summary

Usage:
    neofetch`,
    async run(shell) {
      const p = PROFILE;
      const title = `${p.user}@${p.host}`;
      const info = [
        title,
        '─'.repeat(Math.max(title.length, 20)),
        `Host      ${p.host}`,
        `Role      ${p.role}`,
        `School    ${p.school}`,
        `Focus     ${p.focus}`,
        `Projects  ${p.projects}`,
        `Blog      ${p.blog}`,
        `Status    ${p.status}`,
      ].join('\n');
      const html =
        '<div class="neofetch">' +
        `<pre class="neofetch-art">${escapeHtml(NEOFETCH_ART)}</pre>` +
        `<pre class="neofetch-info">${escapeHtml(info)}</pre>` +
        '</div>';
      return shell.printLines([html], { lineDelay: 0 });
    },
  },

  whoami: {
    category: 'Profile',
    summary: 'About YUAN',
    help: `whoami - about YUAN

Usage:
    whoami`,
    async run(shell) {
      return shell.printText(WHOAMI.split('\n'), { lineDelay: 30 });
    },
  },

  resume: {
    category: 'Profile',
    summary: 'Open resume',
    help: `resume - open resume

Usage:
    resume`,
    async run(shell) {
      return registry.open.run(shell, ['resume/resume.pdf']);
    },
  },

  // ---- Settings ----
  theme: {
    category: 'Settings',
    summary: 'Switch color theme',
    help: `theme - switch color theme

Usage:
    theme          list themes
    theme <name>   apply theme

Example:
    theme matrix`,
    async run(shell, args) {
      const name = args[0];
      if (!name) {
        const list = getThemes()
          .map((t) => (t === currentTheme() ? `→ ${t}` : `  ${t}`))
          .join('\n');
        return shell.printText(['Available themes:', list], { lineDelay: 10 });
      }
      if (!setTheme(name)) return shell.error(`theme: ${name}: theme not found`);
      return shell.success(`Theme set to '${name}'.`);
    },
  },
};

export const commandNames = Object.keys(registry);
export const commands = Object.fromEntries(
  Object.entries(registry).map(([name, def]) => [name, def.run]),
);
