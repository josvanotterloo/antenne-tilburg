import type { AdminLocale } from "@prisma/client";

import { t } from "@/lib/i18n/t";
import { OrderLineRow, type OrderLineRowData } from "@/components/admin/OrderLineRow";

// Shared nine-column header + body — used by SupplierOrderGroup and by the
// date/flat groupings on the orders overview page, so the header markup
// isn't tripled across three near-identical tables.
export function OrderLinesTable({
  lines,
  locale,
}: {
  lines: OrderLineRowData[];
  locale: AdminLocale;
}) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-left">
        <thead className="border-y border-admin-hairline bg-admin-bg text-xs text-admin-ink-muted">
          <tr>
            <th className="px-3 py-2 font-medium">{t("orders.colArtist", locale)}</th>
            <th className="px-3 py-2 font-medium">{t("orders.colTitle", locale)}</th>
            <th className="px-3 py-2 font-medium">{t("orders.colLabelcode", locale)}</th>
            <th className="px-3 py-2 font-medium">{t("orders.colLabel", locale)}</th>
            <th className="px-3 py-2 font-medium">{t("orders.colFormat", locale)}</th>
            <th className="px-3 py-2 font-medium">{t("orders.colQty", locale)}</th>
            <th className="px-3 py-2 font-medium">{t("orders.colAdded", locale)}</th>
            <th className="px-3 py-2 font-medium">{t("orders.colStatus", locale)}</th>
            <th className="px-3 py-2 font-medium">{t("orders.colReceive", locale)}</th>
          </tr>
        </thead>
        <tbody>
          {lines.map((line) => (
            <OrderLineRow key={line.id} line={line} locale={locale} />
          ))}
        </tbody>
      </table>
    </div>
  );
}
