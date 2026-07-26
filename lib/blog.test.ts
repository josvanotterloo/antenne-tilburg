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

  it("uses the correct three-letter abbreviation for every month", () => {
    const abbreviations = [
      "Jan", "Feb", "Mar", "Apr", "May", "Jun",
      "Jul", "Aug", "Sep", "Oct", "Nov", "Dec",
    ];
    abbreviations.forEach((abbr, month) => {
      const d = new Date(Date.UTC(2026, month, 15));
      expect(postDateLabel(d)).toBe(`15 ${abbr} 2026`);
    });
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

  it("drops a leading image so the excerpt is real prose, not raw markdown", () => {
    expect(
      postExcerpt("![alt](/uploads/abc.jpg)A heavy box landed this week."),
    ).toBe("A heavy box landed this week.");
  });

  it("keeps link text but strips the markdown link syntax", () => {
    expect(postExcerpt("Catch us on [Discogs](https://discogs.com/x).")).toBe(
      "Catch us on Discogs.",
    );
  });

  it("strips emphasis and heading markers", () => {
    expect(postExcerpt("## New in\n\nFresh **wax** and _tape_.")).toBe(
      "New in Fresh wax and tape.",
    );
  });

  it("strips inline code markers but keeps their contents", () => {
    expect(postExcerpt("Grab the `TR-909` reissue.")).toBe(
      "Grab the TR-909 reissue.",
    );
  });

  it("strips triple-marker emphasis (bold + italic together)", () => {
    expect(postExcerpt("***loud***")).toBe("loud");
  });

  it("removes a stray, unpaired emphasis character", () => {
    expect(postExcerpt("a * lone asterisk")).toBe("a lone asterisk");
  });

  it("returns text unchanged at exactly the max length (no truncation)", () => {
    const text = "a".repeat(50);
    expect(postExcerpt(text, 50)).toBe(text);
  });

  it("trims leading/trailing whitespace left after collapsing", () => {
    expect(postExcerpt("  \n  padded body  \n  ")).toBe("padded body");
  });

  it("cuts mid-word when the truncated slice has no word boundary", () => {
    const body = "a".repeat(200); // one continuous word, no spaces anywhere
    const out = postExcerpt(body, 100);
    expect(out).toBe(`${"a".repeat(100)}…`);
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
