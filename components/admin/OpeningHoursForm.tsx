"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

import { apiSend } from "@/lib/api-client";
import { useAsyncAction } from "@/lib/use-async-action";
import { DAY_NAMES, type HourRow } from "@/lib/opening-hours";

export function OpeningHoursForm({ rows: initial }: { rows: HourRow[] }) {
  const router = useRouter();
  const { pending: saving, error, run } = useAsyncAction();
  const [rows, setRows] = useState(initial);
  const [saved, setSaved] = useState(false);

  function update(dayOfWeek: number, patch: Partial<HourRow>) {
    setRows((rs) =>
      rs.map((r) => (r.dayOfWeek === dayOfWeek ? { ...r, ...patch } : r)),
    );
    setSaved(false);
  }

  function save(e: React.FormEvent) {
    e.preventDefault();
    setSaved(false);
    run(async () => {
      await apiSend("/api/admin/opening-hours", {
        method: "PUT",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ hours: rows }),
      });
      setSaved(true);
      router.refresh();
    });
  }

  return (
    <form onSubmit={save} className="max-w-lg space-y-4">
      <div className="space-y-2">
        {rows.map((row) => (
          <div key={row.dayOfWeek} className="flex items-center gap-3 text-sm">
            <span className="w-24 font-medium">{DAY_NAMES[row.dayOfWeek]}</span>
            <label className="flex items-center gap-1">
              <input
                type="checkbox"
                checked={row.closed}
                onChange={(e) => update(row.dayOfWeek, { closed: e.target.checked })}
              />
              Closed
            </label>
            <input
              type="time"
              aria-label={`${DAY_NAMES[row.dayOfWeek]} opens`}
              value={row.opensAt}
              disabled={row.closed}
              onChange={(e) => update(row.dayOfWeek, { opensAt: e.target.value })}
              className="rounded border border-neutral-300 px-2 py-1 disabled:opacity-40"
            />
            <span>–</span>
            <input
              type="time"
              aria-label={`${DAY_NAMES[row.dayOfWeek]} closes`}
              value={row.closesAt}
              disabled={row.closed}
              onChange={(e) => update(row.dayOfWeek, { closesAt: e.target.value })}
              className="rounded border border-neutral-300 px-2 py-1 disabled:opacity-40"
            />
          </div>
        ))}
      </div>

      {error && (
        <p role="alert" className="text-sm text-red-600">
          {error}
        </p>
      )}
      {saved && <p className="text-sm text-green-700">Saved.</p>}

      <button
        type="submit"
        disabled={saving}
        className="rounded bg-neutral-900 px-4 py-2 text-sm font-medium text-white disabled:opacity-60"
      >
        {saving ? "Saving…" : "Save hours"}
      </button>
    </form>
  );
}
