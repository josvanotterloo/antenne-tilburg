import { withSentryConfig } from "@sentry/nextjs";

// Content-Security-Policy notes (OWASP audit finding #1):
// - script-src needs 'unsafe-inline' for Next's inline bootstrap scripts (no
//   nonce plumbing here); dev additionally needs 'unsafe-eval' for react-refresh.
// - style-src 'unsafe-inline' for styled-jsx/Tailwind inline styles.
// - img-src allows https: because product cover images are admin-entered URLs.
// - frame-src allows the OpenStreetMap embed on /visit.
// - frame-ancestors 'none' (+ X-Frame-Options DENY) stops clickjacking of /admin.
// - connect-src allows Sentry's exact ingest host (derived from SENTRY_DSN,
//   not guessed) so client-side error reports aren't silently blocked by
//   CSP — Sentry's ingest host varies by org/region (e.g.
//   o<id>.ingest.us.sentry.io), so a single wildcard pattern can't cover it
//   reliably. Adds nothing to CSP when SENTRY_DSN is unset.
const sentryIngestHost = process.env.SENTRY_DSN
  ? new URL(process.env.SENTRY_DSN).host
  : null;
const csp = [
  "default-src 'self'",
  `script-src 'self' 'unsafe-inline'${
    process.env.NODE_ENV === "development" ? " 'unsafe-eval'" : ""
  }`,
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data: https:",
  "font-src 'self'",
  `connect-src 'self'${sentryIngestHost ? ` https://${sentryIngestHost}` : ""}`,
  "frame-src https://www.openstreetmap.org",
  "frame-ancestors 'none'",
  "base-uri 'self'",
  "form-action 'self'",
].join("; ");

const securityHeaders = [
  { key: "Content-Security-Policy", value: csp },
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "X-Frame-Options", value: "DENY" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  // Ignored by browsers over plain http, so safe in dev; enforced once served
  // over https in production.
  {
    key: "Strict-Transport-Security",
    value: "max-age=31536000; includeSubDomains",
  },
];

/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  async headers() {
    return [{ source: "/(.*)", headers: securityHeaders }];
  },
  // Client code can only read NEXT_PUBLIC_* vars; forward the one SENTRY_DSN
  // var so .env only needs a single key (see instrumentation-client.ts). This
  // value is baked into the client bundle at BUILD time, unlike SENTRY_DSN
  // itself which sentry.server.config.ts/sentry.edge.config.ts read from
  // process.env at runtime — a build-once/deploy-many pipeline that injects
  // SENTRY_DSN only at container start will enable server-side reporting but
  // silently leave client-side reporting off. Set it at build time.
  env: {
    NEXT_PUBLIC_SENTRY_DSN: process.env.SENTRY_DSN,
  },
};

// No org/project/authToken configured — source map upload stays disabled, so
// this never needs the Sentry CLI's native binary at build time.
export default withSentryConfig(nextConfig, {
  silent: true,
  telemetry: false,
  sourcemaps: { disable: true },
});
