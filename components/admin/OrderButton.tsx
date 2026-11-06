"use client";

import { useState } from "react";
import type { AdminLocale } from "@prisma/client";

import { apiSend } from "@/lib/api-client";
import { useAsyncAction } from "@/lib/use-async-action";
import { t } from "@/lib/i18n/t";

// "Order" action for the catalog list: quick-adds a product to its
// supplier's open SupplyOrder.
export function OrderButton({
  productId,
  hasSupplier,
  initiallyOrdered,
  locale,
}: {
  productId: string;
  hasSupplier: boolean;
  initiallyOrdered: boolean;
  locale: AdminLocale;
}) {
  const [ordered, setOrdered] = useState(initiallyOrdered);
  const { pending, error, run } = useAsyncAction();

  function handleOrder() {
    run(async () => {
      await apiSend("/api/admin/orders/quick-add", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ productId }),
      });
      setOrdered(true);
    });
  }

  const disabled = pending || ordered || !hasSupplier;

  return (
    <span className="inline-flex flex-col items-end gap-1">
      <button
        type="button"
        onClick={handleOrder}
        disabled={disabled}
        title={!hasSupplier ? t("orders.noSupplierLinked", locale) : undefined}
        className="whitespace-nowrap rounded border border-admin-hairline px-2 py-1 text-xs hover:bg-admin-raised disabled:opacity-40"
      >
        {pending
          ? "…"
          : ordered
            ? t("orders.orderedButton", locale)
            : t("orders.orderButton", locale)}
      </button>
      {error && (
        <span role="alert" className="text-xs text-red-400">
          {error}
        </span>
      )}
    </span>
  );
}
