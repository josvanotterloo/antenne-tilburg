// @vitest-environment node
import { describe, it, expect, vi, beforeEach, type Mock } from "vitest";

vi.mock("@/lib/api-auth", () => ({
  requireAdmin: vi.fn().mockResolvedValue(null),
}));
vi.mock("@/lib/db", () => ({
  db: {
    product: {
      findMany: vi.fn(),
      findUnique: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
    },
    artist: { findMany: vi.fn(), upsert: vi.fn() },
    genre: { findMany: vi.fn() },
  },
}));

import { db } from "@/lib/db";
import { GET, POST } from "@/app/api/admin/products/route";
import {
  GET as GET_ONE,
  PATCH,
  DELETE,
} from "@/app/api/admin/products/[id]/route";
import { requireAdmin } from "@/lib/api-auth";

const product = db.product as unknown as {
  findMany: Mock;
  findUnique: Mock;
  create: Mock;
  update: Mock;
  delete: Mock;
};
const artist = db.artist as unknown as { findMany: Mock; upsert: Mock };
const genre = db.genre as unknown as { findMany: Mock };
const mockRequireAdmin = vi.mocked(requireAdmin);

const ROW = {
  id: "p1",
  primaryArtistName: "Vril",
  productArtists: [
    { position: 0, artistId: "a1", artist: { id: "a1", name: "Vril" } },
  ],
  title: "Torus",
  catalogNumber: "ZR-001",
  condition: "NEW",
  price: "24.99",
  quantity: 2,
  inStock: true,
  label: { id: "l1", name: "Zulema Records" },
  productGenres: [
    { position: 0, genreId: "g1", genre: { id: "g1", name: "Techno" } },
  ],
  productType: { id: "t1", name: "LP" },
};

const validBody = {
  artistIds: ["a1"],
  title: "Torus",
  catalogNumber: "ZR-001",
  labelId: "l1",
  genreIds: ["g1"],
  productTypeId: "t1",
  condition: "NEW",
  price: "24.99",
  description: null,
};

function jsonReq(method: string, body: unknown) {
  return new Request("http://test/api/admin/products", {
    method,
    headers: { "content-type": "application/json" },
    // GET/HEAD requests cannot carry a body; only attach one when provided.
    ...(body === null ? {} : { body: JSON.stringify(body) }),
  });
}

const ctx = (id: string) => ({ params: Promise.resolve({ id }) });

beforeEach(() => {
  vi.clearAllMocks();
  mockRequireAdmin.mockResolvedValue(null);
  artist.findMany.mockResolvedValue([{ id: "a1", name: "Vril" }]);
  artist.upsert.mockResolvedValue({ id: "va1", name: "Various Artists" });
  genre.findMany.mockResolvedValue([{ id: "g1", name: "Techno" }]);
});

describe("GET /api/admin/products", () => {
  it("returns products with relations included", async () => {
    product.findMany.mockResolvedValue([ROW]);
    const res = await GET();
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual([ROW]);
    expect(product.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        include: expect.objectContaining({
          label: true,
          productType: true,
          productGenres: expect.objectContaining({ include: { genre: true } }),
        }),
      }),
    );
  });
});

describe("POST /api/admin/products", () => {
  it("creates a product from valid input (201) with relation connects", async () => {
    product.create.mockResolvedValue(ROW);
    const res = await POST(jsonReq("POST", validBody));
    expect(res.status).toBe(201);
    expect(product.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        primaryArtistName: "Vril",
        productArtists: { create: [{ artistId: "a1", position: 0 }] },
        productGenres: { create: [{ genreId: "g1", position: 0 }] },
        title: "Torus",
        condition: "NEW",
        price: "24.99",
        label: { connect: { id: "l1" } },
        productType: { connect: { id: "t1" } },
      }),
    });
  });

  it("returns 400 when the primary artist no longer exists", async () => {
    artist.findMany.mockResolvedValue([]);
    const res = await POST(jsonReq("POST", validBody));
    expect(res.status).toBe(400);
    expect(product.create).not.toHaveBeenCalled();
  });

  it("returns 400 when a non-primary artist no longer exists (not just the primary)", async () => {
    // The exact gap the review found: only artistIds[0] used to be checked,
    // so a missing second artist hit an unhandled FK violation instead.
    artist.findMany.mockResolvedValue([{ id: "a1", name: "Vril" }]);
    const res = await POST(
      jsonReq("POST", { ...validBody, artistIds: ["a1", "a2"] }),
    );
    expect(res.status).toBe(400);
    expect(product.create).not.toHaveBeenCalled();
  });

  it("returns 400 when the primary genre no longer exists", async () => {
    genre.findMany.mockResolvedValue([]);
    const res = await POST(jsonReq("POST", validBody));
    expect(res.status).toBe(400);
    expect(product.create).not.toHaveBeenCalled();
  });

  it("returns 400 when a non-primary genre no longer exists (not just the primary)", async () => {
    genre.findMany.mockResolvedValue([{ id: "g1", name: "Techno" }]);
    const res = await POST(
      jsonReq("POST", { ...validBody, genreIds: ["g1", "g2"] }),
    );
    expect(res.status).toBe(400);
    expect(product.create).not.toHaveBeenCalled();
  });

  it("creates ordered ProductGenre links for multiple genres", async () => {
    genre.findMany.mockResolvedValue([
      { id: "g1", name: "Techno" },
      { id: "g2", name: "House" },
    ]);
    product.create.mockResolvedValue(ROW);
    const res = await POST(
      jsonReq("POST", { ...validBody, genreIds: ["g1", "g2"] }),
    );
    expect(res.status).toBe(201);
    expect(product.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        productGenres: {
          create: [
            { genreId: "g1", position: 0 },
            { genreId: "g2", position: 1 },
          ],
        },
      }),
    });
  });

  it("accepts and stores a coverImage URL", async () => {
    product.create.mockResolvedValue(ROW);
    const res = await POST(
      jsonReq("POST", { ...validBody, coverImage: "/uploads/cover.webp" }),
    );
    expect(res.status).toBe(201);
    expect(product.create).toHaveBeenCalledWith({
      data: expect.objectContaining({ coverImage: "/uploads/cover.webp" }),
    });
  });

  it("rejects invalid input with 400 and does not write", async () => {
    const res = await POST(jsonReq("POST", { ...validBody, artistIds: [] }));
    expect(res.status).toBe(400);
    expect(product.create).not.toHaveBeenCalled();
  });

  it("returns the 401 from requireAdmin", async () => {
    mockRequireAdmin.mockResolvedValue(
      new Response(null, { status: 401 }) as never,
    );
    const res = await POST(jsonReq("POST", validBody));
    expect(res.status).toBe(401);
    expect(product.create).not.toHaveBeenCalled();
  });

  it("returns 400 (not an unhandled 500) when a relation id does not exist (P2025)", async () => {
    // parseProductInput only checks ids are non-empty; a bogus/just-deleted
    // labelId makes the nested connect throw P2025.
    product.create.mockRejectedValue({ code: "P2025" });
    const res = await POST(jsonReq("POST", validBody));
    expect(res.status).toBe(400);
  });

  it("links the Various Artists entity (creating it if absent) and stores contents", async () => {
    product.create.mockResolvedValue(ROW);
    const res = await POST(
      jsonReq("POST", {
        ...validBody,
        artistIds: undefined,
        isVariousArtists: true,
        contents: "Surgeon, Regis",
      }),
    );
    expect(res.status).toBe(201);
    expect(artist.upsert).toHaveBeenCalledWith({
      where: { name: "Various Artists" },
      update: {},
      create: { name: "Various Artists" },
    });
    expect(artist.findMany).not.toHaveBeenCalled();
    expect(product.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        primaryArtistName: "Various Artists",
        productArtists: { create: [{ artistId: "va1", position: 0 }] },
        isVariousArtists: true,
        contents: "Surgeon, Regis",
      }),
    });
  });

  it("reuses the same Various Artists entity id across separate VA products", async () => {
    product.create.mockResolvedValue(ROW);
    await POST(
      jsonReq("POST", { ...validBody, artistIds: undefined, isVariousArtists: true }),
    );
    await POST(
      jsonReq("POST", { ...validBody, artistIds: undefined, isVariousArtists: true }),
    );
    const calls = product.create.mock.calls as { data: { productArtists: { create: { artistId: string }[] } } }[][];
    expect(calls[0][0].data.productArtists.create[0].artistId).toBe("va1");
    expect(calls[1][0].data.productArtists.create[0].artistId).toBe("va1");
  });
});

describe("GET /api/admin/products/[id]", () => {
  it("returns a product with relations", async () => {
    product.findUnique.mockResolvedValue(ROW);
    const res = await GET_ONE(jsonReq("GET", null), ctx("p1"));
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual(ROW);
  });

  it("returns 404 when not found", async () => {
    product.findUnique.mockResolvedValue(null);
    const res = await GET_ONE(jsonReq("GET", null), ctx("missing"));
    expect(res.status).toBe(404);
  });
});

describe("PATCH /api/admin/products/[id]", () => {
  it("updates from valid input (200)", async () => {
    product.update.mockResolvedValue(ROW);
    const res = await PATCH(jsonReq("PATCH", validBody), ctx("p1"));
    expect(res.status).toBe(200);
    expect(product.update).toHaveBeenCalledWith({
      where: { id: "p1" },
      data: expect.objectContaining({
        primaryArtistName: "Vril",
        productArtists: {
          deleteMany: {},
          create: [{ artistId: "a1", position: 0 }],
        },
        productGenres: {
          deleteMany: {},
          create: [{ genreId: "g1", position: 0 }],
        },
        price: "24.99",
      }),
    });
  });

  it("returns 400 when the primary artist no longer exists", async () => {
    artist.findMany.mockResolvedValue([]);
    const res = await PATCH(jsonReq("PATCH", validBody), ctx("p1"));
    expect(res.status).toBe(400);
    expect(product.update).not.toHaveBeenCalled();
  });

  it("returns 400 when the primary genre no longer exists", async () => {
    genre.findMany.mockResolvedValue([]);
    const res = await PATCH(jsonReq("PATCH", validBody), ctx("p1"));
    expect(res.status).toBe(400);
    expect(product.update).not.toHaveBeenCalled();
  });

  it("returns 400 when a non-primary artist no longer exists", async () => {
    artist.findMany.mockResolvedValue([{ id: "a1", name: "Vril" }]);
    const res = await PATCH(
      jsonReq("PATCH", { ...validBody, artistIds: ["a1", "a2"] }),
      ctx("p1"),
    );
    expect(res.status).toBe(400);
    expect(product.update).not.toHaveBeenCalled();
  });

  it("rejects invalid input with 400", async () => {
    const res = await PATCH(
      jsonReq("PATCH", { ...validBody, price: "-5" }),
      ctx("p1"),
    );
    expect(res.status).toBe(400);
    expect(product.update).not.toHaveBeenCalled();
  });

  it("returns 404 when the product was deleted concurrently (P2025)", async () => {
    product.update.mockRejectedValue({ code: "P2025" });
    const res = await PATCH(jsonReq("PATCH", validBody), ctx("gone"));
    expect(res.status).toBe(404);
  });

  it("clears contents to null when toggling isVariousArtists off", async () => {
    product.update.mockResolvedValue(ROW);
    const res = await PATCH(
      jsonReq("PATCH", { ...validBody, isVariousArtists: false, contents: "stale" }),
      ctx("p1"),
    );
    expect(res.status).toBe(200);
    expect(product.update).toHaveBeenCalledWith({
      where: { id: "p1" },
      data: expect.objectContaining({ contents: null, isVariousArtists: false }),
    });
  });

  it("requires a real artist selection when isVariousArtists is false and none given", async () => {
    const res = await PATCH(
      jsonReq("PATCH", { ...validBody, artistIds: [], isVariousArtists: false }),
      ctx("p1"),
    );
    expect(res.status).toBe(400);
    expect(product.update).not.toHaveBeenCalled();
  });
});

describe("DELETE /api/admin/products/[id]", () => {
  it("deletes and returns ok", async () => {
    product.delete.mockResolvedValue(ROW);
    const res = await DELETE(jsonReq("DELETE", null), ctx("p1"));
    expect(res.status).toBe(200);
    expect(product.delete).toHaveBeenCalledWith({ where: { id: "p1" } });
  });

  it("returns 404 when the product does not exist (P2025)", async () => {
    product.delete.mockRejectedValue({ code: "P2025" });
    const res = await DELETE(jsonReq("DELETE", null), ctx("missing"));
    expect(res.status).toBe(404);
  });

  it("409s (not an unhandled 500) when the product has stock history (P2003)", async () => {
    product.delete.mockRejectedValue({ code: "P2003" });
    const res = await DELETE(jsonReq("DELETE", null), ctx("p1"));
    expect(res.status).toBe(409);
  });
});
