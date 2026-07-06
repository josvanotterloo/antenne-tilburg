// @vitest-environment node
import { describe, it, expect } from "vitest";

import robots from "@/app/robots";

const base = process.env.NEXTAUTH_URL ?? "http://localhost:3000";

describe("robots", () => {
  it("allows crawling, blocks /admin, and points at the sitemap", () => {
    const r = robots();
    expect(r.rules).toMatchObject({
      userAgent: "*",
      allow: "/",
      disallow: "/admin",
    });
    expect(r.sitemap).toBe(`${base}/sitemap.xml`);
  });
});
