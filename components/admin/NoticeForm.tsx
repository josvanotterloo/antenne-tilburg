"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

import { apiSend } from "@/lib/api-client";
import { useAsyncAction } from "@/lib/use-async-action";

export interface NoticeFormValues {
  id: string;
  message: string;
  active: boolean;
  startsAt: string; // datetime-local value or ""
  endsAt: string;
}

export function NoticeForm({ notice }: { notice?: NoticeFormValues }) {
  const router = useRouter();
  const { pending: saving, error, run } = useAsyncAction();
  const [message, setMessage] = useState(notice?.message ?? "");
  const [active, setActive] = useState(notice?.active ?? true);
  const [startsAt, setStartsAt] = useState(notice?.startsAt ?? "");
  const [endsAt, setEndsAt] = useState(notice?.endsAt ?? "");

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    run(async () => {
      await apiSend(
        notice ? `/api/admin/notices/${notice.id}` : "/api/admin/notices",
        {
          method: notice ? "PATCH" : "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ message, active, startsAt, endsAt }),
        },
      );
      router.push("/admin/settings/notices");
      router.refresh();
    });
  }

  return (
    <form onSubmit={handleSubmit} className="max-w-xl space-y-4">
      <div className="space-y-1">
        <span className="block text-sm font-medium">Message</span>
        <textarea
          required
          rows={3}
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          className="w-full rounded border border-neutral-300 px-2 py-1 text-sm"
        />
      </div>

      <label className="flex items-center gap-2 text-sm">
        <input
          type="checkbox"
          checked={active}
          onChange={(e) => setActive(e.target.checked)}
        />
        Active
      </label>

      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-1">
          <span className="block text-sm font-medium">Starts (optional)</span>
          <input
            type="datetime-local"
            value={startsAt}
            onChange={(e) => setStartsAt(e.target.value)}
            className="w-full rounded border border-neutral-300 px-2 py-1 text-sm"
          />
        </div>
        <div className="space-y-1">
          <span className="block text-sm font-medium">Ends (optional)</span>
          <input
            type="datetime-local"
            value={endsAt}
            onChange={(e) => setEndsAt(e.target.value)}
            className="w-full rounded border border-neutral-300 px-2 py-1 text-sm"
          />
        </div>
      </div>
      <p className="text-xs text-neutral-500">
        With a window set, the notice shows automatically between those times
        (and only while Active).
      </p>

      {error && (
        <p role="alert" className="text-sm text-red-600">
          {error}
        </p>
      )}

      <div className="flex gap-2">
        <button
          type="submit"
          disabled={saving}
          className="rounded bg-neutral-900 px-4 py-2 text-sm font-medium text-white disabled:opacity-60"
        >
          {saving ? "Saving…" : notice ? "Save changes" : "Create notice"}
        </button>
        <button
          type="button"
          onClick={() => router.push("/admin/settings/notices")}
          className="rounded border border-neutral-300 px-4 py-2 text-sm"
        >
          Cancel
        </button>
      </div>
    </form>
  );
}
