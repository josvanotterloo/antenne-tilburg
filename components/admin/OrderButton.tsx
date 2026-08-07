"use client";

import { useState } from "react";

import { apiSend } from "@/lib/api-client";
import { useAsyncAction } from "@/lib/use-async-action";

// Shared "Order" action for the catalog list and the monthly transactions
// page: quick-adds a product to its supplier's open SupplyOrder.
export function OrderButton({
  productId,
  hasSupplier,
  initiallyOrdered,
}: {
  productId: string;
  hasSupplier: boolean;
  initiallyOrdered: boolean;
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
        title={!hasSupplier ? "No supplier linked" : undefined}
        className="rounded border border-admin-hairline px-2 py-1 text-xs hover:bg-admin-raised disabled:opacity-40"
      >
        {pending ? "…" : ordered ? "Ordered" : "Order"}
      </button>
      {error && (
        <span role="alert" className="text-xs text-red-400">
          {error}
        </span>
      )}
    </span>
  );
}
