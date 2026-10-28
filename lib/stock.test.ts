import { describe, it, expect, vi } from "vitest";

import { applyStockTransaction } from "@/lib/stock";
import { SYSTEM_ACTOR_ID } from "@/lib/log/events";

function fakeTx(rows: { newQuantity: number; previousQuantity: number }[]) {
  return {
    $queryRaw: vi.fn().mockResolvedValue(rows),
    stockTransaction: {
      create: vi.fn((args: { data: Record<string, unknown> }) =>
        Promise.resolve({ id: "t1", ...args.data }),
      ),
    },
  };
}

describe("applyStockTransaction", () => {
  it("records the full requested delta when it doesn't hit the floor", async () => {
    const tx = fakeTx([{ newQuantity: 3, previousQuantity: 5 }]);
    const result = await applyStockTransaction(tx as never, {
      productId: "p1",
      type: "OUT",
      requestedQuantity: -2,
      actorUserId: "u1",
    });
    expect(result).toMatchObject({ ok: true, quantity: 3, appliedQuantity: -2 });
    expect(tx.stockTransaction.create).toHaveBeenCalledWith({
      data: {
        productId: "p1",
        type: "OUT",
        quantity: -2,
        note: null,
        supplyOrderLineId: null,
      },
    });
  });

  it("clamps at zero and records the actually-applied (smaller) delta", async () => {
    // Requested -5 on a quantity of 2 — DB floors to 0, applied is -2.
    const tx = fakeTx([{ newQuantity: 0, previousQuantity: 2 }]);
    const result = await applyStockTransaction(tx as never, {
      productId: "p1",
      type: "ADJUSTMENT",
      requestedQuantity: -5,
      note: "recount",
      actorUserId: "u1",
    });
    expect(result).toMatchObject({ ok: true, quantity: 0, appliedQuantity: -2 });
    expect(tx.stockTransaction.create).toHaveBeenCalledWith({
      data: { productId: "p1", type: "ADJUSTMENT", quantity: -2, note: "recount", supplyOrderLineId: null },
    });
  });

  it("rejects a negative request when already at zero, with no transaction written", async () => {
    const tx = fakeTx([{ newQuantity: 0, previousQuantity: 0 }]);
    const result = await applyStockTransaction(tx as never, {
      productId: "p1",
      type: "OUT",
      requestedQuantity: -1,
      actorUserId: "u1",
    });
    expect(result).toEqual({ ok: false, error: "Stock is already at zero" });
    expect(tx.stockTransaction.create).not.toHaveBeenCalled();
  });

  it("returns 'Product not found' when the update matches no row", async () => {
    const tx = fakeTx([]);
    const result = await applyStockTransaction(tx as never, {
      productId: "missing",
      type: "IN",
      requestedQuantity: 5,
      actorUserId: "u1",
    });
    expect(result).toEqual({ ok: false, error: "Product not found" });
    expect(tx.stockTransaction.create).not.toHaveBeenCalled();
  });

  it("links an IN transaction to its supply order line", async () => {
    const tx = fakeTx([{ newQuantity: 10, previousQuantity: 5 }]);
    await applyStockTransaction(tx as never, {
      productId: "p1",
      type: "IN",
      requestedQuantity: 5,
      supplyOrderLineId: "line1",
      actorUserId: "u1",
    });
    expect(tx.stockTransaction.create).toHaveBeenCalledWith({
      data: { productId: "p1", type: "IN", quantity: 5, note: null, supplyOrderLineId: "line1" },
    });
  });

  describe("admin.mutation logging", () => {
    function captureLogs() {
      const logSpy = vi.spyOn(console, "log").mockImplementation(() => {});
      const errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
      return { logSpy, errorSpy };
    }

    it("logs admin.mutation ok with the actor id on a successful transaction", async () => {
      const tx = fakeTx([{ newQuantity: 3, previousQuantity: 5 }]);
      const { logSpy, errorSpy } = captureLogs();

      await applyStockTransaction(tx as never, {
        productId: "p1",
        type: "OUT",
        requestedQuantity: -2,
        actorUserId: "u1",
      });

      expect(errorSpy).not.toHaveBeenCalled();
      const event = JSON.parse(logSpy.mock.calls[0][0]);
      expect(event).toMatchObject({
        event: "admin.mutation",
        outcome: "ok",
        entity: "stock",
        action: "OUT",
        entityId: "p1",
        actorUserId: "u1",
      });
      vi.restoreAllMocks();
    });

    it("logs admin.mutation failed, still with the actor id, when the product is not found", async () => {
      const tx = fakeTx([]);
      const { errorSpy } = captureLogs();

      await applyStockTransaction(tx as never, {
        productId: "missing",
        type: "IN",
        requestedQuantity: 5,
        actorUserId: "u1",
      });

      const event = JSON.parse(errorSpy.mock.calls[0][0]);
      expect(event).toMatchObject({
        event: "admin.mutation",
        outcome: "failed",
        entity: "stock",
        action: "IN",
        entityId: "missing",
        actorUserId: "u1",
      });
      vi.restoreAllMocks();
    });

    it("lets a caller pass SYSTEM_ACTOR_ID when there is no human actor", async () => {
      const tx = fakeTx([{ newQuantity: 3, previousQuantity: 5 }]);
      const { logSpy } = captureLogs();

      await applyStockTransaction(tx as never, {
        productId: "p1",
        type: "ADJUSTMENT",
        requestedQuantity: -2,
        actorUserId: SYSTEM_ACTOR_ID,
      });

      const event = JSON.parse(logSpy.mock.calls[0][0]);
      expect(event.actorUserId).toBe("system");
      vi.restoreAllMocks();
    });
  });
});
