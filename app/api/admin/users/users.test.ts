// @vitest-environment node
import { describe, it, expect, vi, beforeEach, type Mock } from "vitest";

vi.mock("@/lib/api-auth", () => ({
  requireAdmin: vi.fn().mockResolvedValue(null),
}));
vi.mock("@/lib/db", () => ({
  db: { user: { findUnique: vi.fn(), update: vi.fn() } },
}));
vi.mock("bcrypt", () => ({ compare: vi.fn(), hash: vi.fn() }));

import { db } from "@/lib/db";
import { compare, hash } from "bcrypt";
import { GET, PATCH } from "@/app/api/admin/users/[id]/route";
import { PUT } from "@/app/api/admin/users/[id]/password/route";

const user = db.user as unknown as { findUnique: Mock; update: Mock };
const mockCompare = vi.mocked(compare);
const mockHash = vi.mocked(hash);

const req = (body: unknown) =>
  new Request("http://t", {
    method: "PUT",
    headers: { "content-type": "application/json" },
    ...(body === null ? {} : { body: JSON.stringify(body) }),
  });
const ctx = (id: string) => ({ params: Promise.resolve({ id }) });

beforeEach(() => vi.clearAllMocks());

describe("GET /api/admin/users/[id]", () => {
  it("returns the user without the password hash", async () => {
    user.findUnique.mockResolvedValue({ id: "u1", email: "a@b.c" });
    const res = await GET(req(null), ctx("u1"));
    expect(res.status).toBe(200);
    // never selects passwordHash
    expect(user.findUnique).toHaveBeenCalledWith(
      expect.objectContaining({
        select: { id: true, email: true, createdAt: true },
      }),
    );
    expect(await res.json()).not.toHaveProperty("passwordHash");
  });

  it("404s when missing", async () => {
    user.findUnique.mockResolvedValue(null);
    expect((await GET(req(null), ctx("x"))).status).toBe(404);
  });
});

describe("PATCH /api/admin/users/[id] (email)", () => {
  it("changes the email (200)", async () => {
    user.update.mockResolvedValue({ id: "u1", email: "new@b.c" });
    const res = await PATCH(req({ email: "New@B.c" }), ctx("u1"));
    expect(res.status).toBe(200);
    expect(user.update).toHaveBeenCalledWith({
      where: { id: "u1" },
      data: { email: "new@b.c" },
      select: { id: true, email: true, createdAt: true },
    });
  });

  it("rejects an invalid email (400)", async () => {
    expect((await PATCH(req({ email: "nope" }), ctx("u1"))).status).toBe(400);
    expect(user.update).not.toHaveBeenCalled();
  });

  it("returns 409 when the email is taken", async () => {
    user.update.mockRejectedValue({ code: "P2002" });
    expect((await PATCH(req({ email: "dup@b.c" }), ctx("u1"))).status).toBe(409);
  });
});

describe("PUT /api/admin/users/[id]/password", () => {
  it("sets a new hash after verifying the current password (200)", async () => {
    user.findUnique.mockResolvedValue({ id: "u1", passwordHash: "OLDHASH" });
    mockCompare.mockResolvedValue(true as never);
    mockHash.mockResolvedValue("NEWHASH" as never);
    user.update.mockResolvedValue({ id: "u1" });

    const res = await PUT(
      req({ currentPassword: "changeme123", newPassword: "newpassword1" }),
      ctx("u1"),
    );

    expect(res.status).toBe(200);
    expect(mockCompare).toHaveBeenCalledWith("changeme123", "OLDHASH");
    expect(user.update).toHaveBeenCalledWith({
      where: { id: "u1" },
      data: { passwordHash: "NEWHASH" },
    });
  });

  it("403s when the current password is wrong (no write)", async () => {
    user.findUnique.mockResolvedValue({ id: "u1", passwordHash: "OLDHASH" });
    mockCompare.mockResolvedValue(false as never);

    const res = await PUT(
      req({ currentPassword: "wrong", newPassword: "newpassword1" }),
      ctx("u1"),
    );

    expect(res.status).toBe(403);
    expect(user.update).not.toHaveBeenCalled();
    expect(mockHash).not.toHaveBeenCalled();
  });

  it("400s on a too-short new password", async () => {
    const res = await PUT(
      req({ currentPassword: "x", newPassword: "short" }),
      ctx("u1"),
    );
    expect(res.status).toBe(400);
  });

  it("404s when the user does not exist", async () => {
    user.findUnique.mockResolvedValue(null);
    const res = await PUT(
      req({ currentPassword: "x", newPassword: "newpassword1" }),
      ctx("x"),
    );
    expect(res.status).toBe(404);
  });
});
