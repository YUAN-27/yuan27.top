// Terminal renderer: output queue, line/char typewriter effects, cursor, clear.
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

export class Terminal {
  constructor(el) {
    this.el = el;
    this.skip = false;
    this.reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  }

  _delay(ms) {
    return this.reduced ? 0 : ms;
  }

  scroll() {
    this.el.scrollTop = this.el.scrollHeight;
  }

  clear() {
    this.el.innerHTML = '';
  }

  // Echo the entered command line: "❯ <command>".
  echo(line) {
    const div = document.createElement('div');
    div.className = 'line-command';
    const prompt = document.createElement('span');
    prompt.className = 'prompt';
    prompt.textContent = '❯ ';
    const cmd = document.createElement('span');
    cmd.className = 'cmd';
    cmd.textContent = line;
    div.append(prompt, cmd);
    this.el.appendChild(div);
    this.scroll();
  }

  // Plain-text lines (safe: textContent), printed line by line.
  async printText(lines, { className = 'line', lineDelay = 40 } = {}) {
    this.skip = false;
    const delay = this._delay(lineDelay);
    for (let i = 0; i < lines.length; i++) {
      const div = document.createElement('div');
      div.className = className;
      div.textContent = lines[i] ?? '';
      this.el.appendChild(div);
      this.scroll();
      if (delay > 0 && !this.skip) await sleep(delay);
    }
  }

  // HTML lines (for colored ls output built from trusted content.js data).
  async printLines(htmlLines, { className = 'line', lineDelay = 40 } = {}) {
    this.skip = false;
    const delay = this._delay(lineDelay);
    for (let i = 0; i < htmlLines.length; i++) {
      const div = document.createElement('div');
      div.className = className;
      div.innerHTML = htmlLines[i] ?? '';
      this.el.appendChild(div);
      this.scroll();
      if (delay > 0 && !this.skip) await sleep(delay);
    }
  }

  // Character-by-character output (for `cat`).
  async printChars(text, { className = 'line', charDelay = 12 } = {}) {
    this.skip = false;
    const delay = this._delay(charDelay);
    const pre = document.createElement('pre');
    pre.className = className;
    this.el.appendChild(pre);
    this.scroll();
    for (const ch of text) {
      if (this.skip) {
        pre.textContent = text;
        break;
      }
      pre.textContent += ch;
      this.scroll();
      if (delay > 0) await sleep(delay);
    }
  }

  // Muted hint line (used by Tab completion).
  appendHint(text) {
    const div = document.createElement('div');
    div.className = 'line-muted';
    div.textContent = text;
    this.el.appendChild(div);
    this.scroll();
  }
}
