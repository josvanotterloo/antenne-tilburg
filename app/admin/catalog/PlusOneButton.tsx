"use client";

import { useRouter } from "next/navigation";

import { apiSend } from "@/lib/api-client";
import { useAsyncAction } from "@/lib/use-async-action";

// Mirrors SellOneButton — single-click +1, no reason prompt. No disabled
// floor since there's no upper bound on restocking.
export function PlusOneButton({ id }: { id: string }) {
  const router = useRouter();
  const { pending, error, run } = useAsyncAction();

  function handlePlusOne() {
    run(async () => {
      await apiSend(`/api/admin/products/${id}/plus-one`, { method: "POST" });
      router.refresh();
    });
  }

  return (
    <span className="inline-flex flex-col items-end gap-1">
      <button
        type="button"
        onClick={handlePlusOne}
        disabled={pending}
        className="rounded border border-admin-hairline px-2 py-1 text-xs hover:bg-admin-raised disabled:opacity-40"
      >
        {pending ? "…" : "+1"}
      </button>
      {error && (
        <span role="alert" className="text-xs text-red-400">
          {error}
        </span>
      )}
    </span>
  );
}
