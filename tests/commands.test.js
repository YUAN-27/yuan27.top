import test from 'node:test';
import assert from 'node:assert/strict';
import { commands, commandNames, registry, suggestCommand } from '../js/commands.js';
import { complete } from '../js/completion.js';
import { resolve } from '../js/fs.js';

function makeShell(initialCwd = '/') {
  const out = [];
  const shell = {
    cwd: initialCwd,
    history: { all: () => [] },
    resolve(p) { return resolve(this.cwd, p); },
    setCwd(p) { this.cwd = p; },
    error(msg) { out.push(['error', msg]); },
    success(msg) { out.push(['success', msg]); },
    muted(msg) { out.push(['muted', msg]); },
    printLines(lines) { out.push(['lines', lines]); },
    printText(lines) { out.push(['text', lines]); },
    printChars(text) { out.push(['chars', text]); },
    term: { clear() { out.push(['clear']); } },
  };
  return { shell, out };
}

const firstOf = (out, kind) => out.find((o) => o[0] === kind)[1];

test('cd changes cwd and pwd prints it', async () => {
  const { shell, out } = makeShell();
  await commands.cd(shell, ['about']);
  assert.equal(shell.cwd, '/about');
  await commands.pwd(shell);
  assert.deepEqual(out.at(-1), ['text', ['/about']]);
});

test('cd on missing dir errors with correct format', async () => {
  const { shell, out } = makeShell();
  await commands.cd(shell, ['nope']);
  assert.deepEqual(out[0], ['error', 'cd: nope: No such file or directory']);
});

test('cat reads a text file', async () => {
  const { shell, out } = makeShell('/about');
  await commands.cat(shell, ['bio.md']);
  const chars = out.find((o) => o[0] === 'chars');
  assert.ok(chars, 'expected char output');
  assert.match(chars[1], /Bio/);
});

test('cat on binary file prints binary message', async () => {
  const { shell, out } = makeShell('/resume');
  await commands.cat(shell, ['resume.pdf']);
  assert.deepEqual(out[0], ['error', 'cat: resume.pdf: binary file']);
  assert.deepEqual(out[1], ['muted', "Please use 'open'."]);
});

test('ls lists directories with trailing slash', async () => {
  const { shell, out } = makeShell('/');
  await commands.ls(shell, []);
  const html = firstOf(out, 'lines').join('');
  assert.match(html, /about\//);
  assert.match(html, /readme\.md/);
});

test('tree walks the tree with box characters', async () => {
  const { shell, out } = makeShell('/');
  await commands.tree(shell, []);
  const text = firstOf(out, 'text').join('\n');
  assert.match(text, /── about\//);
  assert.match(text, /── readme\.md/);
  assert.match(text, /── projects\//);
});

test('registry entries are complete', () => {
  for (const [name, def] of Object.entries(registry)) {
    assert.ok(def.category, `${name}: category`);
    assert.ok(def.summary, `${name}: summary`);
    assert.ok(def.help, `${name}: help`);
    assert.equal(typeof def.run, 'function', `${name}: run`);
  }
  assert.ok(commandNames.includes('neofetch'));
  assert.ok(commandNames.includes('resume'));
});

test('help is grouped by category', async () => {
  const { shell, out } = makeShell();
  await commands.help(shell, []);
  const text = firstOf(out, 'text').join('\n');
  assert.match(text, /^Core$/m);
  assert.match(text, /^Explore$/m);
  assert.match(text, /^Profile$/m);
  assert.match(text, /neofetch/);
  assert.match(text, /resume/);
});

test('help <command> shows usage', async () => {
  const { shell, out } = makeShell();
  await commands.help(shell, ['cat']);
  const text = firstOf(out, 'text').join('\n');
  assert.match(text, /cat - print file contents/);
  assert.match(text, /Usage:/);
});

test('help <unknown> errors', async () => {
  const { shell, out } = makeShell();
  await commands.help(shell, ['nope']);
  assert.deepEqual(out[0], ['error', 'help: nope: no help topics match']);
});

test('neofetch renders profile fields and ascii art', async () => {
  const { shell, out } = makeShell();
  await commands.neofetch(shell, []);
  const html = firstOf(out, 'lines').join('');
  assert.match(html, /neofetch-art/);
  assert.match(html, /YUAN27/);
  assert.match(html, /AI \/ Backend Developer/);
  assert.match(html, /HUST/);
});

test('unknown command names are not registered', () => {
  assert.equal(commandNames.includes('python'), false);
  assert.equal(commands.python, undefined);
});

test('tab completion: command, dir and multi-match', () => {
  assert.deepEqual(complete('he', '/', commandNames), { replace: 'help ' });
  assert.deepEqual(complete('cd pro', '/', commandNames), { replace: 'cd projects/' });
  const list = complete('cat projects/', '/', commandNames).list;
  assert.ok(list.includes('agent/'));
  assert.ok(list.includes('website/'));
  assert.ok(list.includes('mips/'));
});

test('motion command toggles background via shell.background', async () => {
  const { shell, out } = makeShell();
  let off = false;
  shell.background = {
    get mode() { return off ? 'static' : 'full'; },
    isMotionOff: () => off,
    setMotion(v) { off = !!v; return this.mode; },
  };
  await commands.motion(shell, ['off']);
  assert.equal(off, true);
  assert.match(out.at(-1)[1], /disabled/);
  assert.match(out.at(-1)[1], /static/);
  await commands.motion(shell, []);
  assert.match(out.at(-1)[1].join(''), /off/);
  await commands.motion(shell, ['on']);
  assert.equal(off, false);
});

test('motion command rejects invalid arguments', async () => {
  const { shell, out } = makeShell();
  shell.background = { mode: 'full', isMotionOff: () => false, setMotion: () => 'full' };
  await commands.motion(shell, ['maybe']);
  assert.deepEqual(out[0], ['error', "motion: maybe: invalid argument (use 'on' or 'off')"]);
});

// ---- P1: hidden files ----
test('ls hides dotfiles by default, ls -a shows them', async () => {
  const plain = makeShell('/');
  await commands.ls(plain.shell, []);
  const plainHtml = firstOf(plain.out, 'lines').join('');
  assert.equal(/\.secret/.test(plainHtml), false);
  assert.match(plainHtml, /readme\.md/);

  const all = makeShell('/');
  await commands.ls(all.shell, ['-a']);
  const allHtml = firstOf(all.out, 'lines').join('');
  assert.match(allHtml, /\.secret/);
  assert.match(allHtml, /\.note/);
  assert.match(allHtml, /\.birthday/);
});

test('ls -la (combined flags) shows hidden files too', async () => {
  const { shell, out } = makeShell('/');
  await commands.ls(shell, ['-la']);
  assert.match(firstOf(out, 'lines').join(''), /\.secret/);
});

test('tree hides dotfiles by default, tree -a shows them', async () => {
  const plain = makeShell('/');
  await commands.tree(plain.shell, []);
  assert.equal(/\.secret/.test(firstOf(plain.out, 'text').join('\n')), false);

  const all = makeShell('/');
  await commands.tree(all.shell, ['-a']);
  const allText = firstOf(all.out, 'text').join('\n');
  assert.match(allText, /\.secret/);
  assert.match(allText, /\.birthday/);
});

test('cat can read a hidden file without -a', async () => {
  const { shell, out } = makeShell('/');
  await commands.cat(shell, ['.secret']);
  assert.match(firstOf(out, 'chars'), /not listed in the docs/);
});

test('completion hides dotfiles unless a dot is typed', () => {
  const plain = complete('cat ', '/', commandNames).list;
  assert.ok(plain.every((n) => !n.startsWith('.')), plain.join(','));
  const hidden = complete('cat .', '/', commandNames).list;
  assert.ok(hidden.includes('.secret'));
  assert.ok(hidden.includes('.note'));
});

// ---- P1: fun commands ----
test('coffee prints the easter egg', async () => {
  const { shell, out } = makeShell();
  await commands.coffee(shell, []);
  const text = firstOf(out, 'text').join('\n');
  assert.match(text, /Coffee initialized\./);
  assert.match(text, /Productivity \+10/);
});

test('sudo hire yuan grants access and points to contact', async () => {
  const { shell, out } = makeShell();
  await commands.sudo(shell, ['hire', 'yuan']);
  const text = out.filter((o) => o[0] === 'text').map((o) => o[1][0]).join('\n');
  assert.match(text, /Access granted\./);
  assert.match(text, /contact\/links\.md/);
});

test('sudo with another command is denied', async () => {
  const { shell, out } = makeShell();
  await commands.sudo(shell, ['rm', '-rf', '/']);
  assert.deepEqual(out[0], ['error', "sudo: rm -rf /: permission denied (try 'sudo hire yuan')"]);
});

test('fortune prints something', async () => {
  const { shell, out } = makeShell();
  await commands.fortune(shell, []);
  assert.ok(firstOf(out, 'text').join('').trim().length > 0);
});

// ---- P1: suggestions ----
test('suggestCommand suggests near misses only', () => {
  assert.equal(suggestCommand('hepl'), 'help');
  assert.equal(suggestCommand('cta'), 'cat');
  assert.equal(suggestCommand('zzzzzz'), null);
});

test('P1 fun commands are in the Fun category', () => {
  for (const name of ['coffee', 'fortune', 'sudo']) {
    assert.equal(registry[name].category, 'Fun', name);
  }
});

// ---- P2: sound ----
test('sound command toggles typing sound (default off)', async () => {
  const { shell, out } = makeShell();
  let on = false;
  shell.sound = { isEnabled: () => on, setEnabled: (v) => { on = !!v; return on; } };

  await commands.sound(shell, []);
  assert.match(out.at(-1)[1].join(''), /off/);

  await commands.sound(shell, ['on']);
  assert.equal(on, true);
  assert.match(out.at(-1)[1], /enabled/);

  await commands.sound(shell, ['off']);
  assert.equal(on, false);
  assert.match(out.at(-1)[1], /disabled/);
});

test('sound command rejects invalid arguments', async () => {
  const { shell, out } = makeShell();
  shell.sound = { isEnabled: () => false, setEnabled: () => false };
  await commands.sound(shell, ['loud']);
  assert.deepEqual(out[0], ['error', "sound: loud: invalid argument (use 'on' or 'off')"]);
});

test('sound command is in the Settings category', () => {
  assert.equal(registry.sound.category, 'Settings');
});
