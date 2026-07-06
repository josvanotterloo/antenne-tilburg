// @vitest-environment node
import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@/lib/blog", () => ({ getPublishedPosts: vi.fn() }));
vi.mock("@/lib/db", () => ({ db: { product: { findMany: vi.fn() } } }));

import sitemap from "@/app/sitemap";
import { getPublishedPosts } from "@/lib/blog";
import { db } from "@/lib/db";

const base = process.env.NEXTAUTH_URL ?? "http://localhost:3000";

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(getPublishedPosts).mockResolvedValue([
    { slug: "hello-world", updatedAt: new Date("2026-07-01") },
  ] as never);
  vi.mocked(db.product.findMany).mockResolvedValue([
    { id: "p1", updatedAt: new Date("2026-07-02") },
  ] as never);
});

describe("sitemap", () => {
  it("includes every static public route", async () => {
    const urls = (await sitemap()).map((e) => e.url);
    for (const path of ["", "/about", "/faq", "/visit", "/stock", "/blog", "/newsletter"]) {
      expect(urls).toContain(`${base}${path}`);
    }
  });

  it("includes a URL for each published post and in-stock product", async () => {
    const urls = (await sitemap()).map((e) => e.url);
    expect(urls).toContain(`${base}/blog/hello-world`);
    expect(urls).toContain(`${base}/stock/p1`);
  });

  it("only lists in-stock products", async () => {
    await sitemap();
    expect(db.product.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { inStock: true } }),
    );
  });

  it("never lists admin routes", async () => {
    const entries = await sitemap();
    expect(entries.every((e) => !e.url.includes("/admin"))).toBe(true);
  });

  it("degrades to static routes when the DB is unavailable", async () => {
    vi.mocked(getPublishedPosts).mockRejectedValue(new Error("db down"));
    const urls = (await sitemap()).map((e) => e.url);
    expect(urls).toContain(`${base}/blog`);
    expect(urls).not.toContain(`${base}/blog/hello-world`);
  });
});
