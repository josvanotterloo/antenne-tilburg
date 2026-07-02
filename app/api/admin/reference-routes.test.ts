// @vitest-environment node
import { describe, it, expect, vi, beforeEach, type Mock } from "vitest";

// The real db type is PrismaClient; at runtime it's the mock below. Cast the
// model delegates to loose mocks so mockResolvedValue accepts partial rows.
type MockModel = {
  findMany: Mock;
  create: Mock;
  findUnique: Mock;
  update: Mock;
  delete: Mock;
};

// Allow all requests; the auth gate itself is covered in lib/api-auth.test.ts.
vi.mock("@/lib/api-auth", () => ({
  requireAdmin: vi.fn().mockResolvedValue(null),
}));

function model() {
  return {
    findMany: vi.fn(),
    create: vi.fn(),
    findUnique: vi.fn(),
    update: vi.fn(),
    delete: vi.fn(),
  };
}

vi.mock("@/lib/db", () => ({
  db: { label: model(), genre: model(), productType: model() },
}));

import { db } from "@/lib/db";
import * as labelsCol from "@/app/api/admin/labels/route";
import * as labelsItem from "@/app/api/admin/labels/[id]/route";
import * as genresCol from "@/app/api/admin/genres/route";
import * as genresItem from "@/app/api/admin/genres/[id]/route";
import * as typesCol from "@/app/api/admin/product-types/route";
import * as typesItem from "@/app/api/admin/product-types/[id]/route";

const RESOURCES = [
  {
    name: "labels",
    model: db.label as unknown as MockModel,
    col: labelsCol,
    item: labelsItem,
  },
  {
    name: "genres",
    model: db.genre as unknown as MockModel,
    col: genresCol,
    item: genresItem,
  },
  {
    name: "product-types",
    model: db.productType as unknown as MockModel,
    col: typesCol,
    item: typesItem,
  },
] as const;

describe.each(RESOURCES)(
  "/api/admin/$name route wiring",
  ({ model, col, item }) => {
    beforeEach(() => vi.clearAllMocks());

    it("GET returns the model's rows", async () => {
      model.findMany.mockResolvedValue([{ id: "1", name: "X" }]);
      const res = await col.GET();
      expect(await res.json()).toEqual([{ id: "1", name: "X" }]);
    });

    it("DELETE enforces the in-use guard on this model", async () => {
      model.findUnique.mockResolvedValue({
        id: "1",
        name: "X",
        _count: { products: 2 },
      });
      const res = await item.DELETE(
        new Request("http://test", { method: "DELETE" }),
        { params: Promise.resolve({ id: "1" }) },
      );
      expect(res.status).toBe(409);
      expect(model.delete).not.toHaveBeenCalled();
    });
  },
);
