"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

import { DeleteButton } from "./DeleteButton";

export interface NoticeActionValues {
  id: string;
  message: string;
  active: boolean;
  startsAt: string | null;
  endsAt: string | null;
}

// Toggle the active flag (re-sends the notice via PATCH) + delete.
export function NoticeActions({ notice }: { notice: NoticeActionValues }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);

  async function toggleActive() {
    setBusy(true);
    const res = await fetch(`/api/admin/notices/${notice.id}`, {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        message: notice.message,
        active: !notice.active,
        startsAt: notice.startsAt ?? "",
        endsAt: notice.endsAt ?? "",
      }),
    });
    setBusy(false);
    if (res.ok) router.refresh();
  }

  return (
    <div className="flex justify-end gap-3">
      <button
        type="button"
        onClick={toggleActive}
        disabled={busy}
        className="text-neutral-700 hover:underline disabled:opacity-50"
      >
        {notice.active ? "Deactivate" : "Activate"}
      </button>
      <DeleteButton endpoint={`/api/admin/notices/${notice.id}`} />
    </div>
  );
}
