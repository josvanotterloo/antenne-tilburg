// @vitest-environment node
import { describe, it, expect, vi, beforeEach } from "vitest";
import { Prisma } from "@prisma/client";

vi.mock("@/lib/db", () => ({
  db: { newsletterSubscriber: { create: vi.fn() } },
}));

import { POST } from "@/app/api/newsletter/route";
import { db } from "@/lib/db";

const post = (body: unknown) =>
  POST(
    new Request("http://localhost/api/newsletter", {
      method: "POST",
      body: JSON.stringify(body),
    }),
  );

beforeEach(() => vi.clearAllMocks());

describe("POST /api/newsletter", () => {
  it("400s on invalid input and does not touch the DB", async () => {
    const res = await post({ name: "", email: "nope" });
    expect(res.status).toBe(400);
    expect(db.newsletterSubscriber.create).not.toHaveBeenCalled();
  });

  it("creates a subscriber (normalised) and returns 201", async () => {
    vi.mocked(db.newsletterSubscriber.create).mockResolvedValue({} as never);
    const res = await post({ name: "  Jos ", email: "JOS@X.com" });
    expect(res.status).toBe(201);
    expect(db.newsletterSubscriber.create).toHaveBeenCalledWith({
      data: { name: "Jos", email: "jos@x.com" },
    });
  });

  it("treats a duplicate email as already subscribed, not an error", async () => {
    const dup = new Prisma.PrismaClientKnownRequestError("dup", {
      code: "P2002",
      clientVersion: "x",
    });
    vi.mocked(db.newsletterSubscriber.create).mockRejectedValue(dup as never);
    const res = await post({ name: "Jos", email: "jos@x.com" });
    expect(res.status).toBe(200);
    expect(await res.json()).toMatchObject({
      ok: true,
      alreadySubscribed: true,
    });
  });

  it("500s on an unexpected DB error", async () => {
    vi.mocked(db.newsletterSubscriber.create).mockRejectedValue(
      new Error("boom") as never,
    );
    const res = await post({ name: "Jos", email: "jos@x.com" });
    expect(res.status).toBe(500);
  });
});
