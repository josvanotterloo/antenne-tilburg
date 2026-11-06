"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import type { AdminLocale } from "@prisma/client";

import { apiSend } from "@/lib/api-client";
import { useAsyncAction } from "@/lib/use-async-action";
import { t } from "@/lib/i18n/t";
import { dayName } from "@/lib/i18n/day-names";
import { type HourRow } from "@/lib/opening-hours";

export function OpeningHoursForm({
  rows: initial,
  locale,
}: {
  rows: HourRow[];
  locale: AdminLocale;
}) {
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
            <span className="w-24 font-medium">{dayName(row.dayOfWeek, locale)}</span>
            <label className="flex items-center gap-1">
              <input
                type="checkbox"
                checked={row.closed}
                onChange={(e) => update(row.dayOfWeek, { closed: e.target.checked })}
              />
              {t("openingHours.closed", locale)}
            </label>
            <input
              type="time"
              aria-label={`${dayName(row.dayOfWeek, locale)} ${t("openingHours.opensSuffix", locale)}`}
              value={row.opensAt}
              disabled={row.closed}
              onChange={(e) => update(row.dayOfWeek, { opensAt: e.target.value })}
              className="rounded border border-admin-hairline px-2 py-1 disabled:opacity-40"
            />
            <span>–</span>
            <input
              type="time"
              aria-label={`${dayName(row.dayOfWeek, locale)} ${t("openingHours.closesSuffix", locale)}`}
              value={row.closesAt}
              disabled={row.closed}
              onChange={(e) => update(row.dayOfWeek, { closesAt: e.target.value })}
              className="rounded border border-admin-hairline px-2 py-1 disabled:opacity-40"
            />
          </div>
        ))}
      </div>

      {error && (
        <p role="alert" className="text-sm text-red-400">
          {error}
        </p>
      )}
      {saved && <p className="text-sm text-green-400">{t("common.saved", locale)}</p>}

      <button
        type="submit"
        disabled={saving}
        className="rounded bg-admin-ink transition-colors duration-150 ease-out hover:bg-signal px-4 py-2 text-sm font-medium text-admin-bg disabled:opacity-60"
      >
        {saving ? t("common.saving", locale) : t("openingHours.saveButton", locale)}
      </button>
    </form>
  );
}
