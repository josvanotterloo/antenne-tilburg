// @vitest-environment node
import { describe, it, expect, vi, beforeEach, type Mock } from "vitest";

vi.mock("@/lib/api-auth", () => ({
  requireAdminUserId: vi.fn(),
}));
vi.mock("@/lib/db", () => ({
  db: { user: { update: vi.fn() } },
}));

import { requireAdminUserId } from "@/lib/api-auth";
import { db } from "@/lib/db";
import { NextResponse } from "next/server";
import { PATCH } from "@/app/api/admin/me/locale/route";

const mockRequireAdminUserId = vi.mocked(requireAdminUserId);
const update = db.user.update as unknown as Mock;

const patch = (body: unknown) =>
  PATCH(
    new Request("http://localhost/api/admin/me/locale", {
      method: "PATCH",
      body: typeof body === "string" ? body : JSON.stringify(body),
    }),
  );

beforeEach(() => {
  vi.clearAllMocks();
  mockRequireAdminUserId.mockResolvedValue({ userId: "u1" });
  update.mockResolvedValue({ id: "u1", locale: "EN" });
});

describe("PATCH /api/admin/me/locale", () => {
  it("updates the session user's own locale", async () => {
    const res = await patch({ locale: "EN" });

    expect(res.status).toBe(200);
    expect(update).toHaveBeenCalledWith({
      where: { id: "u1" },
      data: { locale: "EN" },
    });
  });

  it("rejects an invalid locale value with 400", async () => {
    const res = await patch({ locale: "FR" });

    expect(res.status).toBe(400);
    expect(update).not.toHaveBeenCalled();
  });

  it("ignores a userId in the body and only updates the session's own id", async () => {
    const res = await patch({ locale: "EN", userId: "someone-else" });

    expect(res.status).toBe(200);
    expect(update).toHaveBeenCalledWith({
      where: { id: "u1" },
      data: { locale: "EN" },
    });
  });

  it("returns 401 when unauthenticated", async () => {
    mockRequireAdminUserId.mockResolvedValue({
      denied: NextResponse.json({ error: "Unauthorized" }, { status: 401 }),
    });

    const res = await patch({ locale: "EN" });

    expect(res.status).toBe(401);
    expect(update).not.toHaveBeenCalled();
  });
});
