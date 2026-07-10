// @vitest-environment node
import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@/lib/db", () => ({
  db: {
    newsletterSubscriber: { findUnique: vi.fn(), delete: vi.fn() },
  },
}));

import { GET, POST } from "@/app/api/newsletter/unsubscribe/route";
import { db } from "@/lib/db";

const url = (token?: string) =>
  token === undefined
    ? "http://localhost/api/newsletter/unsubscribe"
    : `http://localhost/api/newsletter/unsubscribe?token=${token}`;
const get = (token?: string) => GET(new Request(url(token)));
const post = (token?: string) =>
  POST(new Request(url(token), { method: "POST" }));

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(db.newsletterSubscriber.delete).mockResolvedValue({} as never);
});

describe("GET /api/newsletter/unsubscribe (confirmation page)", () => {
  it("404s an unknown token and does not delete", async () => {
    vi.mocked(db.newsletterSubscriber.findUnique).mockResolvedValue(null);
    const res = await get("nope");
    expect(res.status).toBe(404);
    expect(db.newsletterSubscriber.delete).not.toHaveBeenCalled();
  });

  it("renders a confirmation form for a valid token WITHOUT deleting (prefetch-safe)", async () => {
    vi.mocked(db.newsletterSubscriber.findUnique).mockResolvedValue({
      id: "s1",
    } as never);
    const res = await get("good");
    const html = await res.text();
    expect(res.status).toBe(200);
    // GET must never delete — email scanners / link prefetchers issue GETs.
    expect(db.newsletterSubscriber.delete).not.toHaveBeenCalled();
    // The page carries a POST form back to the same endpoint with the token.
    expect(html).toContain('method="post"');
    expect(html).toContain("token=good");
  });
});

describe("POST /api/newsletter/unsubscribe (perform)", () => {
  it("deletes the subscriber on a valid token (200)", async () => {
    vi.mocked(db.newsletterSubscriber.findUnique).mockResolvedValue({
      id: "s1",
    } as never);
    const res = await post("good");
    expect(res.status).toBe(200);
    expect(db.newsletterSubscriber.delete).toHaveBeenCalledWith({
      where: { id: "s1" },
    });
  });

  it("404s an unknown token", async () => {
    vi.mocked(db.newsletterSubscriber.findUnique).mockResolvedValue(null);
    const res = await post("nope");
    expect(res.status).toBe(404);
    expect(db.newsletterSubscriber.delete).not.toHaveBeenCalled();
  });

  it("treats a double-submit (already deleted, P2025) as success, not a 500", async () => {
    vi.mocked(db.newsletterSubscriber.findUnique).mockResolvedValue({
      id: "s1",
    } as never);
    vi.mocked(db.newsletterSubscriber.delete).mockRejectedValue({
      code: "P2025",
    });
    const res = await post("good");
    expect(res.status).toBe(200);
  });
});
