// Command registry + implementations.
import { getNode, resolve as resolvePath } from './fs.js';
import { WHOAMI } from './content.js';
import { getThemes, setTheme, currentTheme } from './themes.js';

const escapeHtml = (s) =>
  String(s).replace(/[&<>"']/g, (c) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
  }[c]));

const GENERAL_HELP = `Available commands:

  ls          list directory contents
  cd <dir>    change directory (cd .. / cd ~ / cd /)
  pwd         print working directory
  cat <file>  print file contents
  open <file> open a link or binary file
  tree        show directory tree
  help [cmd]  show help (help <cmd> for usage)
  clear       clear the screen
  history     show command history
  whoami      about YUAN
  theme <n>   switch color theme (theme to list)

Try: ls  →  cd about  →  cat bio.md`;

const HELP = {
  ls: `ls - list directory contents

Usage:
    ls [path]

Example:
    ls
    ls projects`,
  cd: `cd - change working directory

Usage:
    cd <dir>      enter directory
    cd ..         go up one level
    cd ~  /  cd / go to root

Example:
    cd about`,
  pwd: `pwd - print working directory

Usage:
    pwd`,
  cat: `cat - print file contents

Usage:
    cat <file> [file...]

Example:
    cat about/bio.md`,
  open: `open - open a link or binary file

Usage:
    open <file>

Example:
    open resume/resume.pdf`,
  tree: `tree - display directory tree

Usage:
    tree [path]

Example:
    tree
    tree projects`,
  clear: `clear - clear the screen

Usage:
    clear`,
  history: `history - show command history

Usage:
    history`,
  whoami: `whoami - about YUAN

Usage:
    whoami`,
  theme: `theme - switch color theme

Usage:
    theme          list themes
    theme <name>   apply theme

Example:
    theme matrix`,
};

export const commandNames = [
  'ls', 'cd', 'pwd', 'cat', 'open', 'tree',
  'help', 'clear', 'history', 'whoami', 'theme',
];

export const commands = {
  async ls(shell, args) {
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

  async cd(shell, args) {
    const target = args[0] ?? '~';
    const path = resolvePath(shell.cwd, target);
    const node = getNode(path);
    if (!node) return shell.error(`cd: ${target}: No such file or directory`);
    if (node.type !== 'dir') return shell.error(`cd: ${target}: Not a directory`);
    shell.setCwd(path);
  },

  async pwd(shell) {
    return shell.printText([shell.cwd], { lineDelay: 0 });
  },

  async cat(shell, args) {
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

  async open(shell, args) {
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

  async tree(shell, args) {
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

  async help(shell, args) {
    if (args[0]) {
      const topic = HELP[args[0]];
      if (!topic) return shell.error(`help: ${args[0]}: no help topics match`);
      return shell.printText(topic.split('\n'), { lineDelay: 15 });
    }
    return shell.printText(GENERAL_HELP.split('\n'), { lineDelay: 15 });
  },

  clear(shell) {
    shell.term.clear();
  },

  async history(shell) {
    const items = shell.history.all();
    if (items.length === 0) return shell.muted('No commands in history.');
    return shell.printText(
      items.map((c, i) => `${String(i + 1).padStart(3)}  ${c}`),
      { lineDelay: 10 },
    );
  },

  async whoami(shell) {
    return shell.printText(WHOAMI.split('\n'), { lineDelay: 30 });
  },

  async theme(shell, args) {
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
};
