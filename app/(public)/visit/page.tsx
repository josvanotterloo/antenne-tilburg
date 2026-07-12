import type { Metadata } from "next";

import { db } from "@/lib/db";
import {
  DAY_NAMES,
  formatHourRange,
  orderOpeningHours,
} from "@/lib/opening-hours";

export const dynamic = "force-dynamic";
export const metadata: Metadata = {
  title: "Visit",
  description:
    "Antenne Recordshop is inside Sam-Sam vintage at Noordstraat 82, Tilburg. Opening hours, phone, email and a map.",
};

// Static shop contact details. Update here if the shop moves or details change.
const SHOP = {
  venue: "Inside Sam-Sam vintage",
  street: "Noordstraat 82",
  postal: "5038 EK Tilburg",
  country: "Netherlands",
  phoneDisplay: "+31 (0)13 542 1708",
  phoneHref: "tel:+31135421708",
  email: "antenne-tilburg@home.nl",
  lat: 51.5580667,
  lon: 5.0809368,
};

const BBOX = [
  SHOP.lon - 0.004,
  SHOP.lat - 0.002,
  SHOP.lon + 0.004,
  SHOP.lat + 0.002,
].join(",");
const MAP_SRC = `https://www.openstreetmap.org/export/embed.html?bbox=${BBOX}&layer=mapnik&marker=${SHOP.lat},${SHOP.lon}`;
const DIRECTIONS_HREF = `https://www.google.com/maps/dir/?api=1&destination=${SHOP.lat},${SHOP.lon}`;

async function getHours() {
  try {
    return await db.openingHours.findMany();
  } catch (error) {
    // Degrade gracefully (build/DB down) but log — matches SiteFooter's rationale.
    console.error("VisitPage: failed to load opening hours", error);
    return [];
  }
}

const label =
  "font-mono text-xs font-medium uppercase tracking-[0.06em] text-ink-muted";

export default async function VisitPage() {
  const hours = orderOpeningHours(await getHours());
  const today = new Date().getDay();

  return (
    <div className="space-y-10">
      <header className="space-y-2">
        <h1 className="text-3xl font-bold tracking-tight text-ink sm:text-4xl">
          Visit
        </h1>
        <p className="max-w-prose text-ink-muted">
          Antenne Recordshop lives inside Sam-Sam vintage in the centre of
          Tilburg. Come dig — the listening station is free.
        </p>
      </header>

      <div className="grid gap-10 md:grid-cols-2">
        <div className="space-y-8">
          <section className="space-y-2">
            <h2 className={label}>Find us</h2>
            <address className="font-mono text-sm not-italic leading-relaxed text-ink">
              {SHOP.venue}
              <br />
              {SHOP.street}
              <br />
              {SHOP.postal}
              <br />
              {SHOP.country}
            </address>
            <a
              href={DIRECTIONS_HREF}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-block border border-hairline px-4 py-2 font-mono text-xs font-medium uppercase tracking-[0.06em] text-ink transition-colors duration-150 ease-out hover:border-signal hover:text-signal"
            >
              Get directions ↗
            </a>
          </section>

          <section className="space-y-2">
            <h2 className={label}>Contact</h2>
            <p className="font-mono text-sm text-ink">
              <a
                href={SHOP.phoneHref}
                className="transition-colors duration-150 ease-out hover:text-signal"
              >
                {SHOP.phoneDisplay}
              </a>
            </p>
            <p className="font-mono text-sm text-ink">
              <a
                href={`mailto:${SHOP.email}`}
                className="transition-colors duration-150 ease-out hover:text-signal"
              >
                {SHOP.email}
              </a>
            </p>
          </section>
        </div>

        <section className="space-y-2">
          <h2 className={label}>Opening hours</h2>
          {hours.length === 0 ? (
            <p className="font-mono text-sm text-ink-muted">
              Hours are being updated — please call ahead.
            </p>
          ) : (
            <ul className="font-mono text-sm">
              {hours.map((row) => {
                const isToday = row.dayOfWeek === today;
                return (
                  <li
                    key={row.id}
                    className={`flex justify-between gap-6 border-b border-hairline py-2 ${
                      isToday ? "text-ink" : "text-ink-muted"
                    }`}
                  >
                    <span>
                      {DAY_NAMES[row.dayOfWeek]}
                      {isToday && (
                        <span className="ml-2 text-[0.6875rem] uppercase tracking-[0.06em] text-signal">
                          Today
                        </span>
                      )}
                    </span>
                    <span className="tabular-nums">{formatHourRange(row)}</span>
                  </li>
                );
              })}
            </ul>
          )}
        </section>
      </div>

      <section className="space-y-2">
        <h2 className={label}>Map</h2>
        <iframe
          title="Map showing Antenne Recordshop at Noordstraat 82, Tilburg"
          src={MAP_SRC}
          loading="lazy"
          className="h-[360px] w-full border border-hairline"
        />
      </section>
    </div>
  );
}
