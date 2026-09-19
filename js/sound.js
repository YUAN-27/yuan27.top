// ============================================================
//  sound.js — 极轻的输入音效（WebAudio 合成，无音频文件）
//  默认关闭；仅 `sound on` 后启用；状态存 localStorage。
//  浏览器要求用户手势才能启动 AudioContext，因此在首次按键时才创建/resume。
// ============================================================

export const SOUND_KEY = 'yuan27.sound.v1';

function readEnabled() {
  try { return localStorage.getItem(SOUND_KEY) === 'on'; } catch { return false; }
}
function writeEnabled(on) {
  try { localStorage.setItem(SOUND_KEY, on ? 'on' : 'off'); } catch { /* ignore */ }
}

export function initSound() {
  let ctx = null;
  let enabled = readEnabled();

  function ensureCtx() {
    if (!ctx) {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return null;
      try { ctx = new AC(); } catch { return null; }
    }
    if (ctx.state === 'suspended') ctx.resume();
    return ctx;
  }

  // 短促、低音量的一次性音，避免任何持续噪声
  function blip(freq, dur, gain, type = 'square') {
    if (!enabled) return;
    const c = ensureCtx();
    if (!c) return;
    const t = c.currentTime;
    const osc = c.createOscillator();
    const g = c.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, t);
    g.gain.setValueAtTime(0.0001, t);
    g.gain.linearRampToValueAtTime(gain, t + 0.004);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    osc.connect(g);
    g.connect(c.destination);
    osc.start(t);
    osc.stop(t + dur + 0.02);
  }

  return {
    isEnabled() { return enabled; },
    setEnabled(v) {
      enabled = !!v;
      writeEnabled(enabled);
      if (enabled) ensureCtx();
      return enabled;
    },
    key() { blip(470 + Math.random() * 70, 0.022, 0.022); },
    enter() { blip(300, 0.05, 0.03); },

    // 通用音效入口（Arcade 使用）。安全失败：任何异常都不得影响调用方。
    blip(freq = 440, dur = 0.03, gain = 0.03, type = 'square') {
      try {
        if (!Number.isFinite(freq) || !Number.isFinite(dur) || !Number.isFinite(gain)) return;
        blip(Math.max(20, Math.min(12000, freq)), Math.max(0.005, Math.min(1, dur)), Math.max(0.0001, Math.min(0.3, gain)), type);
      } catch { /* ignore */ }
    },
  };
}
