// tests/games-storage.test.js
import test from 'node:test';
import assert from 'node:assert/strict';
import { createStore, defaultData, normalize, ARCADE_KEY, ARCADE_VERSION } from '../js/games/storage.js';

// 假 storage：与 localStorage 同接口
function fakeStorage(init = {}) {
  const map = new Map(Object.entries(init));
  return {
    getItem: (k) => (map.has(k) ? map.get(k) : null),
    setItem: (k, v) => map.set(k, String(v)),
    removeItem: (k) => map.delete(k),
    _map: map,
  };
}
const throwing = {
  getItem() { throw new Error('denied'); },
  setItem() { throw new Error('denied'); },
  removeItem() { throw new Error('denied'); },
};

test('defaultData has version and full pong shape', () => {
  const d = defaultData();
  assert.equal(d.version, ARCADE_VERSION);
  assert.deepEqual(Object.keys(d.pong).sort(), ['aiWins', 'bestScore', 'gamesPlayed', 'mode', 'muted', 'playerWins']);
});

test('load on empty storage returns defaults', () => {
  const s = createStore(fakeStorage());
  assert.deepEqual(s.load(), defaultData());
});

test('save then load round-trips', () => {
  const st = fakeStorage();
  const s = createStore(st);
  const d = s.load();
  d.pong.gamesPlayed = 3;
  d.pong.muted = true;
  assert.equal(s.save(d), true);
  const back = createStore(st).load();
  assert.equal(back.pong.gamesPlayed, 3);
  assert.equal(back.pong.muted, true);
});

test('corrupt JSON does not throw and falls back to defaults', () => {
  const s = createStore(fakeStorage({ [ARCADE_KEY]: '{not json' }));
  assert.deepEqual(s.load(), defaultData());
});

test('version mismatch rebuilds defaults', () => {
  const raw = JSON.stringify({ version: 99, pong: { gamesPlayed: 7 } });
  const s = createStore(fakeStorage({ [ARCADE_KEY]: raw }));
  assert.equal(s.load().pong.gamesPlayed, 0);
});

test('wrong field types fall back per-field', () => {
  const raw = JSON.stringify({ version: 1, pong: { gamesPlayed: 'x', muted: 'yes', mode: 'weird', bestScore: 5 } });
  const d = normalize(JSON.parse(raw));
  assert.equal(d.pong.gamesPlayed, 0);
  assert.equal(d.pong.muted, false);
  assert.equal(d.pong.mode, 'normal');
  assert.deepEqual(d.pong.bestScore, { left: 0, right: 0 });
});

test('non-object payload is rejected', () => {
  assert.deepEqual(normalize(null), defaultData());
  assert.deepEqual(normalize([1, 2]), defaultData());
  assert.deepEqual(normalize('str'), defaultData());
});

test('update() reads-modifies-writes and returns data', () => {
  const s = createStore(fakeStorage());
  const d = s.update((cur) => { cur.pong.aiWins += 1; return cur; });
  assert.equal(d.pong.aiWins, 1);
  assert.equal(s.load().pong.aiWins, 1);
});

test('reset removes only the arcade key', () => {
  const st = fakeStorage({ [ARCADE_KEY]: '{}', 'yuan27.theme.v1': 'matrix', 'yuan27.sound.v1': 'on' });
  createStore(st).reset();
  assert.equal(st.getItem(ARCADE_KEY), null);
  assert.equal(st.getItem('yuan27.theme.v1'), 'matrix');
  assert.equal(st.getItem('yuan27.sound.v1'), 'on');
});

test('throwing storage degrades to memory, never throws', () => {
  const s = createStore(throwing);
  assert.deepEqual(s.load(), defaultData());
  assert.equal(s.save(defaultData()), false);
  const d = s.update((cur) => { cur.pong.gamesPlayed = 2; return cur; });
  assert.equal(d.pong.gamesPlayed, 2);
  assert.doesNotThrow(() => s.reset());
});

test('createStore() with no arg does not throw in a DOM-less environment', () => {
  assert.doesNotThrow(() => createStore().load());
});
