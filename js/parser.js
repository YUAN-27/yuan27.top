// Command parser: input string -> { command, args, raw }
// V1 keeps it simple: whitespace tokenization, no quoting / options yet.
// (Never eval(); this is a safe, virtual shell boundary.)

export function parse(input) {
  const raw = (input ?? '').trim();
  if (!raw) return null;
  const tokens = raw.split(/\s+/);
  return {
    command: tokens[0],
    args: tokens.slice(1),
    raw,
  };
}
