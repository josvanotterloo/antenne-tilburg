import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { WEEK_ORDER, type HourRow } from "@/lib/opening-hours";
import { t } from "@/lib/i18n/t";
import { OpeningHoursForm } from "@/components/admin/OpeningHoursForm";

export const dynamic = "force-dynamic";

export default async function AdminOpeningHoursPage() {
  const session = await auth();
  const locale = session!.user.locale;
  const existing = await db.openingHours.findMany();
  const byDay = new Map(existing.map((h) => [h.dayOfWeek, h]));

  // One row per weekday, Monday-first; fill sensible defaults for any missing.
  const rows: HourRow[] = WEEK_ORDER.map((dayOfWeek) => {
    const h = byDay.get(dayOfWeek);
    return h
      ? {
          dayOfWeek,
          opensAt: h.opensAt,
          closesAt: h.closesAt,
          closed: h.closed,
        }
      : { dayOfWeek, opensAt: "12:00", closesAt: "18:00", closed: false };
  });

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">{t("openingHours.title", locale)}</h1>
        <p className="text-sm text-admin-ink-muted">{t("openingHours.subtitle", locale)}</p>
      </div>
      <OpeningHoursForm rows={rows} locale={locale} />
    </div>
  );
}
