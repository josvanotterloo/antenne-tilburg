"use client";

import { useState } from "react";
import type { AdminLocale } from "@prisma/client";

import { apiSend } from "@/lib/api-client";
import { useAsyncAction } from "@/lib/use-async-action";
import { t } from "@/lib/i18n/t";
import { OrderLinesTable } from "@/components/admin/OrderLinesTable";
import type { OrderLineRowData } from "@/components/admin/OrderLineRow";

export function SupplierOrderGroup({
  supplierName,
  orderId,
  sentAt,
  lines,
  locale,
}: {
  supplierName: string;
  orderId: string;
  orderStatus: "PENDING" | "PARTIAL" | "RECEIVED";
  sentAt: string | null;
  lines: OrderLineRowData[];
  locale: AdminLocale;
}) {
  const [sent, setSent] = useState(sentAt !== null);
  const { pending, error, run } = useAsyncAction();

  function markSent() {
    run(async () => {
      await apiSend(`/api/admin/orders/${orderId}`, {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ status: "SENT" }),
      });
      setSent(true);
    });
  }

  return (
    <details className="rounded border border-admin-hairline bg-admin-surface" open>
      <summary className="flex cursor-pointer items-center justify-between gap-2 px-4 py-3">
        <span className="font-semibold">{supplierName}</span>
        <span className="flex items-center gap-2 text-sm" onClick={(e) => e.stopPropagation()}>
          <button
            type="button"
            onClick={markSent}
            disabled={pending || sent}
            className="rounded border border-admin-hairline px-2 py-1 text-xs hover:bg-admin-raised disabled:opacity-40"
          >
            {sent
              ? t("orders.sent", locale)
              : pending
                ? "…"
                : t("orders.markAllSent", locale)}
          </button>
          <button
            type="button"
            disabled
            title={t("orders.comingSoon", locale)}
            className="rounded border border-admin-hairline px-2 py-1 text-xs opacity-40"
          >
            {t("orders.exportPdf", locale)}
          </button>
        </span>
      </summary>
      {error && (
        <p role="alert" className="px-4 pb-2 text-xs text-red-400">
          {error}
        </p>
      )}
      <OrderLinesTable lines={lines} locale={locale} />
    </details>
  );
}
