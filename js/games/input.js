// ============================================================
//  games/input.js — 游戏按键状态机（纯逻辑，不绑 DOM）
//  键盘归属靠「焦点在游戏窗口上」，不添加全局键盘监听。
//  preventDefault 只覆盖游戏用到的键，其余一律透传。
// ============================================================

const MAP = {
  w: 'up1', s: 'down1',
  ArrowUp: 'up2', ArrowDown: 'down2',
  Escape: 'quit', q: 'quit',
  ' ': 'confirm', Enter: 'confirm',
  m: 'mute',
  Tab: 'tab',
  '1': 'mode1', '2': 'mode2',
};

const norm = (key) => (typeof key === 'string' && key.length === 1 ? key.toLowerCase() : key);

export function mapAction(key) {
  return MAP[norm(key)] ?? null;
}

export function shouldPrevent(key) {
  return mapAction(key) !== null;
}

export function createInputState() {
  return { keys: new Set(), consumed: new Set() };
}

// 返回 true = 已被游戏处理（调用方应 preventDefault）
export function keyDown(state, key) {
  const action = mapAction(key);
  if (!action) return false;
  state.keys.add(action);
  return true;
}

export function keyUp(state, key) {
  const action = mapAction(key);
  if (!action) return false;
  state.keys.delete(action);
  return true;
}

export function clearInput(state) {
  state.keys.clear();
  state.consumed.clear();
}

export function consume(state, key) {
  state.consumed.add(norm(key));
}

export function isConsumed(state, key) {
  return state.consumed.has(norm(key));
}

export function axes(state) {
  return {
    up1: state.keys.has('up1'),
    down1: state.keys.has('down1'),
    up2: state.keys.has('up2'),
    down2: state.keys.has('down2'),
  };
}
