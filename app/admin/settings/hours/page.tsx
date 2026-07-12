import { db } from "@/lib/db";
import { WEEK_ORDER, type HourRow } from "@/lib/opening-hours";
import { OpeningHoursForm } from "@/components/admin/OpeningHoursForm";

export const dynamic = "force-dynamic";

export default async function AdminOpeningHoursPage() {
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
        <h1 className="text-2xl font-bold tracking-tight">Opening hours</h1>
        <p className="text-sm text-admin-ink-muted">
          The weekly grid shown on the Visit page and footer.
        </p>
      </div>
      <OpeningHoursForm rows={rows} />
    </div>
  );
}
