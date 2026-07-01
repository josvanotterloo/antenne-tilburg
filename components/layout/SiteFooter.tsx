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
  } catch {
    return [];
  }
}

export async function SiteFooter() {
  const hours = await getHours();

  return (
    <footer className="mt-16 border-t border-neutral-200 bg-neutral-50">
      <div className="mx-auto grid max-w-5xl gap-8 px-4 py-10 sm:grid-cols-2">
        <div>
          <h2 className="font-semibold">Antenne Recordshop</h2>
          <p className="mt-2 text-sm text-neutral-600">
            Inside Sam-Sam vintage
            <br />
            Tilburg, Netherlands
          </p>
        </div>
        <div>
          <h2 className="font-semibold">Opening hours</h2>
          {hours.length === 0 ? (
            <p className="mt-2 text-sm text-neutral-500">See the Visit page.</p>
          ) : (
            <ul className="mt-2 space-y-1 text-sm text-neutral-600">
              {hours.map((hour) => (
                <li key={hour.id} className="flex justify-between gap-6">
                  <span>{DAYS[hour.dayOfWeek]}</span>
                  <span>
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
      <div className="border-t border-neutral-200 py-4 text-center text-xs text-neutral-400">
        © {new Date().getFullYear()} Antenne Recordshop · DJ DMDN
      </div>
    </footer>
  );
}
