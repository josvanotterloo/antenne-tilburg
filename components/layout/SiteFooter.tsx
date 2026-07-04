import { db } from "@/lib/db";

const DAYS = [
  "Sunday",
  "Monday",
  "Tuesday",
  "Wednesday",
  "Thursday",
  "Friday",
  "Saturday",
];

async function getHours() {
  try {
    return await db.openingHours.findMany({ orderBy: { dayOfWeek: "asc" } });
  } catch (error) {
    // Degrade gracefully but log — see NoticeBanner for the rationale.
    console.error("SiteFooter: failed to load opening hours", error);
    return [];
  }
}

export async function SiteFooter() {
  const hours = await getHours();

  return (
    <footer className="mt-16 border-t border-hairline bg-canvas">
      <div className="mx-auto grid max-w-5xl gap-8 px-4 py-10 sm:grid-cols-2">
        <div>
          <h2 className="font-mono text-xs font-medium uppercase tracking-[0.04em] text-ink-muted">
            Antenne Recordshop
          </h2>
          <p className="mt-3 text-sm text-ink-muted">
            Inside Sam-Sam vintage
            <br />
            Tilburg, Netherlands
          </p>
        </div>
        <div>
          <h2 className="font-mono text-xs font-medium uppercase tracking-[0.04em] text-ink-muted">
            Opening hours
          </h2>
          {hours.length === 0 ? (
            <p className="mt-3 text-sm text-ink-muted">See the Visit page.</p>
          ) : (
            <ul className="mt-3 space-y-1 font-mono text-sm text-ink-muted">
              {hours.map((hour) => (
                <li key={hour.id} className="flex justify-between gap-6">
                  <span>{DAYS[hour.dayOfWeek]}</span>
                  <span className="tabular-nums">
                    {hour.closed
                      ? "Closed"
                      : `${hour.opensAt}–${hour.closesAt}`}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
      <div className="border-t border-hairline py-4 text-center font-mono text-xs text-ink-muted">
        © {new Date().getFullYear()} Antenne Recordshop · DJ DMDN
      </div>
    </footer>
  );
}
