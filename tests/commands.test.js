import test from 'node:test';
import assert from 'node:assert/strict';
import { commands, commandNames } from '../js/commands.js';
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
  const html = out.find((o) => o[0] === 'lines')[1].join('');
  assert.match(html, /about\//);
  assert.match(html, /readme\.md/);
});

test('tree walks the tree with box characters', async () => {
  const { shell, out } = makeShell('/');
  await commands.tree(shell, []);
  const text = out.find((o) => o[0] === 'text')[1].join('\n');
  assert.match(text, /├── about\//);
  assert.match(text, /└── readme\.md/);
});

test('unknown command names are not registered', () => {
  assert.equal(commandNames.includes('python'), false);
  assert.equal(commands.python, undefined);
});

test('tab completion: command, dir and multi-match', () => {
  assert.deepEqual(complete('he', '/', commandNames), { replace: 'help ' });
  assert.deepEqual(complete('cd pro', '/', commandNames), { replace: 'cd projects/' });
  const list = complete('cat projects/', '/', commandNames).list;
  assert.ok(list.includes('ai-agent/'));
  assert.ok(list.includes('website/'));
});
