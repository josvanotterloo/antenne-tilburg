// @vitest-environment node
import { describe, it, expect, vi, beforeEach, type Mock } from "vitest";

vi.mock("@/lib/api-auth", () => ({
  requireAdmin: vi.fn().mockResolvedValue(null),
}));
vi.mock("@/lib/db", () => ({
  db: { newsletterSubscriber: { findMany: vi.fn(), delete: vi.fn() } },
}));

import { db } from "@/lib/db";
import { GET } from "@/app/api/admin/subscribers/export/route";
import { DELETE } from "@/app/api/admin/subscribers/[id]/route";
import { encryptEmail } from "@/lib/email-crypto";
import { requireAdmin } from "@/lib/api-auth";

const sub = db.newsletterSubscriber as unknown as {
  findMany: Mock;
  delete: Mock;
};
const mockRequireAdmin = vi.mocked(requireAdmin);
const ctx = (id: string) => ({ params: Promise.resolve({ id }) });

beforeEach(() => {
  vi.clearAllMocks();
  vi.stubEnv("EMAIL_ENCRYPTION_KEY", "9".repeat(64));
  mockRequireAdmin.mockResolvedValue(null);
});

describe("GET /api/admin/subscribers/export", () => {
  it("returns a CSV attachment with decrypted subscriber emails", async () => {
    sub.findMany.mockResolvedValue([
      // As stored: ciphertext; the export must decrypt for the shop owner.
      {
        name: "Ada",
        email: encryptEmail("ada@x.com"),
        createdAt: new Date("2026-07-01T00:00:00Z"),
      },
    ]);
    const res = await GET();
    const body = await res.text();
    expect(res.status).toBe(200);
    expect(sub.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { status: "CONFIRMED" } }),
    );
    expect(res.headers.get("content-type")).toMatch(/text\/csv/);
    expect(res.headers.get("content-disposition")).toMatch(/attachment/);
    expect(body).toContain("Name,Email,Signed up");
    expect(body).toContain("Ada,ada@x.com");
  });

  it("returns the 401 from requireAdmin", async () => {
    mockRequireAdmin.mockResolvedValue(new Response(null, { status: 401 }) as never);
    expect((await GET()).status).toBe(401);
    expect(sub.findMany).not.toHaveBeenCalled();
  });
});

describe("DELETE /api/admin/subscribers/[id]", () => {
  it("deletes a subscriber (200), 404 when missing", async () => {
    sub.delete.mockResolvedValue({});
    const del = new Request("http://t", { method: "DELETE" });
    expect((await DELETE(del, ctx("s1"))).status).toBe(200);
    sub.delete.mockRejectedValue({ code: "P2025" });
    expect((await DELETE(del, ctx("x"))).status).toBe(404);
  });
});
