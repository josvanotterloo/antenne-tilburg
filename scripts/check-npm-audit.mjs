#!/usr/bin/env node
// Wraps `npm audit --omit=dev` with a package-name allowlist. Plain `npm
// audit --audit-level=high` has no way to exclude one known, accepted
// finding while still failing on everything else — this fills that gap.
//
// Only exact package names below are ignored; any other high/critical
// finding (including a new one introduced by an unrelated dependency bump)
// still fails the build. See docs/features/security-dependency-updates.md
// for the reasoning behind each entry and its revisit condition.

import { spawnSync } from "node:child_process";

const ALLOWLIST = new Map([
  [
    "deepmerge-ts",
    "GHSA-ggr8-5vv4-36mx (<8.0.0) via prisma -> @prisma/config; no Prisma release fixes this yet",
  ],
  [
    "@prisma/config",
    "same GHSA-ggr8-5vv4-36mx cascade — depends on the vulnerable deepmerge-ts",
  ],
  [
    "prisma",
    "same GHSA-ggr8-5vv4-36mx cascade — depends on the vulnerable @prisma/config",
  ],
]);

const result = spawnSync("npm", ["audit", "--omit=dev", "--json"], {
  encoding: "utf8",
  maxBuffer: 10 * 1024 * 1024,
});

if (!result.stdout) {
  console.error(result.stderr || "npm audit produced no output");
  process.exit(result.status ?? 1);
}

const report = JSON.parse(result.stdout);
const vulnerabilities = Object.entries(report.vulnerabilities ?? {});

const blocking = vulnerabilities.filter(
  ([name, v]) =>
    (v.severity === "high" || v.severity === "critical") &&
    !ALLOWLIST.has(name),
);

if (blocking.length > 0) {
  console.error("Blocking npm audit findings (not on the allowlist):");
  for (const [name, v] of blocking) {
    console.error(`  - ${name} (${v.severity})`);
  }
  process.exit(1);
}

const allowlisted = vulnerabilities.filter(([name]) => ALLOWLIST.has(name));
console.log(
  `npm audit: ${vulnerabilities.length} finding(s), all allowlisted:`,
);
for (const [name] of allowlisted) {
  console.log(`  - ${name}: ${ALLOWLIST.get(name)}`);
}
