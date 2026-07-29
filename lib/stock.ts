import { Prisma, type StockTransaction, type StockTransactionType } from "@prisma/client";

// The one code path allowed to change Product.quantity. Floors at zero, and
// — critically — records the ACTUALLY-APPLIED delta (never the raw request)
// so that summing a product's transactions chronologically always equals its
// current Product.quantity. `requestedQuantity` must be nonzero; that's the
// caller's responsibility (sell-one always passes -1, adjust rejects a 0
// delta, receive only calls this for lines with receiveNow > 0).

export interface ApplyStockTransactionInput {
  productId: string;
  type: StockTransactionType;
  requestedQuantity: number;
  note?: string | null;
  supplyOrderLineId?: string | null;
}

export type ApplyStockTransactionResult =
  | { ok: true; transaction: StockTransaction; quantity: number; appliedQuantity: number }
  | { ok: false; error: string };

export async function applyStockTransaction(
  tx: Prisma.TransactionClient,
  input: ApplyStockTransactionInput,
): Promise<ApplyStockTransactionResult> {
  const rows = await tx.$queryRaw<{ newQuantity: number; previousQuantity: number }[]>(
    Prisma.sql`
      WITH prev AS (
        SELECT quantity FROM "Product" WHERE id = ${input.productId} FOR UPDATE
      )
      UPDATE "Product"
      SET quantity = GREATEST(0, (SELECT quantity FROM prev) + ${input.requestedQuantity}),
          "inStock" = GREATEST(0, (SELECT quantity FROM prev) + ${input.requestedQuantity}) > 0
      WHERE id = ${input.productId}
      RETURNING quantity AS "newQuantity", (SELECT quantity FROM prev) AS "previousQuantity"
    `,
  );

  const row = rows[0];
  if (!row) return { ok: false, error: "Product not found" };

  const appliedQuantity = row.newQuantity - row.previousQuantity;
  if (appliedQuantity === 0) {
    return {
      ok: false,
      error: input.requestedQuantity < 0 ? "Stock is already at zero" : "No change to apply",
    };
  }

  const transaction = await tx.stockTransaction.create({
    data: {
      productId: input.productId,
      type: input.type,
      quantity: appliedQuantity,
      note: input.note ?? null,
      supplyOrderLineId: input.supplyOrderLineId ?? null,
    },
  });

  return { ok: true, transaction, quantity: row.newQuantity, appliedQuantity };
}
