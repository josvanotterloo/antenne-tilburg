import Link from "next/link";

export default function HomePage() {
  return (
    <div className="space-y-12">
      <section className="space-y-4">
        <h1 className="text-3xl font-bold tracking-tight">
          Antenne Recordshop
        </h1>
        <p className="max-w-prose text-neutral-600">
          Electronic-music vinyl &amp; tapes in Tilburg, inside Sam-Sam vintage.
          New releases, a second-hand section, and records via Discogs. Run by
          DJ&nbsp;DMDN.
        </p>
      </section>

      <section className="space-y-3">
        <h2 className="text-xl font-semibold">Just In</h2>
        <p className="text-neutral-500">
          Newest arrivals from the last 30 days will appear here. —{" "}
          <Link href="/stock" className="underline">
            Browse the full stock
          </Link>
        </p>
      </section>

      <section className="grid gap-6 sm:grid-cols-2">
        <div className="space-y-2">
          <h2 className="text-xl font-semibold">Upcoming events</h2>
          <p className="text-neutral-500">
            Event teasers will appear here. —{" "}
            <Link href="/events" className="underline">
              See events
            </Link>
          </p>
        </div>
        <div className="space-y-2">
          <h2 className="text-xl font-semibold">Visit us</h2>
          <p className="text-neutral-500">
            Address, hours and map. —{" "}
            <Link href="/visit" className="underline">
              Plan your visit
            </Link>
          </p>
        </div>
      </section>
    </div>
  );
}
