// ============================================================
//  keys.js — 输入行键盘处理（纯依赖注入，便于单元测试）
//  约定：音效等副作用必须包在 try/catch 里 —— UI 不能因为声音挂掉。
// ============================================================

export function makeKeyHandler(deps = {}) {
  const {
    input,
    submit,
    history,
    complete,
    commandNames = [],
    getCwd = () => '/',
    appendHint = () => {},
    afterInput = () => {},
    onKey = () => {},
  } = deps;

  return function onKeydown(e) {
    // 副作用（音效）永远不允许影响输入
    try { onKey(e); } catch { /* ignore */ }

    if (e.key === 'Enter') {
      e.preventDefault();
      submit(input.value);
      return 'submit';
    }
    if (e.key === 'ArrowUp') {
      e.preventDefault();
      input.value = history.up(input.value);
      afterInput();
      return 'history-prev';
    }
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      input.value = history.down();
      afterInput();
      return 'history-next';
    }
    if (e.key === 'Tab') {
      e.preventDefault();
      const r = complete(input.value, getCwd(), commandNames);
      if (r && r.replace) {
        input.value = r.replace;
        afterInput();
        return 'complete';
      }
      if (r && r.list) {
        appendHint(r.list.join('   '));
        return 'complete-list';
      }
      return 'complete-none';
    }
    if (e.key === 'Escape') {
      input.value = '';
      afterInput();
      return 'clear';
    }
    if (e.key === 'ArrowLeft' || e.key === 'ArrowRight') {
      // 让光标始终停在末尾，块状光标才可预测
      e.preventDefault();
      return 'caret-locked';
    }
    return 'noop';
  };
}
