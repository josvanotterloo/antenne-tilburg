// @vitest-environment node
import { describe, it, expect } from "vitest";

import nextConfig from "./next.config.mjs";

type Header = { key: string; value: string };

async function siteHeaders(): Promise<Header[]> {
  const entries = await nextConfig.headers!();
  const all = entries.find((e: { source: string }) => e.source === "/(.*)");
  expect(all).toBeDefined();
  return all!.headers;
}

const get = (headers: Header[], key: string) =>
  headers.find((h) => h.key.toLowerCase() === key.toLowerCase())?.value;

describe("security headers (OWASP audit finding #1)", () => {
  it("sets nosniff, frame denial, referrer policy and HSTS on every route", async () => {
    const headers = await siteHeaders();
    expect(get(headers, "X-Content-Type-Options")).toBe("nosniff");
    expect(get(headers, "X-Frame-Options")).toBe("DENY");
    expect(get(headers, "Referrer-Policy")).toBe(
      "strict-origin-when-cross-origin",
    );
    expect(get(headers, "Strict-Transport-Security")).toContain("max-age=");
  });

  it("sets a Content-Security-Policy that denies framing and restricts sources", async () => {
    const headers = await siteHeaders();
    const csp = get(headers, "Content-Security-Policy")!;
    expect(csp).toContain("default-src 'self'");
    expect(csp).toContain("frame-ancestors 'none'");
    expect(csp).toContain("base-uri 'self'");
    expect(csp).toContain("form-action 'self'");
    // The Visit page embeds the OpenStreetMap iframe — must stay allowed.
    expect(csp).toContain("frame-src https://www.openstreetmap.org");
  });
});
