export interface StockHistoryRow {
  id: string;
  type: "IN" | "OUT" | "ADJUSTMENT";
  quantity: number;
  note: string | null;
  createdAt: Date;
}

export interface StockHistoryEntry extends StockHistoryRow {
  runningBalance: number;
}

// `rows` must already be ordered oldest-first. The last entry's
// runningBalance equals Product.quantity by construction (see lib/stock.ts) —
// useful as a direct assertion of that invariant in integration tests.
export function computeRunningBalance(rows: StockHistoryRow[]): StockHistoryEntry[] {
  let balance = 0;
  const withBalance = rows.map((row) => {
    balance += row.quantity;
    return { ...row, runningBalance: balance };
  });
  return withBalance.slice().reverse();
}
