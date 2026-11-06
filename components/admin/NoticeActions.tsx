"use client";

import { useRouter } from "next/navigation";
import type { AdminLocale } from "@prisma/client";

import { apiSend } from "@/lib/api-client";
import { useAsyncAction } from "@/lib/use-async-action";
import { t } from "@/lib/i18n/t";
import { DeleteButton } from "./DeleteButton";

export interface NoticeActionValues {
  id: string;
  message: string;
  active: boolean;
  startsAt: string | null;
  endsAt: string | null;
}

// Toggle the active flag (re-sends the notice via PATCH) + delete. A failed
// toggle surfaces a visible alert rather than silently doing nothing.
export function NoticeActions({
  notice,
  locale,
}: {
  notice: NoticeActionValues;
  locale: AdminLocale;
}) {
  const router = useRouter();
  const { pending, error, run } = useAsyncAction();

  function toggleActive() {
    run(async () => {
      await apiSend(`/api/admin/notices/${notice.id}`, {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          message: notice.message,
          active: !notice.active,
          startsAt: notice.startsAt ?? "",
          endsAt: notice.endsAt ?? "",
        }),
      });
      router.refresh();
    });
  }

  return (
    <div className="flex flex-col items-end gap-1">
      <div className="flex justify-end gap-3">
        <button
          type="button"
          onClick={toggleActive}
          disabled={pending}
          className="whitespace-nowrap text-admin-ink hover:underline disabled:opacity-50"
        >
          {notice.active ? t("notices.deactivate", locale) : t("notices.activate", locale)}
        </button>
        <DeleteButton
          endpoint={`/api/admin/notices/${notice.id}`}
          label={t("common.delete", locale)}
          confirmLabel={t("common.confirm", locale)}
          cancelLabel={t("common.cancel", locale)}
        />
      </div>
      {error && (
        <p role="alert" className="text-xs text-red-400">
          {error}
        </p>
      )}
    </div>
  );
}
