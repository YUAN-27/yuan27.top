// Command history, persisted to localStorage.
const KEY = 'yuan27.history.v1';

export class History {
  constructor(limit = 200) {
    this.limit = limit;
    this.items = this._load();
    this.pos = this.items.length;
    this.draft = '';
  }

  _load() {
    try {
      const v = JSON.parse(localStorage.getItem(KEY));
      return Array.isArray(v) ? v : [];
    } catch {
      return [];
    }
  }

  _save() {
    try {
      localStorage.setItem(KEY, JSON.stringify(this.items));
    } catch {
      /* storage unavailable — ignore */
    }
  }

  add(cmd) {
    if (!cmd) return;
    if (this.items[this.items.length - 1] === cmd) return;
    this.items.push(cmd);
    if (this.items.length > this.limit) this.items.shift();
    this.pos = this.items.length;
    this._save();
  }

  // ArrowUp: remember the in-progress draft once, then walk back.
  up(current) {
    if (this.pos === this.items.length) this.draft = current;
    if (this.pos > 0) this.pos--;
    return this.items[this.pos] ?? '';
  }

  // ArrowDown: walk forward; past the end, restore the draft.
  down() {
    if (this.pos < this.items.length) this.pos++;
    if (this.pos === this.items.length) return this.draft;
    return this.items[this.pos];
  }

  all() {
    return [...this.items];
  }
}
