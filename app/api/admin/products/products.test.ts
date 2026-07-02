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
const mockRequireAdmin = vi.mocked(requireAdmin);

const ROW = {
  id: "p1",
  artist: "Vril",
  title: "Torus",
  catalogNumber: "ZR-001",
  condition: "NEW",
  price: "24.99",
  inStock: true,
  label: { id: "l1", name: "Zulema Records" },
  genre: { id: "g1", name: "Techno" },
  productType: { id: "t1", name: "LP" },
};

const validBody = {
  artist: "Vril",
  title: "Torus",
  catalogNumber: "ZR-001",
  labelId: "l1",
  genreId: "g1",
  productTypeId: "t1",
  condition: "NEW",
  price: "24.99",
  description: null,
  inStock: true,
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
});

describe("GET /api/admin/products", () => {
  it("returns products with relations included", async () => {
    product.findMany.mockResolvedValue([ROW]);
    const res = await GET();
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual([ROW]);
    expect(product.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        include: { label: true, genre: true, productType: true },
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
        artist: "Vril",
        title: "Torus",
        condition: "NEW",
        price: "24.99",
        label: { connect: { id: "l1" } },
        genre: { connect: { id: "g1" } },
        productType: { connect: { id: "t1" } },
      }),
    });
  });

  it("rejects invalid input with 400 and does not write", async () => {
    const res = await POST(jsonReq("POST", { ...validBody, artist: "" }));
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
      data: expect.objectContaining({ artist: "Vril", price: "24.99" }),
    });
  });

  it("rejects invalid input with 400", async () => {
    const res = await PATCH(
      jsonReq("PATCH", { ...validBody, price: "-5" }),
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
});
