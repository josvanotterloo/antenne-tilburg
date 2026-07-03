// @vitest-environment node
import { describe, it, expect } from "vitest";

import { parsePostInput } from "@/lib/post-input";

const VALID = {
  title: "  New Arrivals This Week  ",
  body: "Some body text.",
  coverImage: "https://x/y.jpg",
  status: "PUBLISHED",
  seoTitle: "SEO title",
  seoDescription: "  ",
};

describe("parsePostInput", () => {
  it("accepts valid input and derives a slug from the title", () => {
    const r = parsePostInput(VALID);
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.data).toMatchObject({
      title: "New Arrivals This Week",
      slug: "new-arrivals-this-week",
      body: "Some body text.",
      coverImage: "https://x/y.jpg",
      status: "PUBLISHED",
      seoTitle: "SEO title",
      seoDescription: null, // blank → null
    });
  });

  it("slugifies an explicit slug when provided", () => {
    const r = parsePostInput({ ...VALID, slug: "Custom Slug!" });
    expect(r.ok && r.data.slug).toBe("custom-slug");
  });

  it("defaults status to DRAFT when absent or invalid", () => {
    expect(parsePostInput({ ...VALID, status: undefined }).ok).toBe(true);
    const r = parsePostInput({ ...VALID, status: undefined });
    expect(r.ok && r.data.status).toBe("DRAFT");
    const r2 = parsePostInput({ ...VALID, status: "WEIRD" });
    expect(r2.ok && r2.data.status).toBe("DRAFT");
  });

  it.each([
    ["title", { ...VALID, title: "  " }],
    ["body", { ...VALID, body: "" }],
  ])("rejects missing %s", (_f, body) => {
    expect(parsePostInput(body).ok).toBe(false);
  });

  it("rejects a title that produces an empty slug", () => {
    expect(parsePostInput({ ...VALID, title: "!!!", slug: "" }).ok).toBe(false);
  });
});
