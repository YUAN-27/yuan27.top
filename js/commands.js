// Command registry — single source of truth for handlers, help and completion.
// Adding a command = adding one entry here (help + Tab completion pick it up automatically).
import { getNode, resolve as resolvePath } from './fs.js';
import { WHOAMI, PROFILE, NEOFETCH_ART, FUN } from './content.js';
import { getThemes, setTheme, currentTheme } from './themes.js';
import { closest } from './suggest.js';

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
    tree [-a] [path]

Options:
    -a    include hidden files

Example:
    tree
    tree -a
    tree projects`,
    async run(shell, args) {
      const flags = args.filter((a) => a.startsWith('-')).join('');
      const positional = args.filter((a) => !a.startsWith('-'));
      const showAll = flags.includes('a');
      const target = positional[0] ?? '.';
      const path = resolvePath(shell.cwd, target);
      const node = getNode(path);
      if (!node) return shell.error(`tree: ${target}: No such file or directory`);
      if (node.type !== 'dir') return shell.error(`tree: ${target}: Not a directory`);

      const lines = [path];
      const walk = (dir, prefix) => {
        const names = Object.keys(dir.children).sort().filter((n) => showAll || !n.startsWith('.'));
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
    ls [-a] [path]

Options:
    -a    include hidden files

Example:
    ls
    ls -a
    ls projects`,
    async run(shell, args) {
      const flags = args.filter((a) => a.startsWith('-')).join('');
      const positional = args.filter((a) => !a.startsWith('-'));
      const showAll = flags.includes('a');
      const target = positional[0] ?? '.';
      const path = resolvePath(shell.cwd, target);
      const node = getNode(path);
      if (!node) return shell.error(`ls: ${target}: No such file or directory`);
      if (node.type !== 'dir') return shell.error(`ls: ${target}: Not a directory`);

      let names = Object.keys(node.children).sort();
      if (!showAll) names = names.filter((n) => !n.startsWith('.'));
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

  motion: {
    category: 'Settings',
    summary: 'Toggle background animation',
    help: `motion - toggle background animation

Usage:
    motion          show current state
    motion on       enable background animation
    motion off      disable it (static grid)`,
    async run(shell, args) {
      const bg = shell.background;
      const arg = args[0];
      if (!arg) {
        const off = bg && bg.isMotionOff ? bg.isMotionOff() : false;
        const mode = bg ? bg.mode : 'unknown';
        return shell.printText([`Background animation: ${off ? 'off' : 'on'} (mode: ${mode})`], { lineDelay: 0 });
      }
      if (arg !== 'on' && arg !== 'off') {
        return shell.error(`motion: ${arg}: invalid argument (use 'on' or 'off')`);
      }
      if (!bg || !bg.setMotion) return shell.error('motion: background layer unavailable');
      const mode = bg.setMotion(arg === 'off');
      return shell.success(`Background animation ${arg === 'off' ? 'disabled' : 'enabled'} (mode: ${mode}).`);
    },
  },

  sound: {
    category: 'Settings',
    summary: 'Toggle typing sound',
    help: `sound - toggle typing sound

Usage:
    sound          show current state
    sound on       enable typing sound
    sound off      disable typing sound`,
    async run(shell, args) {
      const s = shell.sound;
      const arg = args[0];
      if (!arg) {
        const on = s && s.isEnabled ? s.isEnabled() : false;
        return shell.printText([`Typing sound: ${on ? 'on' : 'off'}`], { lineDelay: 0 });
      }
      if (arg !== 'on' && arg !== 'off') {
        return shell.error(`sound: ${arg}: invalid argument (use 'on' or 'off')`);
      }
      if (!s || !s.setEnabled) return shell.error('sound: audio unavailable in this browser');
      const on = s.setEnabled(arg === 'on');
      return shell.success(`Typing sound ${on ? 'enabled' : 'disabled'}.`);
    },
  },

  // ---- Fun ----
  coffee: {
    category: 'Fun',
    summary: 'Boost productivity',
    help: `coffee - boost productivity

Usage:
    coffee`,
    async run(shell) {
      return shell.printText(FUN.coffee, { lineDelay: 45 });
    },
  },

  fortune: {
    category: 'Fun',
    summary: 'Print a random fortune',
    help: `fortune - print a random fortune

Usage:
    fortune`,
    async run(shell) {
      const f = FUN.fortunes[Math.floor(Math.random() * FUN.fortunes.length)];
      return shell.printText(['', f], { lineDelay: 0 });
    },
  },

  sudo: {
    category: 'Fun',
    summary: 'Try privileged actions',
    help: `sudo - try privileged actions

Usage:
    sudo hire yuan`,
    async run(shell, args) {
      const cmd = args.join(' ');
      if (!cmd) return shell.error('sudo: no command specified');
      if (cmd !== 'hire yuan') {
        return shell.error(`sudo: ${cmd}: permission denied (try 'sudo hire yuan')`);
      }
      for (let i = 0; i < FUN.sudoHire.length; i++) {
        await shell.printText([FUN.sudoHire[i]], { lineDelay: i < 3 ? 500 : 60 });
      }
    },
  },
};

export const commandNames = Object.keys(registry);
export const commands = Object.fromEntries(
  Object.entries(registry).map(([name, def]) => [name, def.run]),
);

// "did you mean" for unknown commands.
export function suggestCommand(name) {
  return closest(name, commandNames);
}
