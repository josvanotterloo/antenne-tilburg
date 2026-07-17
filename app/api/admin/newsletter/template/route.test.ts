// @vitest-environment node
import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@/lib/api-auth", () => ({
  requireAdmin: vi.fn().mockResolvedValue(null),
}));
vi.mock("@/lib/db", () => ({
  db: { newsletterTemplate: { findUnique: vi.fn(), upsert: vi.fn() } },
}));

import { GET, POST } from "@/app/api/admin/newsletter/template/route";
import { db } from "@/lib/db";
import { requireAdmin } from "@/lib/api-auth";

const post = (body: unknown) =>
  POST(
    new Request("http://localhost/api/admin/newsletter/template", {
      method: "POST",
      body: JSON.stringify(body),
    }),
  );

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(requireAdmin).mockResolvedValue(null);
});

describe("GET /api/admin/newsletter/template", () => {
  it("returns the singleton row", async () => {
    vi.mocked(db.newsletterTemplate.findUnique).mockResolvedValue({
      id: "singleton",
      headerText: "Hi",
      footerText: "Bye",
      updatedAt: new Date("2026-07-10T10:00:00Z"),
    } as never);

    const res = await GET();
    expect(res.status).toBe(200);
    expect(await res.json()).toMatchObject({
      headerText: "Hi",
      footerText: "Bye",
    });
    expect(db.newsletterTemplate.findUnique).toHaveBeenCalledWith({
      where: { id: "singleton" },
    });
  });

  it("returns empty defaults before the first save", async () => {
    vi.mocked(db.newsletterTemplate.findUnique).mockResolvedValue(null);
    const res = await GET();
    expect(res.status).toBe(200);
    expect(await res.json()).toMatchObject({ headerText: "", footerText: "" });
  });

  it("returns the 401 from requireAdmin", async () => {
    vi.mocked(requireAdmin).mockResolvedValue(
      new Response(null, { status: 401 }) as never,
    );
    expect((await GET()).status).toBe(401);
  });
});

describe("POST /api/admin/newsletter/template", () => {
  it("upserts the singleton — creates on first call, updates after", async () => {
    vi.mocked(db.newsletterTemplate.upsert).mockResolvedValue({
      id: "singleton",
      headerText: "Hi",
      footerText: "Bye",
    } as never);

    const res = await post({ headerText: "Hi", footerText: "Bye" });
    expect(res.status).toBe(200);
    expect(db.newsletterTemplate.upsert).toHaveBeenCalledWith({
      where: { id: "singleton" },
      create: { id: "singleton", headerText: "Hi", footerText: "Bye" },
      update: { headerText: "Hi", footerText: "Bye" },
    });
  });

  it("rejects non-string fields with 400 and does not write", async () => {
    const res = await post({ headerText: 5, footerText: null });
    expect(res.status).toBe(400);
    expect(db.newsletterTemplate.upsert).not.toHaveBeenCalled();
  });

  it("returns the 401 from requireAdmin without writing", async () => {
    vi.mocked(requireAdmin).mockResolvedValue(
      new Response(null, { status: 401 }) as never,
    );
    const res = await post({ headerText: "x", footerText: "y" });
    expect(res.status).toBe(401);
    expect(db.newsletterTemplate.upsert).not.toHaveBeenCalled();
  });
});
