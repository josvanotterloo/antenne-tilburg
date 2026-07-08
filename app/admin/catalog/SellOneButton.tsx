"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

// Single-click "sold one" for the catalog list. No confirmation (per spec).
// Disabled at 0 — nothing left to sell. Refreshes the list on success.
export function SellOneButton({
  id,
  quantity,
}: {
  id: string;
  quantity: number;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(false);

  async function handleSell() {
    setBusy(true);
    setError(false);
    const res = await fetch(`/api/admin/products/${id}/sell-one`, {
      method: "POST",
    });
    setBusy(false);
    if (res.ok) {
      router.refresh();
    } else {
      setError(true);
    }
  }

  return (
    <button
      type="button"
      onClick={handleSell}
      disabled={busy || quantity <= 0}
      className="rounded border border-neutral-300 px-2 py-1 text-xs hover:bg-neutral-100 disabled:opacity-40"
    >
      {busy ? "…" : error ? "Retry" : "Sell one"}
    </button>
  );
}
