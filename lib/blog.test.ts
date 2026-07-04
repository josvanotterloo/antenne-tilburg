// @vitest-environment node
import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@/lib/db", () => ({
  db: {
    post: {
      findMany: vi.fn(),
      findFirst: vi.fn(),
    },
  },
}));

import {
  getPublishedPosts,
  getPublishedPostBySlug,
  postDateLabel,
  postExcerpt,
} from "@/lib/blog";
import { db } from "@/lib/db";

beforeEach(() => {
  vi.clearAllMocks();
});

describe("postDateLabel", () => {
  it("formats a date as DD Mon YYYY (UTC)", () => {
    expect(postDateLabel(new Date("2026-07-04T12:00:00.000Z"))).toBe(
      "04 Jul 2026",
    );
  });

  it("accepts an ISO string", () => {
    expect(postDateLabel("2026-01-09T23:30:00.000Z")).toBe("09 Jan 2026");
  });
});

describe("postExcerpt", () => {
  it("collapses whitespace and returns short bodies unchanged", () => {
    expect(postExcerpt("Fresh techno\n\nin  the crate")).toBe(
      "Fresh techno in the crate",
    );
  });

  it("truncates long bodies on a word boundary with an ellipsis", () => {
    const body = "word ".repeat(80).trim(); // 400 chars
    const out = postExcerpt(body, 100);
    expect(out.length).toBeLessThanOrEqual(101);
    expect(out.endsWith("…")).toBe(true);
    // Cut on a word boundary: every token before the ellipsis is a whole "word".
    const tokens = out.slice(0, -1).trim().split(" ");
    expect(tokens.every((t) => t === "word")).toBe(true);
  });
});

describe("getPublishedPosts", () => {
  it("queries only PUBLISHED posts, newest first", async () => {
    vi.mocked(db.post.findMany).mockResolvedValue([] as never);
    await getPublishedPosts();
    expect(db.post.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { status: "PUBLISHED" },
        orderBy: [{ publishedAt: "desc" }, { createdAt: "desc" }],
      }),
    );
  });

  it("returns the rows from the DB", async () => {
    const rows = [{ id: "1", slug: "hello" }];
    vi.mocked(db.post.findMany).mockResolvedValue(rows as never);
    await expect(getPublishedPosts()).resolves.toBe(rows);
  });
});

describe("getPublishedPostBySlug", () => {
  it("queries by slug restricted to PUBLISHED", async () => {
    vi.mocked(db.post.findFirst).mockResolvedValue(null as never);
    await getPublishedPostBySlug("hello");
    expect(db.post.findFirst).toHaveBeenCalledWith({
      where: { slug: "hello", status: "PUBLISHED" },
    });
  });

  it("returns null when no published post matches (e.g. a draft)", async () => {
    vi.mocked(db.post.findFirst).mockResolvedValue(null as never);
    await expect(getPublishedPostBySlug("draft-slug")).resolves.toBeNull();
  });
});
