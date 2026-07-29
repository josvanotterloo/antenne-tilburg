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
    genre: { id: "g1", name: "Techno" },
    productType: { id: "t1", name: "LP" },
  };
  const ARTISTS: Record<string, { id: string; name: string }> = {
    a1: { id: "a1", name: "Vril" },
  };
  // Resolves the { create: [{ artistId, position }] } nested write (see
  // lib/product-input.ts's toProductData) into the shape a real
  // `include: { productArtists: { include: { artist: true } } }` query would
  // return — this fake store doesn't run Prisma's own resolution.
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
  return {
    db: {
      artist: {
        findUnique: vi.fn(async ({ where }: { where: { id: string } }) =>
          ARTISTS[where.id] ?? null,
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
            // Overrides the raw { create: [...] } write shape from ...data
            // with the resolved, include-shaped array.
            productArtists: resolveProductArtists(data),
          };
          store.set(row.id, row);
          return row;
        }),
        // Filters by where.inStock like real Prisma would — so a regression
        // in toProductData's inStock derivation makes the created row
        // disappear from the public catalog query, same as production.
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
    },
  };
});

import { requireAdmin } from "@/lib/api-auth";
import { POST } from "@/app/api/admin/products/route";
import { GET } from "@/app/api/catalog/route";

const feature = await loadFeature("features/admin-product.feature");

const VALID_PRODUCT = {
  artistIds: ["a1"],
  title: "Torus",
  catalogNumber: "ZR-001",
  labelId: "l1",
  genreId: "g1",
  productTypeId: "t1",
  condition: "NEW",
  price: "24.99",
  description: null,
  quantity: 2,
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

    Then("the product appears in the public catalog", async () => {
      const res = await GET(new Request("http://localhost/api/catalog"));
      const body = await res.json();
      expect(body.products).toHaveLength(1);
      expect(body.products[0].artists).toEqual([{ id: "a1", name: "Vril" }]);
      expect(body.products[0].title).toBe("Torus");
    });
  });
});
