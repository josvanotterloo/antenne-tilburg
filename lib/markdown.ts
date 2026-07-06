// Small helpers for editing markdown in the admin post form.

// Replace [start, end) in `text` with `insert` (an insertion when start === end).
// Positions are clamped into range so a stale selection can't throw.
export function insertAt(
  text: string,
  start: number,
  end: number,
  insert: string,
): string {
  const s = Math.max(0, Math.min(start, text.length));
  const e = Math.max(s, Math.min(end, text.length));
  return text.slice(0, s) + insert + text.slice(e);
}

export function imageMarkdown(url: string, alt = ""): string {
  return `![${alt}](${url})`;
}
