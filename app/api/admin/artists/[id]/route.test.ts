// @vitest-environment node
import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@/lib/api-auth", () => ({ requireAdmin: vi.fn() }));
vi.mock("@/lib/db", () => ({
  db: {
    artist: {
      update: vi.fn(),
      findUnique: vi.fn(),
      findFirst: vi.fn(),
      delete: vi.fn(),
    },
    product: { updateMany: vi.fn() },
    $transaction: vi.fn((ops: Promise<unknown>[]) => Promise.all(ops)),
  },
}));

import { requireAdmin } from "@/lib/api-auth";
import { db } from "@/lib/db";
import { PATCH, DELETE } from "@/app/api/admin/artists/[id]/route";
import { VARIOUS_ARTISTS_NAME } from "@/lib/resolve-artists";

const mockRequireAdmin = vi.mocked(requireAdmin);

function jsonRequest(body: unknown) {
  return new Request("http://test/api/admin/artists/1", {
    method: "PATCH",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
}
const ctx = (id: string) => ({ params: Promise.resolve({ id }) });
const delReq = () => new Request("http://test", { method: "DELETE" });

beforeEach(() => {
  vi.clearAllMocks();
  mockRequireAdmin.mockResolvedValue(null);
  vi.mocked(db.artist.findFirst).mockResolvedValue(null); // no normalized-name duplicate
  vi.mocked(db.artist.findUnique).mockResolvedValue(null); // vi.clearAllMocks() doesn't reset mockResolvedValue
});

describe("PATCH /api/admin/artists/[id]", () => {
  it("renames the artist and updates primaryArtistName on its position-0 products", async () => {
    vi.mocked(db.artist.update).mockResolvedValue({ id: "1", name: "House" } as never);
    vi.mocked(db.product.updateMany).mockResolvedValue({ count: 2 } as never);

    const res = await PATCH(jsonRequest({ name: "House" }), ctx("1"));

    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ id: "1", name: "House" });
    expect(db.artist.update).toHaveBeenCalledWith({
      where: { id: "1" },
      data: { name: "House", normalizedName: "house" },
    });
    expect(db.product.updateMany).toHaveBeenCalledWith({
      where: { productArtists: { some: { artistId: "1", position: 0 } } },
      data: { primaryArtistName: "House" },
    });
  });

  it("rejects a blank name with 400 and does not write", async () => {
    const res = await PATCH(jsonRequest({ name: "   " }), ctx("1"));
    expect(res.status).toBe(400);
    expect(db.artist.update).not.toHaveBeenCalled();
  });

  it("returns 409 when renamed to an existing name (P2002)", async () => {
    vi.mocked(db.artist.update).mockRejectedValue({ code: "P2002" });
    const res = await PATCH(jsonRequest({ name: "House" }), ctx("1"));
    expect(res.status).toBe(409);
  });

  it("allows an unchanged name even when another artist has a legacy normalized duplicate", async () => {
    vi.mocked(db.artist.findUnique).mockResolvedValue({
      name: "House",
      normalizedName: "house",
    } as never);
    vi.mocked(db.artist.findFirst).mockResolvedValue({ id: "legacy-duplicate" } as never);
    vi.mocked(db.artist.update).mockResolvedValue({ id: "1", name: "House" } as never);
    vi.mocked(db.product.updateMany).mockResolvedValue({ count: 0 } as never);

    const res = await PATCH(jsonRequest({ name: "House" }), ctx("1"));

    expect(res.status).toBe(200);
    expect(db.artist.findFirst).not.toHaveBeenCalled();
  });

  it("rejects a normalized-duplicate rename, excluding itself, before the write", async () => {
    vi.mocked(db.artist.findFirst).mockResolvedValue({ id: "other" } as never);

    const res = await PATCH(jsonRequest({ name: "HOUSE" }), ctx("1"));

    expect(res.status).toBe(409);
    expect(db.artist.findFirst).toHaveBeenCalledWith({
      where: { normalizedName: "house", id: { not: "1" } },
      select: { id: true },
    });
    expect(db.artist.update).not.toHaveBeenCalled();
  });

  it("returns the 401 from requireAdmin without hitting the db", async () => {
    mockRequireAdmin.mockResolvedValue(new Response(null, { status: 401 }) as never);
    const res = await PATCH(jsonRequest({ name: "House" }), ctx("1"));
    expect(res.status).toBe(401);
    expect(db.artist.update).not.toHaveBeenCalled();
  });

  it("refuses to rename the shared Various Artists entity", async () => {
    vi.mocked(db.artist.findUnique).mockResolvedValue({
      id: "va1",
      name: VARIOUS_ARTISTS_NAME,
    } as never);
    const res = await PATCH(jsonRequest({ name: "Compilation Artists" }), ctx("va1"));
    expect(res.status).toBe(400);
    expect(db.artist.update).not.toHaveBeenCalled();
  });
});

describe("DELETE /api/admin/artists/[id]", () => {
  it("returns 404 when the artist does not exist", async () => {
    vi.mocked(db.artist.findUnique).mockResolvedValue(null);
    const res = await DELETE(delReq(), ctx("missing"));
    expect(res.status).toBe(404);
    expect(db.artist.delete).not.toHaveBeenCalled();
  });

  it("is guarded (409) when products are still linked", async () => {
    vi.mocked(db.artist.findUnique).mockResolvedValue({
      id: "1",
      name: "Vril",
      _count: { productArtists: 3 },
    } as never);
    const res = await DELETE(delReq(), ctx("1"));
    expect(res.status).toBe(409);
    expect(await res.json()).toMatchObject({ count: 3 });
    expect(db.artist.delete).not.toHaveBeenCalled();
  });

  it("deletes when no products are linked", async () => {
    vi.mocked(db.artist.findUnique).mockResolvedValue({
      id: "1",
      name: "Vril",
      _count: { productArtists: 0 },
    } as never);
    const res = await DELETE(delReq(), ctx("1"));
    expect(res.status).toBe(200);
    expect(db.artist.delete).toHaveBeenCalledWith({ where: { id: "1" } });
  });
});
