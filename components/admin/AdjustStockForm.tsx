"use client";

import { useState } from "react";

import { apiSend } from "@/lib/api-client";
import { useAsyncAction } from "@/lib/use-async-action";

interface AdjustStockFormProps {
  productId: string;
  onAdjusted: (quantity: number) => void;
}

// Inline expand/collapse form for a manual stock correction (ADJUSTMENT
// transaction). The reason note is required server-side — it's the only
// record of "why" an adjustment happened.
export function AdjustStockForm({ productId, onAdjusted }: AdjustStockFormProps) {
  const [open, setOpen] = useState(false);
  const [delta, setDelta] = useState("");
  const [note, setNote] = useState("");
  const { pending, error, run } = useAsyncAction();

  function handleSubmit() {
    run(async () => {
      const result = await apiSend<{ quantity: number }>(
        `/api/admin/products/${productId}/adjust`,
        {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ delta: Number(delta), note }),
        },
      );
      onAdjusted(result.quantity);
      setOpen(false);
      setDelta("");
      setNote("");
    });
  }

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="rounded border border-admin-hairline px-2 py-1 text-xs hover:bg-admin-raised"
      >
        Adjust stock
      </button>
    );
  }

  return (
    // A <div>, not a <form>: this renders inside ProductForm's own <form>
    // (the quantity/adjust section sits between other product fields), and
    // nested <form> elements are invalid HTML — real browsers silently fail
    // to fire the inner submit button's click in that case (jsdom doesn't
    // reproduce this, which is why it slipped past the test suite). The
    // trade-off is that the inputs' `required` attributes no longer block
    // submission natively; an empty delta/note still 400s via the server's
    // existing validation instead of a browser tooltip.
    <div className="space-y-2 rounded border border-admin-hairline p-2">
      <div className="flex gap-2">
        <input
          type="number"
          step="1"
          aria-label="Quantity delta"
          placeholder="e.g. -2 or 5"
          value={delta}
          onChange={(e) => setDelta(e.target.value)}
          className="w-24 rounded border border-admin-hairline px-2 py-1 text-sm"
        />
        <input
          type="text"
          aria-label="Reason"
          placeholder="Reason"
          value={note}
          onChange={(e) => setNote(e.target.value)}
          className="flex-1 rounded border border-admin-hairline px-2 py-1 text-sm"
        />
      </div>
      <div className="flex gap-2">
        <button
          type="button"
          onClick={handleSubmit}
          disabled={pending}
          className="rounded border border-admin-hairline px-2 py-1 text-xs hover:bg-admin-raised disabled:opacity-40"
        >
          {pending ? "…" : "Save adjustment"}
        </button>
        <button
          type="button"
          onClick={() => setOpen(false)}
          className="text-xs text-admin-ink-muted hover:underline"
        >
          Cancel
        </button>
      </div>
      {error && (
        <p role="alert" className="text-xs text-red-400">
          {error}
        </p>
      )}
    </div>
  );
}
