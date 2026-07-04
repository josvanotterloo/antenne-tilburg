// @vitest-environment node
import { describe, it, expect, vi, beforeEach, type Mock } from "vitest";

vi.mock("@/lib/api-auth", () => ({
  requireAdmin: vi.fn().mockResolvedValue(null),
}));
vi.mock("@/lib/db", () => ({
  db: {
    $transaction: vi.fn().mockResolvedValue([]),
    openingHours: { upsert: vi.fn() },
  },
}));

import { db } from "@/lib/db";
import { PUT } from "@/app/api/admin/opening-hours/route";
import { requireAdmin } from "@/lib/api-auth";

const dbMock = db as unknown as {
  $transaction: Mock;
  openingHours: { upsert: Mock };
};
const mockRequireAdmin = vi.mocked(requireAdmin);

const req = (body: unknown) =>
  new Request("http://t/api/admin/opening-hours", {
    method: "PUT",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });

const validHours = [
  { dayOfWeek: 1, opensAt: "12:00", closesAt: "18:00", closed: false },
  { dayOfWeek: 0, opensAt: "", closesAt: "", closed: true },
];

beforeEach(() => {
  vi.clearAllMocks();
  mockRequireAdmin.mockResolvedValue(null);
});

describe("PUT /api/admin/opening-hours", () => {
  it("upserts each row in a transaction (200)", async () => {
    const res = await PUT(req({ hours: validHours }));
    expect(res.status).toBe(200);
    expect(dbMock.openingHours.upsert).toHaveBeenCalledTimes(2);
    expect(dbMock.openingHours.upsert).toHaveBeenCalledWith({
      where: { dayOfWeek: 1 },
      update: { dayOfWeek: 1, opensAt: "12:00", closesAt: "18:00", closed: false },
      create: { dayOfWeek: 1, opensAt: "12:00", closesAt: "18:00", closed: false },
    });
    expect(dbMock.$transaction).toHaveBeenCalledTimes(1);
  });

  it("rejects invalid input (400) without writing", async () => {
    const res = await PUT(
      req({ hours: [{ dayOfWeek: 1, opensAt: "nope", closesAt: "x", closed: false }] }),
    );
    expect(res.status).toBe(400);
    expect(dbMock.openingHours.upsert).not.toHaveBeenCalled();
    expect(dbMock.$transaction).not.toHaveBeenCalled();
  });

  it("returns the 401 from requireAdmin", async () => {
    mockRequireAdmin.mockResolvedValue(new Response(null, { status: 401 }) as never);
    expect((await PUT(req({ hours: validHours }))).status).toBe(401);
    expect(dbMock.openingHours.upsert).not.toHaveBeenCalled();
  });
});
