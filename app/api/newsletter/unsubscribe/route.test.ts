// @vitest-environment node
import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@/lib/db", () => ({
  db: {
    newsletterSubscriber: { findUnique: vi.fn(), delete: vi.fn() },
  },
}));

import { GET } from "@/app/api/newsletter/unsubscribe/route";
import { db } from "@/lib/db";

const get = (token?: string) => {
  const url =
    token === undefined
      ? "http://localhost/api/newsletter/unsubscribe"
      : `http://localhost/api/newsletter/unsubscribe?token=${token}`;
  return GET(new Request(url));
};

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(db.newsletterSubscriber.delete).mockResolvedValue({} as never);
});

describe("GET /api/newsletter/unsubscribe", () => {
  it("404s an unknown token and does not delete", async () => {
    vi.mocked(db.newsletterSubscriber.findUnique).mockResolvedValue(null);
    const res = await get("nope");
    expect(res.status).toBe(404);
    expect(db.newsletterSubscriber.delete).not.toHaveBeenCalled();
  });

  it("deletes the subscriber on a valid token (200)", async () => {
    vi.mocked(db.newsletterSubscriber.findUnique).mockResolvedValue({
      id: "s1",
    } as never);
    const res = await get("good");
    expect(res.status).toBe(200);
    expect(db.newsletterSubscriber.delete).toHaveBeenCalledWith({
      where: { id: "s1" },
    });
  });
});
