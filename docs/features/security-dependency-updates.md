# Dependency security updates (2026-07-27)

Prompted by `npm audit` showing 8 vulnerabilities (2 critical, 4 high, 2
moderate) after the three new testing-layer dependencies (Stryker,
vitest-cucumber, fast-check) landed the previous session.

## Fixed

| Package | Was | Now | Severity | How |
|---|---|---|---|---|
| `@auth/core` (next-auth's dep) | ≤0.41.2 | 0.41.3 | critical | `npm audit fix` (bumped `next-auth` to `5.0.0-beta.32`, satisfies the existing `^5.0.0-beta.31` range) |
| `next-auth` | 5.0.0-beta.31 | 5.0.0-beta.32 | critical | same |
| `next` | 16.2.10 | 16.2.12 | high | `npm install next@16.2.12` (patch bump; `npm audit fix --force` tried to *downgrade* to `next@9.3.3` — a nonsensical resolver path, not used) |
| `postcss` | 8.4.31 (nested inside `next`) / 8.4.47 (direct) | 8.5.23 | high | direct dependency bumped to `^8.5.23` + `overrides` to force `next`'s own nested copy |
| `sharp` | 0.34.5 | 0.35.3 | high | `overrides` (no direct dependency on `sharp`; it's pulled in by `next`'s image optimization) |
| `qs` | 6.15.1 | 6.15.3 | moderate | `overrides` (pulled in by Stryker's Azure DevOps reporter chain via `typed-rest-client`) |
| `typed-rest-client` | flagged via `qs` | resolved | moderate | resolved automatically once `qs` was overridden |

Verified after each change: full test suite (91 files / 629 tests), lint,
typecheck, a clean `npm run build`, and a runtime smoke check against a
`next start` server (home page, `/admin/login`, `/admin` correctly
307-redirecting when unauthenticated via next-auth's middleware, and
`/api/catalog`) — all green.

**`sharp` caveat:** this app never actually calls `next/image` (grepped —
the only two hits are comments explaining a deliberate `<img>` choice
instead), so the `sharp` override is unverified at runtime by anything in
this test pass; the build succeeding only proves `sharp`'s install step
works, not its image-processing code path. The forced version (`0.35.3`)
also falls outside `next@16.2.12`'s own declared `optionalDependencies`
range for `sharp` (`^0.34.5`) — `overrides` intentionally bypasses that,
which is the point of using it, but it means this specific pairing hasn't
been exercised by `next` upstream either. Low risk given it's never
invoked, but worth an actual image-optimization smoke test before this
app ever starts using `next/image`.

**Removal conditions** for the two pure-transitive overrides (`postcss`'s
override is redundant-but-harmless with the direct dependency bump above
it, and can stay indefinitely without confusion):
- `sharp`: remove once `next` bundles `sharp>=0.35.3` as its own declared
  optional dependency (check with `npm ls sharp` after any `next` bump).
- `qs`: remove once Stryker's dependency chain
  (`@stryker-mutator/core` → ... → `typed-rest-client`) bumps past the
  vulnerable `qs` range on its own (check with `npm ls qs` after any
  `@stryker-mutator/*` bump).

## Not fixed, by design: `brace-expansion` cascade (9 `high` findings)

`npm audit` reports 9 `high`-severity findings that are all one underlying
issue: a `brace-expansion` DoS advisory (unpatched below `5.0.8`) nested
inside four separate copies of an old `minimatch` (~3.x) used internally by
`eslint`, `@eslint/config-array`, `@eslint/eslintrc`, and
`eslint-config-next`'s bundled plugins (`eslint-plugin-import`,
`eslint-plugin-jsx-a11y`, `eslint-plugin-react`). The 9 separate advisory
entries are npm audit's per-package accounting of this one root cause, not
9 independent vulnerabilities.

**Tried and reverted:** `"overrides": { "brace-expansion": "^5.0.8" }`
forces every nested copy to the patched version — but the patch only ever
shipped in the unrelated `5.x` rewrite. The old `minimatch` these packages
pin expects `brace-expansion`'s original function-export API; forcing 5.x
broke it immediately (`TypeError: expand is not a function`, confirmed by
actually running `npm run lint` with the override in place — not assumed).
There is no patched release in the `1.x`–`4.x` lines this `minimatch`
requires (checked the full version history: the fix landed only at
`5.0.8`, after a `2.x`/`3.x`/`4.x` progression of unrelated rewrites), and
`eslint`/`@eslint/config-array`/`@eslint/eslintrc`/`eslint-config-next`
haven't yet published a release that bumps their own `minimatch` far
enough to pull in the new API.

**Exploitability assessment:** not exploitable in this project.
`brace-expansion`'s DoS triggers on parsing a maliciously crafted glob-like
pattern string. The vulnerable code here only ever runs inside ESLint's
own flat-config file-matching (`ignores`/`files` patterns from
`eslint.config.mjs`), executed locally by a developer or CI against this
repository's own trusted config and source tree. ESLint is a
`devDependency` — it is never bundled into the Next.js build output and
never runs against attacker-controlled or user-facing input in production.
The only way to supply a malicious pattern would be to already have write
access to this repo's own config, which is a strictly larger compromise
than anything this advisory could add (a malicious `eslint.config.mjs` is
itself an executable JS file).

**Revisit when:** any of `eslint`, `@eslint/config-array`,
`@eslint/eslintrc`, or `eslint-config-next` publish a release with an
updated `minimatch`/`brace-expansion` — check with `npm audit` after any
future `eslint`/`eslint-config-next` bump. A major `eslint` version bump
(9→10) was tried as an alternative path and also rejected: it breaks
`eslint-config-next`'s bundled `eslint-plugin-react` outright
(`contextOrFilename.getFilename is not a function`), unrelated to this
advisory.

## Result

`npm audit`: 8 vulnerabilities (2 critical, 4 high, 2 moderate) → 9 (all
high, all the one documented-safe `brace-expansion` cascade above). Net:
every critical and moderate finding fixed; every high finding either fixed
or assessed as non-exploitable with no safe fix currently available
upstream.

## Update (2026-08-18): `deepmerge-ts` via Prisma, allowlisted in CI

CI's `npm audit --audit-level=high --omit=dev` step started failing on
`GHSA-ggr8-5vv4-36mx` — a stack-exhaustion DoS in `deepmerge-ts` (<8.0.0)
when merging deeply recursive object graphs. Unlike the `brace-expansion`
cascade above, this one **isn't excluded by `--omit=dev`**: `prisma` is a
`peerDependency` of `@prisma/client` (a production dependency), and this
project's devDependency `prisma@6.19.3` satisfies that peer at the same
version — so npm's audit graph treats the whole chain
(`deepmerge-ts` → `@prisma/config` → `prisma`) as reachable from
production, even though `prisma`'s own code never actually runs as part of
serving a request.

**Checked for a fix:** `@prisma/config` pins `deepmerge-ts@7.1.5` exactly.
Checked every Prisma release from the current `6.19.3` (the newest 6.x)
through the latest stable major, `7.9.1` — every single one still pins
`deepmerge-ts@7.1.5`. There is no Prisma version, breaking or not, that
resolves this; it's blocked entirely on Prisma bumping their own
`@prisma/config` dependency upstream.

**Exploitability assessment:** not exploitable in this project's runtime.
`@prisma/config`'s deepmerge logic only runs when the `prisma` CLI merges
`prisma.config.ts` with its defaults — i.e. `prisma generate` / `migrate` /
`db seed`, all local-dev/CI/build-time operations processing this repo's
own trusted `prisma.config.ts`. `@prisma/client`'s actual query-execution
code (what runs inside the deployed Next.js server, handling real
requests) doesn't invoke `@prisma/config` at all — `prisma` is only in the
tree to satisfy `@prisma/client`'s peer-dependency version check. There is
no path from attacker-controlled request input to the vulnerable merge
call.

**Not fixed — allowlisted instead:** `npm audit --audit-level=high` has no
built-in way to exclude one known advisory while still failing on
everything else, so the CI step now runs
`scripts/check-npm-audit.mjs`, which wraps `npm audit --omit=dev --json`
and fails only on findings **not** in its package-name allowlist
(`deepmerge-ts`, `@prisma/config`, `prisma` — this one cascade). Any other
high/critical finding, on any other package, still fails the build exactly
as before.

**Revisit when:** any future Prisma release bumps `@prisma/config`'s
`deepmerge-ts` dependency to `>=8.0.0` — check with
`npm view @prisma/config@<new-version> dependencies` after any Prisma
bump, and remove the three entries from `scripts/check-npm-audit.mjs`'s
allowlist once confirmed.
