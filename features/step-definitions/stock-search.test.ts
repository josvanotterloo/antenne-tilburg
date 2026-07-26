// @vitest-environment node
import { loadFeature, describeFeature } from "@amiceli/vitest-cucumber";
import { vi, expect } from "vitest";

vi.mock("@/lib/db", () => ({
  db: {
    $queryRaw: vi.fn(),
    product: { findMany: vi.fn(), count: vi.fn() },
  },
}));

import { db } from "@/lib/db";
import { getCatalogPage } from "@/lib/catalog";

const feature = await loadFeature("features/stock-search.feature");

const PRODUCTS = [
  { id: "p1", artist: "Vril", title: "Torus" },
  { id: "p2", artist: "Surgeon", title: "Basictonalvocabulary" },
];

describeFeature(feature, ({ Scenario, BeforeEachScenario }) => {
  BeforeEachScenario(() => {
    vi.clearAllMocks();
  });

  Scenario("Searching the catalog by artist", ({ Given, When, Then }) => {
    let results: Awaited<ReturnType<typeof getCatalogPage>>;

    Given("there are products in the catalog", () => {
      // Mirrors real Prisma semantics: findMany only honours the FTS-matched
      // ids getCatalogPage injects into the where clause, so a regression
      // that stopped injecting them would make this test see both products.
      vi.mocked(db.product.findMany).mockImplementation((async ({
        where,
      }: {
        where?: { id?: { in: string[] } };
      } = {}) => {
        const rows = where?.id?.in
          ? PRODUCTS.filter((p) => where.id!.in.includes(p.id))
          : PRODUCTS;
        return rows;
      }) as never);
      vi.mocked(db.product.count).mockResolvedValue(1 as never);
      // "Vril" only matches p1 — the real full-text/trigram search narrows
      // to matching ids before findMany ever runs.
      vi.mocked(db.$queryRaw).mockResolvedValue([{ id: "p1" }] as never);
    });

    When("a visitor searches for an artist name", async () => {
      // /stock resolves search via getCatalogPage (lib/catalog.ts) — the
      // public /api/catalog JSON feed has no `q` search parameter today.
      results = await getCatalogPage({ q: "Vril", onlyInStock: true });
    });

    Then("only matching products are returned", () => {
      const arg = vi.mocked(db.$queryRaw).mock.calls[0][0] as {
        values: unknown[];
      };
      expect(arg.values).toContain("Vril");
      expect(results.products).toHaveLength(1);
      expect(results.products[0].id).toBe("p1");
    });
  });
});
