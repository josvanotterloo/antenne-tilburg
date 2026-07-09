// Content-Security-Policy notes (OWASP audit finding #1):
// - script-src needs 'unsafe-inline' for Next's inline bootstrap scripts (no
//   nonce plumbing here); dev additionally needs 'unsafe-eval' for react-refresh.
// - style-src 'unsafe-inline' for styled-jsx/Tailwind inline styles.
// - img-src allows https: because product cover images are admin-entered URLs.
// - frame-src allows the OpenStreetMap embed on /visit.
// - frame-ancestors 'none' (+ X-Frame-Options DENY) stops clickjacking of /admin.
const csp = [
  "default-src 'self'",
  `script-src 'self' 'unsafe-inline'${
    process.env.NODE_ENV === "development" ? " 'unsafe-eval'" : ""
  }`,
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data: https:",
  "font-src 'self'",
  "connect-src 'self'",
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
};

export default nextConfig;
