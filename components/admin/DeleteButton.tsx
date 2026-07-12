"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

import { apiSend } from "@/lib/api-client";
import { useAsyncAction } from "@/lib/use-async-action";

// Reusable two-click delete for an admin list row. DELETEs `endpoint` then
// refreshes; a failed delete (e.g. a delete-guard 409, or the network) shows a
// visible message instead of silently doing nothing.
export function DeleteButton({
  endpoint,
  label = "Delete",
}: {
  endpoint: string;
  label?: string;
}) {
  const router = useRouter();
  const { pending, error, run } = useAsyncAction();
  const [confirming, setConfirming] = useState(false);

  function remove() {
    run(async () => {
      await apiSend(endpoint, { method: "DELETE" });
      router.refresh();
    });
  }

  return (
    <span className="inline-flex flex-col items-end gap-1">
      {confirming ? (
        <span className="inline-flex gap-2">
          <button
            type="button"
            onClick={remove}
            disabled={pending}
            className="text-red-400 hover:underline disabled:opacity-50"
          >
            {pending ? "…" : "Confirm"}
          </button>
          <button
            type="button"
            onClick={() => setConfirming(false)}
            className="text-admin-ink-muted hover:underline"
          >
            Cancel
          </button>
        </span>
      ) : (
        <button
          type="button"
          onClick={() => setConfirming(true)}
          className="text-red-400 hover:underline"
        >
          {label}
        </button>
      )}
      {error && (
        <span role="alert" className="text-xs text-red-400">
          {error}
        </span>
      )}
    </span>
  );
}
