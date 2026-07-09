// Client IP for rate-limiting keys. Uses the RIGHTMOST x-forwarded-for entry:
// the leftmost entries are supplied by the client (trivially spoofable — a
// forged header would otherwise mint a fresh rate-limit bucket per request),
// while the rightmost value is the peer address our own reverse proxy appended.
// Absent/blank header (e.g. direct connection in dev) falls back to a shared
// "unknown" bucket — throttled collectively rather than not at all.
export function clientIp(headers: Headers): string {
  const entries = (headers.get("x-forwarded-for") ?? "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
  return entries.at(-1) ?? "unknown";
}
