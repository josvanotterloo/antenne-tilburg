"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import type { AdminLocale } from "@prisma/client";

import { apiSend } from "@/lib/api-client";
import { useAsyncAction } from "@/lib/use-async-action";
import { t } from "@/lib/i18n/t";

// Two-click confirm (no blocking window.confirm) — product delete is
// unguarded and destroys data. A failed delete surfaces a visible message.
export function DeleteProductButton({
  id,
  locale,
}: {
  id: string;
  locale: AdminLocale;
}) {
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
            className="whitespace-nowrap text-red-400 hover:underline disabled:opacity-50"
          >
            {pending ? "…" : t("common.confirm", locale)}
          </button>
          <button
            type="button"
            onClick={() => setConfirming(false)}
            className="whitespace-nowrap text-admin-ink-muted hover:underline"
          >
            {t("common.cancel", locale)}
          </button>
        </span>
      ) : (
        <button
          type="button"
          onClick={() => setConfirming(true)}
          className="whitespace-nowrap text-red-400 hover:underline"
        >
          {t("common.delete", locale)}
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
