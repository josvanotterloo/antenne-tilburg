"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

import { DAY_NAMES, type HourRow } from "@/lib/opening-hours";

export function OpeningHoursForm({ rows: initial }: { rows: HourRow[] }) {
  const router = useRouter();
  const [rows, setRows] = useState(initial);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  function update(dayOfWeek: number, patch: Partial<HourRow>) {
    setRows((rs) =>
      rs.map((r) => (r.dayOfWeek === dayOfWeek ? { ...r, ...patch } : r)),
    );
    setSaved(false);
  }

  async function save(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError(null);
    setSaved(false);
    const res = await fetch("/api/admin/opening-hours", {
      method: "PUT",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ hours: rows }),
    });
    setSaving(false);
    if (!res.ok) {
      const b = (await res.json().catch(() => null)) as {
        error?: string;
      } | null;
      setError(b?.error ?? "Could not save hours");
      return;
    }
    setSaved(true);
    router.refresh();
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

      {error && <p className="text-sm text-red-600">{error}</p>}
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
