import Link from "next/link";

import {
  shopMonthISO,
  shopMonthRange,
  shiftMonth,
  joinArtistNames,
  shopDisplayDate,
  shopDisplayTime,
} from "@/lib/catalog";
import { getMonthTransactions } from "@/lib/transactions-overview";
import { getOpenOrderProductIds } from "@/lib/open-order-lookup";
import { OrderButton } from "@/components/admin/OrderButton";

export const dynamic = "force-dynamic";

const MONTH_LABEL = new Intl.DateTimeFormat("en-US", {
  month: "long",
  year: "numeric",
  timeZone: "UTC",
});
export default async function TransactionsPage({
  searchParams,
}: {
  searchParams: Promise<{ month?: string }>;
}) {
  const sp = await searchParams;
  // Reuse shopMonthRange's validation (it already range-checks the month)
  // instead of duplicating a syntax-only regex that would accept "2026-13".
  const month =
    sp.month && shopMonthRange(sp.month) ? sp.month : shopMonthISO(new Date());
  const prevMonth = shiftMonth(month, -1);
  const nextMonth = shiftMonth(month, 1);

  const transactions = await getMonthTransactions(month);
  const outProductIds = transactions.filter((t) => t.type === "OUT").map((t) => t.product.id);
  const openOrderProductIds = await getOpenOrderProductIds(outProductIds);

  const [year, mo] = month.split("-").map(Number);
  const monthLabel = MONTH_LABEL.format(new Date(Date.UTC(year, mo - 1, 1)));

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold tracking-tight">Transactions</h1>

      <nav className="flex items-center justify-center gap-4 text-sm">
        <Link
          href={`/admin/catalog/transactions?month=${prevMonth}`}
          className="rounded border border-admin-hairline px-2 py-1 hover:bg-admin-raised"
        >
          ← Prev
        </Link>
        <span className="font-medium">Current selection: {monthLabel}</span>
        <Link
          href={`/admin/catalog/transactions?month=${nextMonth}`}
          className="rounded border border-admin-hairline px-2 py-1 hover:bg-admin-raised"
        >
          Next →
        </Link>
      </nav>

      {transactions.length === 0 ? (
        <p className="rounded border border-dashed border-admin-hairline p-8 text-center text-admin-ink-muted">
          No transactions in {monthLabel}.
        </p>
      ) : (
        <div className="overflow-x-auto rounded border border-admin-hairline bg-admin-surface">
          <table className="w-full text-left text-sm">
            <thead className="border-b border-admin-hairline bg-admin-bg text-xs text-admin-ink-muted">
              <tr>
                <th className="px-3 py-2 font-medium">Order</th>
                <th className="px-3 py-2 font-medium">Date</th>
                <th className="px-3 py-2 font-medium">Time</th>
                <th className="px-3 py-2 font-medium">Labelcode</th>
                <th className="px-3 py-2 font-medium">Artist</th>
                <th className="px-3 py-2 font-medium">Title</th>
                <th className="px-3 py-2 font-medium">Label</th>
                <th className="px-3 py-2 font-medium">Qty</th>
                <th className="px-3 py-2 font-medium">Type</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-admin-hairline">
              {transactions.map((t) => (
                <tr key={t.id}>
                  <td className="px-3 py-2">
                    {t.type === "OUT" && (
                      <OrderButton
                        productId={t.product.id}
                        hasSupplier={!!t.product.supplierId}
                        initiallyOrdered={openOrderProductIds.has(t.product.id)}
                      />
                    )}
                  </td>
                  <td className="px-3 py-2 text-admin-ink-muted">
                    {shopDisplayDate(t.createdAt)}
                  </td>
                  <td className="px-3 py-2 text-admin-ink-muted">
                    {shopDisplayTime(t.createdAt)}
                  </td>
                  <td className="px-3 py-2 text-admin-ink-muted">{t.product.catalogNumber ?? "—"}</td>
                  <td className="px-3 py-2">{joinArtistNames(t.product.productArtists)}</td>
                  <td className="px-3 py-2">{t.product.title}</td>
                  <td className="px-3 py-2 text-admin-ink-muted">{t.product.label.name}</td>
                  <td className="px-3 py-2 tabular-nums">
                    {t.quantity > 0 ? `+${t.quantity}` : t.quantity}
                  </td>
                  <td className="px-3 py-2">{t.type}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
