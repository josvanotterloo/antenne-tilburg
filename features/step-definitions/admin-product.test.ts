// @vitest-environment node
import { loadFeature, describeFeature } from "@amiceli/vitest-cucumber";
import { vi, expect } from "vitest";

vi.mock("@/lib/api-auth", () => ({
  requireAdmin: vi.fn().mockResolvedValue(null),
}));

const { store } = vi.hoisted(() => ({
  store: new Map<string, Record<string, unknown>>(),
}));

vi.mock("@/lib/db", () => {
  let seq = 0;
  const ROW_RELATIONS = {
    label: { id: "l1", name: "Zulema Records" },
    productType: { id: "t1", name: "LP" },
  };
  const ARTISTS: Record<string, { id: string; name: string }> = {
    a1: { id: "a1", name: "Vril" },
  };
  const GENRES: Record<string, { id: string; name: string }> = {
    g1: { id: "g1", name: "Techno" },
  };
  function resolveProductArtists(data: Record<string, unknown>) {
    const pa = data.productArtists as
      | { create?: { artistId: string; position: number }[] }
      | undefined;
    return (pa?.create ?? []).map(({ artistId, position }) => ({
      position,
      artistId,
      artist: ARTISTS[artistId],
    }));
  }
  function resolveProductGenres(data: Record<string, unknown>) {
    const pg = data.productGenres as
      | { create?: { genreId: string; position: number }[] }
      | undefined;
    return (pg?.create ?? []).map(({ genreId, position }) => ({
      position,
      genreId,
      genre: GENRES[genreId],
    }));
  }
  return {
    db: {
      artist: {
        findMany: vi.fn(
          async ({ where }: { where: { id: { in: string[] } } }) =>
            where.id.in.map((id) => ARTISTS[id]).filter(Boolean),
        ),
      },
      genre: {
        findMany: vi.fn(
          async ({ where }: { where: { id: { in: string[] } } }) =>
            where.id.in.map((id) => GENRES[id]).filter(Boolean),
        ),
      },
      product: {
        create: vi.fn(async ({ data }: { data: Record<string, unknown> }) => {
          const now = new Date();
          const row = {
            id: `p${++seq}`,
            createdAt: now,
            updatedAt: now,
            ...data,
            ...ROW_RELATIONS,
            productArtists: resolveProductArtists(data),
            productGenres: resolveProductGenres(data),
          };
          store.set(row.id, row);
          return row;
        }),
        findMany: vi.fn(
          async ({ where }: { where?: { inStock?: boolean } } = {}) => {
            const rows = [...store.values()];
            return where?.inStock ? rows.filter((r) => r.inStock) : rows;
          },
        ),
        count: vi.fn(
          async ({ where }: { where?: { inStock?: boolean } } = {}) => {
            const rows = [...store.values()];
            return where?.inStock
              ? rows.filter((r) => r.inStock).length
              : rows.length;
          },
        ),
      },
      $transaction: vi.fn((fn: (tx: unknown) => unknown) => fn({})),
    },
  };
});

vi.mock("@/lib/stock", () => ({
  // Route-level fake, not a re-implementation of the real ledger engine —
  // that has its own full unit coverage in lib/stock.test.ts (Task 2). This
  // mutates the same in-memory `store` the catalog query reads from, so this
  // scenario proves the adjust route's wiring end-to-end (auth -> parse ->
  // engine call -> catalog visibility) without re-testing floor/clamp math.
  applyStockTransaction: vi.fn(
    async (_tx: unknown, input: { productId: string; requestedQuantity: number }) => {
      const row = store.get(input.productId);
      if (!row) return { ok: false, error: "Product not found" };
      const previousQuantity = (row.quantity as number) ?? 0;
      const newQuantity = Math.max(0, previousQuantity + input.requestedQuantity);
      row.quantity = newQuantity;
      row.inStock = newQuantity > 0;
      return {
        ok: true,
        transaction: { id: "t1" },
        quantity: newQuantity,
        appliedQuantity: newQuantity - previousQuantity,
      };
    },
  ),
}));

import { requireAdmin } from "@/lib/api-auth";
import { POST } from "@/app/api/admin/products/route";
import { POST as adjustProduct } from "@/app/api/admin/products/[id]/adjust/route";
import { GET } from "@/app/api/catalog/route";

const feature = await loadFeature("features/admin-product.feature");

const VALID_PRODUCT = {
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

describeFeature(feature, ({ Scenario, BeforeEachScenario }) => {
  BeforeEachScenario(() => {
    store.clear();
    vi.clearAllMocks();
  });

  Scenario("Adding a new product", ({ Given, When, Then }) => {
    Given("an admin is logged in", async () => {
      expect(await requireAdmin()).toBeNull();
    });

    When("they submit a new product form with valid data", async () => {
      const res = await POST(
        new Request("http://localhost/api/admin/products", {
          method: "POST",
          body: JSON.stringify(VALID_PRODUCT),
        }),
      );
      expect(res.status).toBe(201);
    });

    Then("the product does not yet appear in the public catalog", async () => {
      const res = await GET(new Request("http://localhost/api/catalog"));
      const body = await res.json();
      expect(body.products).toHaveLength(0);
    });
  });

  Scenario("Adding stock makes a new product visible", ({ Given, When, Then }) => {
    let productId = "";

    Given("an admin is logged in", async () => {
      expect(await requireAdmin()).toBeNull();
    });

    When("they submit a new product form with valid data", async () => {
      const res = await POST(
        new Request("http://localhost/api/admin/products", {
          method: "POST",
          body: JSON.stringify(VALID_PRODUCT),
        }),
      );
      expect(res.status).toBe(201);
      const body = await res.json();
      productId = body.id;
    });

    When("they adjust its stock upward", async () => {
      const res = await adjustProduct(
        new Request(`http://localhost/api/admin/products/${productId}/adjust`, {
          method: "POST",
          body: JSON.stringify({ delta: 2, note: "opening stock" }),
        }),
        { params: Promise.resolve({ id: productId }) },
      );
      expect(res.status).toBe(200);
    });

    Then("the product appears in the public catalog", async () => {
      const res = await GET(new Request("http://localhost/api/catalog"));
      const body = await res.json();
      expect(body.products).toHaveLength(1);
      expect(body.products[0].artists).toEqual([{ id: "a1", name: "Vril" }]);
      expect(body.products[0].title).toBe("Torus");
    });
  });
});
