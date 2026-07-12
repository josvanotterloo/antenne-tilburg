"use client";

import { useRouter } from "next/navigation";

import { apiSend } from "@/lib/api-client";
import { useAsyncAction } from "@/lib/use-async-action";

// Single-click "sold one" for the catalog list. No confirmation (per spec).
// Disabled at 0 — nothing left to sell. Refreshes on success; a failed sale
// surfaces a visible message instead of a silent retry state.
export function SellOneButton({
  id,
  quantity,
}: {
  id: string;
  quantity: number;
}) {
  const router = useRouter();
  const { pending, error, run } = useAsyncAction();

  function handleSell() {
    run(async () => {
      await apiSend(`/api/admin/products/${id}/sell-one`, { method: "POST" });
      router.refresh();
    });
  }

  return (
    <span className="inline-flex flex-col items-end gap-1">
      <button
        type="button"
        onClick={handleSell}
        disabled={pending || quantity <= 0}
        className="rounded border border-admin-hairline px-2 py-1 text-xs hover:bg-admin-raised disabled:opacity-40"
      >
        {pending ? "…" : "Sell one"}
      </button>
      {error && (
        <span role="alert" className="text-xs text-red-400">
          {error}
        </span>
      )}
    </span>
  );
}
