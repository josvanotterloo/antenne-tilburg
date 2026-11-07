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

## Update (2026-10-15): `postcss-selector-parser` via Tailwind 3.x — moderate, not actioned

GitHub Dependabot flagged `GHSA-rj75-hqrm-r3gf` (CVE-2026-104844): quadratic
parsing complexity in `postcss-selector-parser` <7.1.6, which can exhaust CPU
on a crafted flat CSS selector.

**Checked for a fix:** `tailwindcss@3.4.19` pins `postcss-selector-parser`
to `^6.1.2`, resolving to `6.1.4` — the last ever release on the 6.x line
(npm tags it `legacy-v6`). The fix only shipped on the 7.x line (`7.1.6`);
there is no patched 6.x release. The only path to the fixed version is
Tailwind's own v4 major, a breaking upgrade out of scope for a drive-by fix.

**Exploitability assessment:** not exploitable in this project.
`postcss-selector-parser` is a `devDependency` (via Tailwind's PostCSS
pipeline), invoked only at build time against this repo's own trusted CSS
source — never on user-supplied input. The advisory itself notes the real
risk is services that parse untrusted, attacker-supplied selectors
synchronously in a request path (CSS sanitizers, CSS-in-JS services); this
app has no such path.

**Not actioned — doesn't need an allowlist entry:** severity is `moderate`
(CI's `scripts/check-npm-audit.mjs` only blocks on `high`/`critical`) and
the package is dev-scoped (`--omit=dev` already excludes it). CI is
unaffected either way.

**Revisit when:** a Tailwind v4 migration happens for other reasons (it
would resolve this as a side effect), or if a `6.1.5+` backport is ever
published — check with `npm view postcss-selector-parser versions`.

## Update (2026-11-07): `next` critical RCE/DoS fixes, Sentry tunnelRoute bypass, fast-uri/glob/minimatch

Prompted by `npm run build`'s own security gate refusing to proceed on
`next@16.4.0`, and by GitHub Dependabot flagging 16 vulnerabilities (3
critical, 3 high, 7 moderate, 3 low) on `master`. Ran `npm audit fix`
(never `--force` — see below) on a clean branch off `master`.

### Fixed

| Package | Was | Now | Severity | Advisory |
|---|---|---|---|---|
| `next` | 16.4.0 | 16.4.5 | critical | RCE in Image Optimization API via SVG (`GHSA-2464-fhr4-w9xw`); DoS in App Router Server Actions (`GHSA-p3m5-59mp-jv5r`); RCE in `use cache` functions returning typed arrays (`GHSA-673q-mjm6-r5xr`); plus the Nov 3 security release's five advisories (cache poisoning of fallback shells via request-supplied route params, HttpOnly cookie exposure via an internal response header on Edge runtime routes, cross-tenant `use cache`/`unstable_cache` disclosure, cache leak across root param values in nested `use cache`, cross-user cache disclosure with binary arguments, cross-client response injection via fetch forwarding) |
| `@sentry/nextjs` | 10.70.0 | 10.78.0 | critical | Middleware bypass when using Sentry's `tunnelRoute` option (`GHSA-mchm-gjx6-7h55`) |
| `fast-uri` | 3.1.8 | 3.1.9 | moderate | scheme spoofing via percent-encoding, path-equivalence bypass, WHATWG host confusion, scheme injection via unescaped colon (4 advisories, one package bump) |
| `glob` | 13.0.6 | 13.0.7 | moderate | AbortSignal cancellation bypass allows post-timeout filesystem traversal (`GHSA-3g3m-2fjr-6pw4`) |
| `minimatch` | 10.2.5 | 10.2.6 | moderate | DoS via globparts amplification (`GHSA-g3hv-75wg-m249`) |

All five resolved via plain `npm audit fix` — no `package.json` range
changes were needed (existing semver ranges already permitted the fixed
versions); only `package-lock.json` changed. Verified: `npm ls next
@sentry/nextjs fast-uri glob minimatch` and `package-lock.json`'s resolved
versions both confirm the table above.

### Exposure check (why none of these are actually reachable here)

- **`next/image` with SVG** (relevant to the Image Optimization RCE): not
  used anywhere. Grepped for both the import and the string `next/image` —
  the only two hits are comments in
  `app/(public)/blog/[slug]/page.tsx` and `components/admin/ProductForm.tsx`
  explaining a deliberate plain `<img>` choice instead (same finding as the
  2026-07-27 update above, re-confirmed).
- **`"use cache"` directives** (relevant to three of the five advisories
  above): none in the codebase. Grepped the full source tree.
- **Sentry `tunnelRoute`** (relevant to the `@sentry/nextjs` advisory):
  not configured. Checked `next.config.mjs`'s `withSentryConfig(...)`
  options object directly — no `tunnelRoute` key present.

So while `next` and `@sentry/nextjs` were both carrying critical
advisories, none of the three vulnerable code paths were ever reachable in
this app's actual runtime. Upgraded anyway, as the correct fix, not
because exploitation was likely.

### Next.js 16.4.1–16.4.5 release notes: Turbopack / App Router / Server Actions / proxy.ts

Read via the GitHub releases/tags (PR titles, not detailed descriptions —
see caveat below):

- **16.4.1:** the App Router/Server Actions DoS fix above (`GHSA-p3m5-59mp-jv5r`). No Turbopack or proxy.ts items.
- **16.4.2:** five Turbopack-only bug fixes (turbo-tasks snapshot consistency, Pages Router dev module graph chaining, two GC/dependency-edge fixes, lazy dynamic-import chunk-list collisions). No App Router, Server Actions, or proxy.ts items.
- **16.4.3:** "Don't load the app-page runtime in proxy.ts" (#100423) — a proxy.ts bug fix. One Turbopack revert ("loader change invalidation"). No App Router or Server Actions items.
- **16.4.4:** three more Turbopack fixes/reverts (missed startup CSS reload, PPR-resume CSP nonce on the Turbopack runtime bootstrap, a revert of a module-factory-chunk optimization) and two low-relevance routing/tooling changes (a disabled flaky test, an analyzer tooling change). No Server Actions or proxy.ts items. Notes a security release was coming the next day.
- **16.4.5:** the Nov 3 security release (table above) — App Router/cache-adjacent advisories only, no Turbopack or Server Actions changelog items (security releases list advisories, not a regular changelog).

**Caveat:** this was read by a sub-agent from GitHub's release/tag pages,
which list PR/advisory titles rather than full descriptions — the
one-liners above are paraphrases of those titles, not verified against the
underlying PRs' diffs.

### Not touched: `deepmerge-ts` → Prisma 7 cascade

Still allowlisted exactly as in the 2026-08-18 update above — `npm audit`
now additionally offers `prisma@7.10.1` as a fix (previously checked only
through `7.9.1`), but that's `--force`-only and a major version bump.
Added to the backlog (`tasks/todo.md` → Security): "Prisma 7 upgrade ...
Evaluate after go-live." Not actioned here per explicit instruction.

### Not touched, informational only

- `@sentry/nextjs` now warns at startup: importing `withSentryConfig` from
  `@sentry/nextjs` itself is deprecated, moving to `@sentry/nextjs/config`
  in v11. Still works on this v10.78.0; no action needed until a v11 bump.
- `npm audit fix` surfaced an `install-scripts` warning for 4 packages
  (`@prisma/client`, `@prisma/engines`, `prisma`, `@sentry/cli`) not yet
  covered by `allowScripts` — an npm policy notice, not a vulnerability;
  didn't affect this install (Prisma client generation and the build both
  succeeded).

### Verification

Full suite (172 files / 1283 tests), `tsc --noEmit`, `eslint .`, and
`npm run build` all clean — the build in particular no longer stops on
the security-advisory gate it hit before this update. `node
scripts/check-npm-audit.mjs` passes (8 findings, all the pre-existing
allowlisted `deepmerge-ts` cascade). Runtime-checked both NL and EN on a
`next start` instance on a spare port (the existing dev server on :3000
couldn't be restarted mid-session — Next.js 16.4.5's dev server refuses a
second instance against the same project dir even on a different port, so
`next start` was used instead, which doesn't have that restriction):
`/visit` (public) and `/admin/catalog` (admin, NL then EN) both rendered
correctly.
