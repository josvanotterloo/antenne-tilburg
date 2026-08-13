"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

import { apiSend } from "@/lib/api-client";
import { useAsyncAction } from "@/lib/use-async-action";

type Result = { tried: number; succeeded: number; failed: number };

// Manual trigger for PENDING subscribers whose confirmation email never sent
// (Resend was down or timed out) — POSTs the retry endpoint, shows the
// {tried, succeeded, failed} summary, then refreshes so badges update.
export function RetryPendingButton() {
  const router = useRouter();
  const { pending, error, run } = useAsyncAction();
  const [result, setResult] = useState<Result | null>(null);

  function retry() {
    setResult(null);
    run(async () => {
      const data = await apiSend<Result>("/api/admin/newsletter/retry-pending", {
        method: "POST",
      });
      setResult(data);
      router.refresh();
    });
  }

  return (
    <span className="inline-flex flex-col items-start gap-1">
      <button
        type="button"
        onClick={retry}
        disabled={pending}
        className="rounded border border-admin-hairline px-3 py-2 text-sm hover:bg-admin-raised disabled:opacity-60"
      >
        {pending ? "Retrying…" : "Retry pending emails"}
      </button>
      {result && (
        <span role="status" className="text-xs text-admin-ink-muted">
          Retried {result.tried}: {result.succeeded} sent
          {result.failed > 0 ? `, ${result.failed} failed` : ""}.
        </span>
      )}
      {error && (
        <span role="alert" className="text-xs text-red-400">
          {error}
        </span>
      )}
    </span>
  );
}
