#!/usr/bin/env node
// Wraps `npm audit --omit=dev` with an allowlist. Plain `npm audit
// --audit-level=high` has no way to exclude one known, accepted finding
// while still failing on everything else — this fills that gap.
//
// Every entry carries an `expires` date — past it, the entry stops being
// honoured and the job fails loudly, naming the entry and what to
// re-check. An allowlist entry is a deliberate, time-bound decision, not
// a permanent exemption; without an expiry, "accepted for now" silently
// becomes "accepted forever."
//
// Every entry also carries an `advisoryId` WHERE ONE EXISTS. npm audit's
// `via` array holds either a real advisory object (for the package the
// advisory is actually about) or a bare package-name string (for a
// package that's only affected because it depends on one) — confirmed by
// inspecting `npm audit --omit=dev --json` directly for each entry below.
// `@prisma/config` and `prisma` have no advisory of their own (their
// `via` is just `["deepmerge-ts", "effect"]` / `["@prisma/config"]`), so
// matching on name alone is the only option for them, same as before
// this change. `deepmerge-ts` DOES carry its own advisory object, so its
// entry pins the exact GHSA id — if that package were ever flagged for a
// *different*, new advisory later, name-only matching would wrongly wave
// it through; pinning the id closes that gap. See
// docs/features/security-dependency-updates.md for the reasoning behind
// each entry and its revisit condition.
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

export const ALLOWLIST = [
  {
    package: "deepmerge-ts",
    advisoryId: "GHSA-ggr8-5vv4-36mx",
    expires: "2027-01-31",
    reason: "(<8.0.0) via prisma -> @prisma/config; no Prisma release fixes this yet",
  },
  {
    package: "@prisma/config",
    advisoryId: null,
    expires: "2027-01-31",
    reason: "same GHSA-ggr8-5vv4-36mx cascade — no advisory of its own, depends on the vulnerable deepmerge-ts",
  },
  {
    package: "prisma",
    advisoryId: null,
    expires: "2027-01-31",
    reason: "same GHSA-ggr8-5vv4-36mx cascade — no advisory of its own, depends on the vulnerable @prisma/config",
  },
];

// Pulls every real GHSA advisory id out of a finding's `via` array,
// ignoring the bare package-name strings npm audit mixes in alongside them.
export function extractAdvisoryIds(via) {
  if (!Array.isArray(via)) return [];
  return via
    .filter((entry) => entry && typeof entry === "object" && typeof entry.url === "string")
    .map((entry) => entry.url.split("/").pop())
    .filter(Boolean);
}

// The allowlist entry for `name`, or undefined if none applies. When the
// entry pins an advisoryId, the finding's own `via` must actually carry
// that id — a name match alone isn't enough. When the entry has no
// advisoryId (nothing to pin — see the module comment above), name-only
// matching is all that's possible.
export function findAllowlistEntry(name, via, allowlist = ALLOWLIST) {
  const entry = allowlist.find((e) => e.package === name);
  if (!entry) return undefined;
  if (entry.advisoryId && !extractAdvisoryIds(via).includes(entry.advisoryId)) {
    return undefined;
  }
  return entry;
}

export function isExpired(entry, now = new Date()) {
  return now.getTime() > new Date(`${entry.expires}T00:00:00Z`).getTime();
}

export function evaluateAudit(report, now = new Date()) {
  const vulnerabilities = Object.entries(report.vulnerabilities ?? {});
  const blocking = [];
  const expired = [];
  const allowlisted = [];

  for (const [name, v] of vulnerabilities) {
    if (v.severity !== "high" && v.severity !== "critical") continue;
    const entry = findAllowlistEntry(name, v.via);
    if (!entry) {
      blocking.push([name, v]);
    } else if (isExpired(entry, now)) {
      expired.push([name, v, entry]);
    } else {
      allowlisted.push([name, v, entry]);
    }
  }

  return { total: vulnerabilities.length, blocking, expired, allowlisted };
}

function main() {
  const result = spawnSync("npm", ["audit", "--omit=dev", "--json"], {
    encoding: "utf8",
    maxBuffer: 10 * 1024 * 1024,
  });

  if (!result.stdout) {
    console.error(result.stderr || "npm audit produced no output");
    process.exit(result.status ?? 1);
  }

  const report = JSON.parse(result.stdout);
  const { total, blocking, expired, allowlisted } = evaluateAudit(report);

  if (expired.length > 0) {
    console.error("Allowlist entries have expired — re-check and update or remove them:");
    for (const [name, , entry] of expired) {
      console.error(`  - ${name} (expired ${entry.expires}): ${entry.reason}`);
    }
    process.exit(1);
  }

  if (blocking.length > 0) {
    console.error("Blocking npm audit findings (not on the allowlist):");
    for (const [name, v] of blocking) {
      console.error(`  - ${name} (${v.severity})`);
    }
    process.exit(1);
  }

  console.log(`npm audit: ${total} finding(s), all allowlisted:`);
  for (const [name, , entry] of allowlisted) {
    console.log(`  - ${name}: ${entry.reason}`);
  }
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  main();
}
