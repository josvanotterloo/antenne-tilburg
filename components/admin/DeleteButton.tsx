"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

// Reusable two-click delete for an admin list row. DELETEs `endpoint` then
// refreshes; surfaces a retry hint on failure.
export function DeleteButton({
  endpoint,
  label = "Delete",
}: {
  endpoint: string;
  label?: string;
}) {
  const router = useRouter();
  const [confirming, setConfirming] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(false);

  async function remove() {
    setBusy(true);
    setError(false);
    const res = await fetch(endpoint, { method: "DELETE" });
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
        {error ? "Delete failed — retry" : label}
      </button>
    );
  }
  return (
    <span className="inline-flex gap-2">
      <button
        type="button"
        onClick={remove}
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
