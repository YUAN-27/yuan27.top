import test from 'node:test';
import assert from 'node:assert/strict';
import { makeKeyHandler } from '../js/keys.js';

function setup(opts = {}) {
  const calls = [];
  const input = { value: opts.value ?? 'help' };
  const handler = makeKeyHandler({
    input,
    submit: (v) => calls.push(['submit', v]),
    history: {
      up: (v) => { calls.push(['up', v]); return opts.upValue ?? 'ls'; },
      down: () => { calls.push(['down']); return opts.downValue ?? 'pwd'; },
    },
    complete: (v, cwd, names) => {
      calls.push(['complete', v, cwd, names.length]);
      return 'completeResult' in opts ? opts.completeResult : { replace: 'help ' };
    },
    commandNames: ['help', 'ls'],
    getCwd: () => '/about',
    appendHint: (t) => calls.push(['hint', t]),
    afterInput: () => calls.push(['after']),
    onKey: opts.onKey ?? ((e) => calls.push(['key', e.key])),
  });
  return { handler, input, calls };
}

const ev = (key) => ({ key, defaultPrevented: false, preventDefault() { this.defaultPrevented = true; } });
const of = (calls, kind) => calls.filter((c) => c[0] === kind);

test('Enter submits the current input value', () => {
  const { handler, calls } = setup();
  const e = ev('Enter');
  handler(e);
  assert.ok(e.defaultPrevented, 'Enter 必须 preventDefault');
  assert.deepEqual(of(calls, 'submit'), [['submit', 'help']]);
});

test('REGRESSION: Enter still submits when the sound hook throws', () => {
  const { handler, calls, input } = setup({
    onKey: () => { throw new Error('audio boom'); },
    value: 'neofetch',
  });
  const e = ev('Enter');
  assert.doesNotThrow(() => handler(e));
  assert.deepEqual(of(calls, 'submit'), [['submit', 'neofetch']]);
  assert.ok(e.defaultPrevented);
  assert.equal(input.value, 'neofetch');
});

test('REGRESSION: typing keys still work when the sound hook throws', () => {
  const { handler, calls } = setup({ onKey: () => { throw new Error('audio boom'); } });
  assert.doesNotThrow(() => handler(ev('a')));
  assert.deepEqual(of(calls, 'submit'), []);
});

test('onKey is called for every keydown (typing sound hook)', () => {
  const { handler, calls } = setup();
  handler(ev('a'));
  handler(ev('Backspace'));
  handler(ev('Enter'));
  assert.deepEqual(of(calls, 'key'), [['key', 'a'], ['key', 'Backspace'], ['key', 'Enter']]);
});

test('ArrowUp / ArrowDown walk history and resync the input', () => {
  const { handler, input, calls } = setup();
  handler(ev('ArrowUp'));
  assert.equal(input.value, 'ls');
  handler(ev('ArrowDown'));
  assert.equal(input.value, 'pwd');
  assert.equal(of(calls, 'after').length, 2);
});

test('Tab completes a unique match', () => {
  const { handler, input, calls } = setup();
  handler(ev('Tab'));
  assert.equal(input.value, 'help ');
  assert.equal(of(calls, 'complete')[0][2], '/about', '补全应使用当前目录');
});

test('Tab lists multiple matches as a hint', () => {
  const { handler, input, calls } = setup({ completeResult: { list: ['a/', 'b/'] } });
  handler(ev('Tab'));
  assert.equal(input.value, 'help', '多匹配不应改动输入');
  assert.deepEqual(of(calls, 'hint'), [['hint', 'a/   b/']]);
});

test('Tab with no match does nothing', () => {
  const { handler, input, calls } = setup({ completeResult: null });
  handler(ev('Tab'));
  assert.equal(input.value, 'help');
  assert.equal(of(calls, 'hint').length, 0);
});

test('Escape clears the input', () => {
  const { handler, input } = setup();
  handler(ev('Escape'));
  assert.equal(input.value, '');
});

test('ArrowLeft / ArrowRight are swallowed (block cursor stays at the end)', () => {
  const { handler, calls } = setup();
  const l = ev('ArrowLeft');
  handler(l);
  assert.ok(l.defaultPrevented);
  assert.equal(of(calls, 'submit').length, 0);
});

test('unhandled keys are a no-op', () => {
  const { handler, calls } = setup();
  assert.equal(handler(ev('Shift')), 'noop');
  assert.deepEqual(of(calls, 'submit'), []);
});
