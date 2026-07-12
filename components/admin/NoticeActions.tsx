"use client";

import { useRouter } from "next/navigation";

import { apiSend } from "@/lib/api-client";
import { useAsyncAction } from "@/lib/use-async-action";
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
export function NoticeActions({ notice }: { notice: NoticeActionValues }) {
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
          className="text-admin-ink hover:underline disabled:opacity-50"
        >
          {notice.active ? "Deactivate" : "Activate"}
        </button>
        <DeleteButton endpoint={`/api/admin/notices/${notice.id}`} />
      </div>
      {error && (
        <p role="alert" className="text-xs text-red-400">
          {error}
        </p>
      )}
    </div>
  );
}
