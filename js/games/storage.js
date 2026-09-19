// ============================================================
//  games/storage.js — Arcade 持久化（版本化 + 容错，纯逻辑）
//  只使用 key: yuan27.arcade.v1，不触碰站点其它 key。
//  任何异常（隐私模式 / 损坏 JSON / 配额满）都必须静默降级，绝不抛出。
// ============================================================

export const ARCADE_KEY = 'yuan27.arcade.v1';
export const ARCADE_VERSION = 1;

export function defaultData() {
  return {
    version: ARCADE_VERSION,
    pong: {
      gamesPlayed: 0,
      playerWins: 0,
      aiWins: 0,
      bestScore: { left: 0, right: 0 },
      muted: false,
      mode: 'normal',
    },
  };
}

const isObj = (v) => v !== null && typeof v === 'object' && !Array.isArray(v);
const num = (v, d) => (typeof v === 'number' && Number.isFinite(v) && v >= 0 ? Math.floor(v) : d);
const bool = (v, d) => (typeof v === 'boolean' ? v : d);

// 版本不符 / 结构损坏 → 整体重建；单字段类型错 → 该字段回落默认
export function normalize(raw) {
  if (!isObj(raw) || raw.version !== ARCADE_VERSION) return defaultData();
  const def = defaultData();
  const p = isObj(raw.pong) ? raw.pong : {};
  const best = isObj(p.bestScore) ? p.bestScore : {};
  return {
    version: ARCADE_VERSION,
    pong: {
      gamesPlayed: num(p.gamesPlayed, def.pong.gamesPlayed),
      playerWins: num(p.playerWins, def.pong.playerWins),
      aiWins: num(p.aiWins, def.pong.aiWins),
      bestScore: { left: num(best.left, 0), right: num(best.right, 0) },
      muted: bool(p.muted, def.pong.muted),
      mode: p.mode === 'easy' ? 'easy' : 'normal',
    },
  };
}

function browserStorage() {
  try { return globalThis.localStorage || null; } catch { return null; }
}

export function createStore(storage = browserStorage()) {
  let memory = defaultData();          // 降级用内存态
  let ok = !!storage;

  const readRaw = () => {
    if (!ok) return null;
    try { return storage.getItem(ARCADE_KEY); } catch { ok = false; return null; }
  };

  return {
    load() {
      const raw = readRaw();
      if (raw == null) return { ...memory };
      let parsed = null;
      try { parsed = JSON.parse(raw); } catch { parsed = null; }
      const data = normalize(parsed);
      memory = data;
      return { ...data, pong: { ...data.pong, bestScore: { ...data.pong.bestScore } } };
    },
    save(data) {
      const safe = normalize(data);
      memory = safe;
      if (!ok) return false;
      try { storage.setItem(ARCADE_KEY, JSON.stringify(safe)); return true; }
      catch { ok = false; return false; }
    },
    update(fn) {
      const cur = this.load();
      const next = typeof fn === 'function' ? (fn(cur) || cur) : cur;
      this.save(next);
      return normalize(next);
    },
    reset() {
      memory = defaultData();
      if (!ok) return;
      try { storage.removeItem(ARCADE_KEY); } catch { /* ignore */ }
    },
  };
}