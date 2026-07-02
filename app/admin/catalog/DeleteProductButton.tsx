"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

// Two-click confirm (no blocking window.confirm) — product delete is
// unguarded and destroys data.
export function DeleteProductButton({ id }: { id: string }) {
  const router = useRouter();
  const [confirming, setConfirming] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(false);

  async function handleDelete() {
    setBusy(true);
    setError(false);
    const res = await fetch(`/api/admin/products/${id}`, { method: "DELETE" });
    setBusy(false);
    if (res.ok) {
      router.refresh();
    } else {
      setError(true);
      setConfirming(false);
    }
  }

  if (!confirming) {
    return (
      <button
        type="button"
        onClick={() => setConfirming(true)}
        className="text-red-600 hover:underline"
      >
        {error ? "Delete failed — retry" : "Delete"}
      </button>
    );
  }

  return (
    <span className="inline-flex gap-2">
      <button
        type="button"
        onClick={handleDelete}
        disabled={busy}
        className="text-red-600 hover:underline disabled:opacity-50"
      >
        {busy ? "…" : "Confirm"}
      </button>
      <button
        type="button"
        onClick={() => setConfirming(false)}
        className="text-neutral-500 hover:underline"
      >
        Cancel
      </button>
    </span>
  );
}
