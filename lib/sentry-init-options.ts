import type { ErrorEvent } from "@sentry/nextjs";

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
  if (!dsn) return null;
  return {
    dsn,
    beforeSend(event: ErrorEvent): ErrorEvent | null {
      // Local dev is noise, not a real error report — drop it before
      // scrubbing even runs. Checked via NODE_ENV (same convention as
      // lib/db.ts), not Sentry's own event.environment, so this doesn't
      // depend on each runtime's (server/edge/client) auto-detection
      // agreeing on the literal string "development".
      if (process.env.NODE_ENV === "development") return null;
      return scrubEmails(event);
    },
  };
}
