import { db } from "@/lib/db";
import { shopMonthRange } from "@/lib/catalog";

export interface MonthTransaction {
  id: string;
  type: "IN" | "OUT" | "ADJUSTMENT";
  quantity: number;
  createdAt: Date;
  product: {
    id: string;
    title: string;
    catalogNumber: string | null;
    supplierId: string | null;
    label: { name: string };
    productArtists: { position: number; artist: { name: string } }[];
  };
}

// No running balance here — unlike lib/stock-history.ts's per-product view,
// a cross-product balance is meaningless. This is a raw chronological ledger.
export async function getMonthTransactions(
  month: string,
): Promise<MonthTransaction[]> {
  const range = shopMonthRange(month);
  if (!range) return [];
  return db.stockTransaction.findMany({
    where: { createdAt: { gte: range.start, lt: range.end } },
    orderBy: { createdAt: "desc" },
    include: {
      product: {
        include: {
          label: true,
          productArtists: { include: { artist: true }, orderBy: { position: "asc" } },
        },
      },
    },
  });
}
