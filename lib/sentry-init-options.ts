import { scrubEmails } from "@/lib/sentry-scrub";

// Shared by sentry.server.config.ts, sentry.edge.config.ts, and
// instrumentation-client.ts so a future option change (e.g. tracesSampleRate)
// only needs editing in one place instead of three near-identical init calls.
// Each caller passes its own env var, since client code can only read
// NEXT_PUBLIC_* vars while server/edge can read anything (see next.config.mjs's
// `env` forwarding). Returns a plain object rather than one of Sentry's
// Node/Edge/Browser option types — those aren't part of @sentry/nextjs's
// public export surface, and `dsn`/`beforeSend` are valid fields on all three.
export function sentryInitOptions(dsn: string | undefined) {
  return dsn ? { dsn, beforeSend: scrubEmails } : null;
}
