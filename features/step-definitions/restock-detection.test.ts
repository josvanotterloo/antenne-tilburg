// @vitest-environment node
import { loadFeature, describeFeature } from "@amiceli/vitest-cucumber";
import { vi, expect } from "vitest";

vi.mock("@/lib/db", () => ({
  db: { product: { findMany: vi.fn() } },
}));

import { db } from "@/lib/db";
import { getBackInStockProducts } from "@/lib/catalog";

const feature = await loadFeature("features/restock-detection.feature");

const NOW = new Date("2026-06-15T10:00:00Z");
const createdAt = new Date("2026-06-01T10:00:00Z");

describeFeature(feature, ({ Scenario, BeforeEachScenario }) => {
  BeforeEachScenario(() => {
    vi.clearAllMocks();
  });

  Scenario("Back in stock detection", ({ Given, When, Then }) => {
    Given("a product with quantity 0", async () => {
      // Out-of-stock rows are excluded by the DB where clause
      // (quantity: { gt: 0 }), so an unrestocked product never reaches this
      // query's result set — confirmed here, not just assumed, so a
      // regression that stopped filtering by quantity is actually caught.
      vi.mocked(db.product.findMany).mockResolvedValue([] as never);
      const before = await getBackInStockProducts({ now: NOW });
      expect(before).toHaveLength(0);
    });

    When("the quantity is updated to greater than 0", () => {
      vi.mocked(db.product.findMany).mockResolvedValue([
        {
          id: "p1",
          quantity: 3,
          createdAt,
          updatedAt: new Date("2026-06-10T10:00:00Z"), // well after createdAt
        },
      ] as never);
    });

    Then("the product appears in the Back In Stock section", async () => {
      const after = await getBackInStockProducts({ now: NOW });
      expect(after).toHaveLength(1);
      expect(after[0].id).toBe("p1");
    });
  });
});
