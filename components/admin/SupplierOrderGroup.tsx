"use client";

import { useState } from "react";

import { apiSend } from "@/lib/api-client";
import { useAsyncAction } from "@/lib/use-async-action";
import { OrderLinesTable } from "@/components/admin/OrderLinesTable";
import type { OrderLineRowData } from "@/components/admin/OrderLineRow";

export function SupplierOrderGroup({
  supplierName,
  orderId,
  sentAt,
  lines,
}: {
  supplierName: string;
  orderId: string;
  orderStatus: "PENDING" | "PARTIAL" | "RECEIVED";
  sentAt: string | null;
  lines: OrderLineRowData[];
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
            {sent ? "Sent" : pending ? "…" : "Mark all as sent"}
          </button>
          <button
            type="button"
            disabled
            title="Coming soon"
            className="rounded border border-admin-hairline px-2 py-1 text-xs opacity-40"
          >
            Export PDF
          </button>
        </span>
      </summary>
      {error && (
        <p role="alert" className="px-4 pb-2 text-xs text-red-400">
          {error}
        </p>
      )}
      <OrderLinesTable lines={lines} />
    </details>
  );
}
