// @vitest-environment node
import { describe, expect, it } from "vitest";
import { readFileSync } from "fs";
import { resolve } from "path";

// .env.example is a committed template — anything written here is public,
// forever, via git history. A real SENTRY_AUTH_TOKEN landed here once
// because nothing enforced "placeholders only"; see
// docs/security/incident-2026-08-14-leaked-sentry-token.md and
// tasks/lessons.md (2026-08-14). Keys below are the explicit exception:
// safe defaults/placeholders a template is allowed to ship pre-filled.
const ALLOWED_NON_EMPTY_KEYS = new Set([
  "DATABASE_URL", // placeholder credentials (USER:PASSWORD), not real ones
  "NEXTAUTH_SECRET", // placeholder text, not a real secret
  "NEXTAUTH_URL", // safe default (localhost)
  "DYMO_MODE", // safe default ("preview")
  "SENTRY_DSN", // DSNs are write-only, rate-limited, meant to be public
]);

function parseEnvExample(contents: string): Map<string, string> {
  const vars = new Map<string, string>();
  for (const rawLine of contents.split("\n")) {
    const line = rawLine.trim();
    if (!line || line.startsWith("#")) continue;
    const match = /^([A-Za-z_][A-Za-z0-9_]*)=(.*)$/.exec(line);
    if (!match) continue;
    const [, key, rest] = match;
    vars.set(key, rest.split(/\s+#/)[0].trim());
  }
  return vars;
}

function unexpectedlyNonEmpty(vars: Map<string, string>): [string, string][] {
  return [...vars.entries()].filter(
    ([key, value]) => value !== "" && !ALLOWED_NON_EMPTY_KEYS.has(key),
  );
}

describe(".env.example", () => {
  const contents = readFileSync(resolve(process.cwd(), ".env.example"), "utf8");

  it("has no unresolved git-merge-conflict markers", () => {
    expect(contents).not.toMatch(/^<{7}|^={7}$|^>{7}/m);
  });

  it("contains only empty values, except for the explicit allowlist", () => {
    expect(unexpectedlyNonEmpty(parseEnvExample(contents))).toEqual([]);
  });

  it("flags a non-empty, non-allowlisted value the way ef62a78 should have been caught", () => {
    // Representative shape of the historical mistake (a real token value
    // committed to this file) — not a reproduction of the actual secret,
    // which is unnecessary to prove this check fires on any non-empty,
    // non-allowlisted value.
    const vars = parseEnvExample(
      ["SENTRY_DSN=https://example.ingest.sentry.io/1", "SENTRY_AUTH_TOKEN=not-actually-empty"].join(
        "\n",
      ),
    );
    expect(unexpectedlyNonEmpty(vars)).toEqual([["SENTRY_AUTH_TOKEN", "not-actually-empty"]]);
  });
});
