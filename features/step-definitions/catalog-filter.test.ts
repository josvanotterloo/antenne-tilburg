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

const feature = await loadFeature("features/catalog-filter.feature");

const TECHNO = [{ id: "p1", artist: "Vril", genreId: "techno" }];

describeFeature(feature, ({ Scenario, BeforeEachScenario }) => {
  BeforeEachScenario(() => {
    vi.clearAllMocks();
  });

  Scenario("Filtering stock by genre", ({ Given, When, Then }) => {
    let results: Awaited<ReturnType<typeof getCatalogPage>>;

    Given("there are products in multiple genres", () => {
      // The mock only returns the row matching the where clause the
      // real Prisma call would apply — it doesn't filter in-memory here,
      // so the assertion below checks buildCatalogWhere was given genreId.
      vi.mocked(db.product.findMany).mockResolvedValue(TECHNO as never);
      vi.mocked(db.product.count).mockResolvedValue(1 as never);
    });

    When("a visitor filters by a specific genre", async () => {
      results = await getCatalogPage({ genreId: "techno", onlyInStock: true });
    });

    Then("only products in that genre are shown", () => {
      expect(results.products).toHaveLength(1);
      expect(vi.mocked(db.product.findMany)).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            productGenres: { some: { genreId: "techno" } },
          }),
        }),
      );
    });
  });
});
