// Tiny "did you mean" helper for unknown commands.
// Uses Optimal String Alignment distance (Levenshtein + adjacent transposition),
// because swapping two letters is the most common typo.

export function levenshtein(a, b) {
  const s = String(a);
  const t = String(b);
  const m = s.length;
  const n = t.length;
  if (m === 0) return n;
  if (n === 0) return m;

  const d = Array.from({ length: m + 1 }, () => new Array(n + 1).fill(0));
  for (let i = 0; i <= m; i++) d[i][0] = i;
  for (let j = 0; j <= n; j++) d[0][j] = j;

  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      const cost = s[i - 1] === t[j - 1] ? 0 : 1;
      d[i][j] = Math.min(d[i - 1][j] + 1, d[i][j - 1] + 1, d[i - 1][j - 1] + cost);
      if (i > 1 && j > 1 && s[i - 1] === t[j - 2] && s[i - 2] === t[j - 1]) {
        d[i][j] = Math.min(d[i][j], d[i - 2][j - 2] + 1);
      }
    }
  }
  return d[m][n];
}

// Closest candidate within a length-aware threshold, or null.
export function closest(word, candidates) {
  const w = String(word).toLowerCase();
  const maxDist = w.length <= 3 ? 1 : 2;
  let best = null;
  let bestD = Infinity;
  for (const c of candidates) {
    const d = levenshtein(w, String(c).toLowerCase());
    if (d < bestD) {
      bestD = d;
      best = c;
    }
  }
  return best !== null && bestD <= maxDist ? best : null;
}
