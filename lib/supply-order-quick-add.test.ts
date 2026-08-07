// @vitest-environment node
import { describe, it, expect, vi, type Mock } from "vitest";

import { quickAddToOrder } from "@/lib/supply-order-quick-add";

function makeTx() {
  return {
    product: { findUnique: vi.fn() },
    supplyOrder: { findFirst: vi.fn(), create: vi.fn() },
    supplyOrderLine: { create: vi.fn() },
  };
}
type Tx = ReturnType<typeof makeTx>;
const asTx = (tx: Tx) => tx as unknown as Parameters<typeof quickAddToOrder>[0];

describe("quickAddToOrder", () => {
  it("400s a product with no supplier, without querying orders", async () => {
    const tx = makeTx();
    (tx.product.findUnique as Mock).mockResolvedValue({ supplierId: null });
    const result = await quickAddToOrder(asTx(tx), { productId: "p1" });
    expect(result).toEqual({ ok: false, status: 400, error: "Product has no supplier" });
    expect(tx.supplyOrder.findFirst).not.toHaveBeenCalled();
  });

  it("creates a new PENDING order when none is open for the supplier", async () => {
    const tx = makeTx();
    (tx.product.findUnique as Mock).mockResolvedValue({ supplierId: "s1" });
    (tx.supplyOrder.findFirst as Mock).mockResolvedValue(null);
    (tx.supplyOrder.create as Mock).mockResolvedValue({
      id: "o1",
      lines: [{ id: "l1", supplyOrderId: "o1", productId: "p1", quantityOrdered: 1, quantityReceived: 0 }],
    });

    const result = await quickAddToOrder(asTx(tx), { productId: "p1" });

    expect(result).toEqual({
      ok: true,
      status: 201,
      line: { id: "l1", supplyOrderId: "o1", productId: "p1", quantityOrdered: 1, quantityReceived: 0 },
    });
    expect(tx.supplyOrder.create).toHaveBeenCalledWith({
      data: {
        supplierId: "s1",
        orderedAt: expect.any(Date),
        lines: { create: [{ productId: "p1", quantityOrdered: 1 }] },
      },
      include: { lines: true },
    });
  });

  it("searches for any non-RECEIVED order when looking for an existing order", async () => {
    const tx = makeTx();
    (tx.product.findUnique as Mock).mockResolvedValue({ supplierId: "s1" });
    (tx.supplyOrder.findFirst as Mock).mockResolvedValue({ id: "o1", status: "PARTIAL", lines: [] });
    (tx.supplyOrderLine.create as Mock).mockResolvedValue({
      id: "l2", supplyOrderId: "o1", productId: "p1", quantityOrdered: 1, quantityReceived: 0,
    });

    const result = await quickAddToOrder(asTx(tx), { productId: "p1" });

    expect(result.ok).toBe(true);
    if (result.ok) expect(result.status).toBe(200);
    expect(tx.supplyOrder.findFirst).toHaveBeenCalledWith({
      where: { supplierId: "s1", status: { not: "RECEIVED" } },
      include: { lines: true },
    });
    expect(tx.supplyOrderLine.create).toHaveBeenCalledWith({
      data: { supplyOrderId: "o1", productId: "p1", quantityOrdered: 1 },
    });
  });

  it("409s when the product already has a not-fully-received line in the open order, without creating a line", async () => {
    const tx = makeTx();
    (tx.product.findUnique as Mock).mockResolvedValue({ supplierId: "s1" });
    (tx.supplyOrder.findFirst as Mock).mockResolvedValue({
      id: "o1",
      status: "PENDING",
      lines: [{ id: "l1", productId: "p1", quantityOrdered: 1, quantityReceived: 0 }],
    });

    const result = await quickAddToOrder(asTx(tx), { productId: "p1" });

    expect(result).toEqual({ ok: false, status: 409, error: "Product already in open order" });
    expect(tx.supplyOrderLine.create).not.toHaveBeenCalled();
  });

  it("does not 409 when the product's only existing line in the open order is fully received — adds a fresh line instead", async () => {
    const tx = makeTx();
    (tx.product.findUnique as Mock).mockResolvedValue({ supplierId: "s1" });
    (tx.supplyOrder.findFirst as Mock).mockResolvedValue({
      id: "o1",
      status: "PARTIAL",
      lines: [
        { id: "l1", productId: "p1", quantityOrdered: 2, quantityReceived: 2 },
        { id: "l2", productId: "p2", quantityOrdered: 1, quantityReceived: 0 },
      ],
    });
    (tx.supplyOrderLine.create as Mock).mockResolvedValue({
      id: "l3", supplyOrderId: "o1", productId: "p1", quantityOrdered: 1, quantityReceived: 0,
    });

    const result = await quickAddToOrder(asTx(tx), { productId: "p1" });

    expect(result.ok).toBe(true);
    if (result.ok) expect(result.status).toBe(200);
    expect(tx.supplyOrderLine.create).toHaveBeenCalledWith({
      data: { supplyOrderId: "o1", productId: "p1", quantityOrdered: 1 },
    });
  });
});
