import type { Prisma, SupplyOrderLine } from "@prisma/client";

export type QuickAddResult =
  | { ok: true; status: 200 | 201; line: SupplyOrderLine }
  | { ok: false; status: 400 | 409; error: string };

const OPEN_STATUSES = ["PENDING", "SENT", "PARTIAL"] as const;

// Finds or creates the supplier's single open (non-RECEIVED) SupplyOrder and
// adds a one-quantity line for productId. Caller wraps this in db.$transaction
// — the find-then-act sequence isn't otherwise atomic, and this is a
// single-operator internal tool (see the accepted concurrent-receive race in
// docs/features/stock-management.md for the same tradeoff already made here).
export async function quickAddToOrder(
  tx: Prisma.TransactionClient,
  input: { productId: string },
): Promise<QuickAddResult> {
  const product = await tx.product.findUnique({
    where: { id: input.productId },
    select: { supplierId: true },
  });
  if (!product?.supplierId) {
    return { ok: false, status: 400, error: "Product has no supplier" };
  }

  const openOrder = await tx.supplyOrder.findFirst({
    where: { supplierId: product.supplierId, status: { in: [...OPEN_STATUSES] } },
    include: { lines: true },
  });

  if (openOrder) {
    // A fully-received line for this product is done — it shouldn't count
    // as "already in an open order" and block a fresh re-order.
    const existingLine = openOrder.lines.find(
      (l) => l.productId === input.productId && l.quantityReceived < l.quantityOrdered,
    );
    if (existingLine) {
      return { ok: false, status: 409, error: "Product already in open order" };
    }
    const line = await tx.supplyOrderLine.create({
      data: { supplyOrderId: openOrder.id, productId: input.productId, quantityOrdered: 1 },
    });
    return { ok: true, status: 200, line };
  }

  const created = await tx.supplyOrder.create({
    data: {
      supplierId: product.supplierId,
      orderedAt: new Date(),
      lines: { create: [{ productId: input.productId, quantityOrdered: 1 }] },
    },
    include: { lines: true },
  });
  return { ok: true, status: 201, line: created.lines[0] };
}
