"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

import { apiSend } from "@/lib/api-client";
import { useAsyncAction } from "@/lib/use-async-action";

// Two-click confirm (no blocking window.confirm) — product delete is
// unguarded and destroys data. A failed delete surfaces a visible message.
export function DeleteProductButton({ id }: { id: string }) {
  const router = useRouter();
  const { pending, error, run } = useAsyncAction();
  const [confirming, setConfirming] = useState(false);

  function handleDelete() {
    run(async () => {
      await apiSend(`/api/admin/products/${id}`, { method: "DELETE" });
      router.refresh();
    });
  }

  return (
    <span className="inline-flex flex-col items-end gap-1">
      {confirming ? (
        <span className="inline-flex gap-2">
          <button
            type="button"
            onClick={handleDelete}
            disabled={pending}
            className="text-red-600 hover:underline disabled:opacity-50"
          >
            {pending ? "…" : "Confirm"}
          </button>
          <button
            type="button"
            onClick={() => setConfirming(false)}
            className="text-neutral-500 hover:underline"
          >
            Cancel
          </button>
        </span>
      ) : (
        <button
          type="button"
          onClick={() => setConfirming(true)}
          className="text-red-600 hover:underline"
        >
          Delete
        </button>
      )}
      {error && (
        <span role="alert" className="text-xs text-red-600">
          {error}
        </span>
      )}
    </span>
  );
}
