// @vitest-environment node
import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@/lib/db", () => ({
  db: {
    newsletterSubscriber: { findUnique: vi.fn(), update: vi.fn() },
  },
}));

import { GET } from "@/app/api/newsletter/confirm/route";
import { db } from "@/lib/db";

const get = (token?: string) => {
  const url =
    token === undefined
      ? "http://localhost/api/newsletter/confirm"
      : `http://localhost/api/newsletter/confirm?token=${token}`;
  return GET(new Request(url));
};

const hoursAgo = (h: number) => new Date(Date.now() - h * 60 * 60 * 1000);

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(db.newsletterSubscriber.update).mockResolvedValue({} as never);
});

describe("GET /api/newsletter/confirm", () => {
  it("404s an unknown token and does not update", async () => {
    vi.mocked(db.newsletterSubscriber.findUnique).mockResolvedValue(null);
    const res = await get("nope");
    expect(res.status).toBe(404);
    expect(db.newsletterSubscriber.update).not.toHaveBeenCalled();
  });

  it("400s an expired token (older than 48h)", async () => {
    vi.mocked(db.newsletterSubscriber.findUnique).mockResolvedValue({
      id: "s1",
      status: "PENDING",
      createdAt: hoursAgo(49),
    } as never);
    const res = await get("old");
    expect(res.status).toBe(400);
    expect(db.newsletterSubscriber.update).not.toHaveBeenCalled();
  });

  it("confirms a fresh pending token (200) and sets status CONFIRMED", async () => {
    vi.mocked(db.newsletterSubscriber.findUnique).mockResolvedValue({
      id: "s1",
      status: "PENDING",
      createdAt: hoursAgo(1),
    } as never);
    const res = await get("good");
    expect(res.status).toBe(200);
    expect(db.newsletterSubscriber.update).toHaveBeenCalledWith({
      where: { id: "s1" },
      data: { status: "CONFIRMED" },
    });
  });

  it("treats an already-CONFIRMED subscriber as success even past the 48h window (idempotent)", async () => {
    // The expiry gate must not fire for someone who already confirmed — the link
    // doubles as their record and they may revisit it from an archived email.
    vi.mocked(db.newsletterSubscriber.findUnique).mockResolvedValue({
      id: "s1",
      status: "CONFIRMED",
      createdAt: hoursAgo(72),
    } as never);
    const res = await get("old-but-confirmed");
    expect(res.status).toBe(200);
    expect(db.newsletterSubscriber.update).not.toHaveBeenCalled();
  });
});
