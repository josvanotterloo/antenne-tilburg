// @vitest-environment node
import { loadFeature, describeFeature } from "@amiceli/vitest-cucumber";
import { vi, expect } from "vitest";

vi.mock("@/lib/api-auth", () => ({
  requireAdmin: vi.fn().mockResolvedValue(null),
}));

// In-memory relational store shared by the fake `db` and the fake
// `applyStockTransaction` below, following the exact pattern used in
// features/step-definitions/admin-product.test.ts. This is the real
// lib/supply-order-quick-add.ts, lib/order-line-input.ts and
// lib/order-overview.ts running against a fake Prisma client — only the
// database driver and the stock ledger engine (already unit-tested in
// lib/stock.test.ts) are faked.
const { store } = vi.hoisted(() => ({
  store: {
    seq: 0,
    products: new Map<string, Record<string, unknown>>(),
    suppliers: new Map<string, Record<string, unknown>>(),
    labels: new Map<string, Record<string, unknown>>(),
    productTypes: new Map<string, Record<string, unknown>>(),
    supplyOrders: new Map<string, Record<string, unknown>>(),
    supplyOrderLines: new Map<string, Record<string, unknown>>(),
  },
}));

vi.mock("@/lib/db", () => {
  type Row = Record<string, unknown>;

  function nextId(prefix: string) {
    return `${prefix}${++store.seq}`;
  }

  function createLine(data: { supplyOrderId: string; productId: string; quantityOrdered: number }) {
    const now = new Date();
    const row: Row = {
      id: nextId("sl"),
      supplyOrderId: data.supplyOrderId,
      productId: data.productId,
      quantityOrdered: data.quantityOrdered,
      quantityReceived: 0,
      createdAt: now,
      updatedAt: now,
    };
    store.supplyOrderLines.set(row.id as string, row);
    return row;
  }

  function linesForOrder(orderId: string) {
    return [...store.supplyOrderLines.values()].filter((l) => l.supplyOrderId === orderId);
  }

  function resolveLineIncludes(line: Row, include: Row) {
    const result: Row = { ...line };
    if (include.supplyOrder) {
      const order = store.supplyOrders.get(line.supplyOrderId as string) as Row;
      const supplyOrderInclude = (include.supplyOrder as Row).include as Row | undefined;
      const supplyOrder: Row = { ...order };
      if (supplyOrderInclude?.supplier) {
        supplyOrder.supplier = store.suppliers.get(order.supplierId as string);
      }
      result.supplyOrder = supplyOrder;
    }
    if (include.product) {
      const product = store.products.get(line.productId as string) as Row;
      const productInclude = (include.product as Row).include as Row | undefined;
      const prod: Row = { ...product };
      if (productInclude?.label) prod.label = store.labels.get(product.labelId as string);
      if (productInclude?.productType) prod.productType = store.productTypes.get(product.productTypeId as string);
      if (productInclude?.productArtists) prod.productArtists = [];
      result.product = prod;
    }
    return result;
  }

  const db = {
    product: {
      findUnique: vi.fn(
        async ({ where, select }: { where: { id: string }; select?: Row }) => {
          const row = store.products.get(where.id);
          if (!row) return null;
          if (select) {
            const result: Row = {};
            for (const key of Object.keys(select)) result[key] = row[key];
            return result;
          }
          return row;
        },
      ),
    },
    supplyOrder: {
      findFirst: vi.fn(
        async ({
          where,
          include,
        }: {
          where: { supplierId: string; status?: { not: string } };
          include?: Row;
        }) => {
          const rows = [...store.supplyOrders.values()].filter(
            (o) =>
              o.supplierId === where.supplierId &&
              (where.status?.not ? o.status !== where.status.not : true),
          );
          const order = rows[0] as Row | undefined;
          if (!order) return null;
          if (include?.lines) return { ...order, lines: linesForOrder(order.id as string) };
          return order;
        },
      ),
      create: vi.fn(
        async ({
          data,
          include,
        }: {
          data: {
            supplierId: string;
            orderedAt: Date;
            lines: { create: { productId: string; quantityOrdered: number }[] };
          };
          include?: Row;
        }) => {
          const now = new Date();
          const order: Row = {
            id: nextId("so"),
            supplierId: data.supplierId,
            orderedAt: data.orderedAt,
            sentAt: null,
            receivedAt: null,
            status: "PENDING",
            createdAt: now,
            updatedAt: now,
          };
          store.supplyOrders.set(order.id as string, order);
          const createdLines = data.lines.create.map((l) =>
            createLine({ ...l, supplyOrderId: order.id as string }),
          );
          if (include?.lines) return { ...order, lines: createdLines };
          return order;
        },
      ),
      update: vi.fn(async ({ where, data }: { where: { id: string }; data: Row }) => {
        const order = store.supplyOrders.get(where.id) as Row;
        const updated = { ...order, ...data };
        store.supplyOrders.set(where.id, updated);
        return updated;
      }),
    },
    supplyOrderLine: {
      findUnique: vi.fn(
        async ({ where, include }: { where: { id: string }; include?: Row }) => {
          const row = store.supplyOrderLines.get(where.id) as Row | undefined;
          if (!row) return null;
          if (include?.supplyOrder) {
            return { ...row, supplyOrder: store.supplyOrders.get(row.supplyOrderId as string) };
          }
          return row;
        },
      ),
      update: vi.fn(async ({ where, data }: { where: { id: string }; data: Row }) => {
        const row = store.supplyOrderLines.get(where.id) as Row;
        const updated: Row = { ...row };
        if (typeof data.quantityOrdered === "number") updated.quantityOrdered = data.quantityOrdered;
        const increment = (data.quantityReceived as Row | undefined)?.increment;
        if (typeof increment === "number") {
          updated.quantityReceived = ((row.quantityReceived as number) ?? 0) + increment;
        }
        store.supplyOrderLines.set(where.id, updated);
        return updated;
      }),
      findMany: vi.fn(
        async ({
          where,
          orderBy,
          include,
        }: {
          where?: Row;
          orderBy?: { createdAt?: string };
          include?: Row;
        } = {}) => {
          let rows = [...store.supplyOrderLines.values()];
          if (where?.supplyOrderId) {
            rows = rows.filter((r) => r.supplyOrderId === where.supplyOrderId);
          }
          const statusFilter = (where?.supplyOrder as Row | undefined)?.status as
            | Row
            | undefined;
          if (statusFilter?.not) {
            rows = rows.filter(
              (r) =>
                (store.supplyOrders.get(r.supplyOrderId as string) as Row | undefined)
                  ?.status !== statusFilter.not,
            );
          }
          if (orderBy?.createdAt === "desc") {
            rows = rows
              .slice()
              .sort((a, b) => (b.createdAt as Date).getTime() - (a.createdAt as Date).getTime());
          }
          if (include) {
            rows = rows.map((r) => resolveLineIncludes(r, include));
          }
          return rows;
        },
      ),
    },
    $transaction: vi.fn((fn: (tx: unknown) => unknown) => fn(db)),
  };

  return { db };
});

vi.mock("@/lib/stock", () => ({
  // Route-level fake, not a re-implementation of the real ledger engine —
  // see lib/stock.test.ts for that. Mutates the same in-memory `store` the
  // overview query reads from, proving the receive route's wiring
  // (auth -> guard -> engine call -> order status -> catalog ledger) without
  // re-testing floor/clamp math or FOR UPDATE locking (already covered).
  applyStockTransaction: vi.fn(
    async (
      _tx: unknown,
      input: { productId: string; requestedQuantity: number },
    ) => {
      const row = store.products.get(input.productId);
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
import { POST as quickAdd } from "@/app/api/admin/orders/quick-add/route";
import { PATCH as setLineQuantity } from "@/app/api/admin/orders/lines/[id]/route";
import { PATCH as receiveLine } from "@/app/api/admin/orders/lines/[id]/receive/route";
import { GET as getOpenOrders } from "@/app/api/admin/orders/route";

const feature = await loadFeature("features/orders.feature");

const PRODUCT_ID = "p1";
const SUPPLIER_ID = "s1";

describeFeature(feature, ({ Scenario, BeforeEachScenario }) => {
  BeforeEachScenario(() => {
    store.seq = 0;
    store.products.clear();
    store.suppliers.clear();
    store.labels.clear();
    store.productTypes.clear();
    store.supplyOrders.clear();
    store.supplyOrderLines.clear();
    vi.clearAllMocks();
  });

  Scenario("Ordering and receiving a product end-to-end", ({ Given, When, Then }) => {
    let lineId = "";

    Given("a product with a supplier is in the catalog", async () => {
      expect(await requireAdmin()).toBeNull();
      store.suppliers.set(SUPPLIER_ID, { id: SUPPLIER_ID, name: "Zulema Distro" });
      store.labels.set("l1", { id: "l1", name: "Zulema Records" });
      store.productTypes.set("t1", { id: "t1", name: "LP" });
      store.products.set(PRODUCT_ID, {
        id: PRODUCT_ID,
        title: "Torus",
        labelId: "l1",
        productTypeId: "t1",
        supplierId: SUPPLIER_ID,
        quantity: 0,
        inStock: false,
      });
    });

    When("an admin quick-adds the product to a supply order", async () => {
      const res = await quickAdd(
        new Request("http://localhost/api/admin/orders/quick-add", {
          method: "POST",
          body: JSON.stringify({ productId: PRODUCT_ID }),
        }),
      );
      expect(res.status).toBe(201);
      const body = await res.json();
      lineId = body.id;
    });

    When("they set the order line's quantity to 4", async () => {
      const res = await setLineQuantity(
        new Request(`http://localhost/api/admin/orders/lines/${lineId}`, {
          method: "PATCH",
          body: JSON.stringify({ quantityOrdered: 4 }),
        }),
        { params: Promise.resolve({ id: lineId }) },
      );
      expect(res.status).toBe(200);
    });

    When("they receive all 4 units", async () => {
      const res = await receiveLine(
        new Request(`http://localhost/api/admin/orders/lines/${lineId}/receive`, {
          method: "PATCH",
          body: JSON.stringify({ quantityReceived: 4 }),
        }),
        { params: Promise.resolve({ id: lineId }) },
      );
      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body.status).toBe("RECEIVED");
    });

    Then("the order no longer appears in the open orders overview", async () => {
      const res = await getOpenOrders(
        new Request("http://localhost/api/admin/orders?groupBy=flat"),
      );
      const body = await res.json();
      expect(body.lines).toHaveLength(0);
    });

    Then("the product's stock reflects the received quantity", () => {
      const product = store.products.get(PRODUCT_ID) as { quantity: number; inStock: boolean };
      expect(product.quantity).toBe(4);
      expect(product.inStock).toBe(true);
    });
  });
});
