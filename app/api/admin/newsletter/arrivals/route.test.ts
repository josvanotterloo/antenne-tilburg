// @vitest-environment node
import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@/lib/api-auth", () => ({
  requireAdmin: vi.fn().mockResolvedValue(null),
}));
vi.mock("@/lib/db", () => ({
  db: { product: { findMany: vi.fn() } },
}));

import { GET } from "@/app/api/admin/newsletter/arrivals/route";
import { db } from "@/lib/db";
import { requireAdmin } from "@/lib/api-auth";

const get = (qs: string) =>
  GET(new Request(`http://localhost/api/admin/newsletter/arrivals${qs}`));

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(requireAdmin).mockResolvedValue(null);
  vi.mocked(db.product.findMany).mockResolvedValue([] as never);
});

describe("GET /api/admin/newsletter/arrivals", () => {
  it("returns grouped arrivals for a valid range", async () => {
    vi.mocked(db.product.findMany).mockResolvedValue([
      {
        artist: "Vril",
        catalogNumber: "ZR-001",
        quantity: 1,
        createdAt: new Date("2026-07-14T10:00:00Z"),
        updatedAt: new Date("2026-07-14T10:00:00Z"),
        label: { name: "Zulema Records" },
        genre: { name: "Techno" },
      },
    ] as never);

    const res = await get("?from=2026-07-13&to=2026-07-17");
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual([
      {
        genre: "Techno",
        items: [
          {
            artist: "Vril",
            label: "Zulema Records",
            catalogNumber: "ZR-001",
            restock: false,
          },
        ],
      },
    ]);
  });

  it("400s a malformed or reversed range without querying", async () => {
    expect((await get("?from=nope&to=2026-07-17")).status).toBe(400);
    expect((await get("?from=2026-07-17&to=2026-07-13")).status).toBe(400);
    expect((await get("")).status).toBe(400);
    expect(db.product.findMany).not.toHaveBeenCalled();
  });

  it("returns the 401 from requireAdmin", async () => {
    vi.mocked(requireAdmin).mockResolvedValue(
      new Response(null, { status: 401 }) as never,
    );
    expect((await get("?from=2026-07-13&to=2026-07-17")).status).toBe(401);
  });
});
