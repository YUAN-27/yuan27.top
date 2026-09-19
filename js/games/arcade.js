// ============================================================
//  games/arcade.js — 命令入口（唯一对外接口）
//  不导入 host/session 实现：宿主能力由装配层 main.js 通过
//  shell.ui.openGameSession(...) 注入，因此本模块在无 DOM 环境可完整测试。
// ============================================================
import { createStore } from './storage.js';
import { meta as pongMeta, createGame as createPong } from './pong.js';
import { getActive } from './session.js';

export const GAMES = {
  [pongMeta.id]: { meta: pongMeta, create: createPong },
};

const LIST = Object.values(GAMES).map((g) => g.meta);

export function parseArcadeArgs(args = []) {
  const list = Array.isArray(args) ? args : [];
  if (list.length === 0) return { action: 'list' };
  const first = String(list[0]);
  if (first === '--list' || first === '-l') return { action: 'list' };
  if (first === '--help' || first === '-h') return { action: 'help' };
  if (first === '--reset') return { action: 'reset' };
  if (list.length > 1) return { action: 'unknown', id: list.join(' ') };
  if (GAMES[first]) return { action: 'play', id: first };
  return { action: 'unknown', id: first };
}

function listLines() {
  return [
    'YUAN27 TERMINAL ARCADE',
    '',
    ...LIST.map((m) => `  ${m.id.padEnd(10)} ${m.summary}`),
    '',
    'Type: arcade pong',
  ];
}

function helpLines() {
  return [
    'arcade - launch terminal arcade games',
    '',
    'Usage:',
    '    arcade                 list games',
    '    arcade <game>          launch a game in its own terminal session',
    '    arcade --list          list games',
    '    arcade --help          show this help',
    '    arcade --reset         reset arcade data (high scores, mute)',
    '',
    'Example:',
    '    arcade pong',
    '',
    'Pong controls:',
    '    W / S                  move player 1 paddle',
    '    Up / Down              move player 2 paddle (two-player mode)',
    '    Space                  serve / play again',
    '    M                      mute game sound only',
    '    ESC / Q                quit the game session',
    '',
    'The game runs in its own terminal window; the main terminal is not modified.',
  ];
}

export async function runArcade(shell, args) {
  const parsed = parseArcadeArgs(args);
  const store = createStore();

  if (parsed.action === 'list') return shell.printText(listLines(), { lineDelay: 0 });
  if (parsed.action === 'help') return shell.printText(helpLines(), { lineDelay: 0 });

  if (parsed.action === 'reset') {
    try { store.reset(); } catch { /* ignore */ }
    return shell.success('arcade: data reset (scores and mute cleared)');
  }

  if (parsed.action === 'unknown') {
    await shell.error(`arcade: unknown game '${parsed.id}'`);
    return shell.muted(`Available games: ${LIST.map((m) => m.id).join(', ')}`);
  }

  const entry = GAMES[parsed.id];
  // 守卫放在命令层，且不在 session.js（而 session.js 只依赖 input/renderer 两个纯模块）
  if (getActive()) return shell.error('arcade: a session is already running');
  if (!shell.ui || typeof shell.ui.openGameSession !== 'function') {
    return shell.error('arcade: no game host available');
  }

  let session = null;
  try {
    session = shell.ui.openGameSession({
      game: entry.create({ difficulty: store.load().pong.mode }),
      store,
      sfx: shell.ui.sfx || {},
      title: `yuan27.top :: arcade :: ${entry.meta.id}`,
    });
  } catch (err) {
    return shell.error(`arcade: failed to start session (${err && err.message ? err.message : 'unknown'})`);
  }

  try {
    await session.start();
  } catch (err) {
    try { session.destroy(); } catch { /* ignore */ }
    return shell.error(`arcade: failed to start session (${err && err.message ? err.message : 'unknown'})`);
  }

  try {
    await session.exited;
  } catch { /* ignore */ }
  return undefined;
}
