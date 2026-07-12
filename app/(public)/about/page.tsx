import Link from "next/link";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "About",
  description:
    "Antenne Recordshop — electronic-music vinyl and tape in Tilburg, inside Sam-Sam vintage, run by DJ DMDN. New releases, a deep second-hand section, and independent Discogs stock.",
};

export default function AboutPage() {
  return (
    <div className="mx-auto max-w-prose space-y-8">
      <header className="space-y-4">
        <h1 className="text-3xl font-bold tracking-tight text-ink sm:text-4xl">
          About
        </h1>
        <p className="text-pretty text-lg leading-relaxed text-ink">
          Antenne Recordshop is a shop for electronic music on vinyl and tape,
          tucked inside Sam-Sam vintage in the centre of Tilburg. It&rsquo;s run
          by DJ DMDN — built around a record collector&rsquo;s ear, not a
          catalogue.
        </p>
      </header>

      <div className="space-y-6 text-pretty leading-relaxed text-ink">
        <p>
          The name means antenna, and that&rsquo;s the idea: a small shop
          picking up underground frequencies and passing them on. Mostly new
          vinyl, some tape, filed the way the shop actually thinks about records
          — one genre at a time.
        </p>

        <section className="space-y-3">
          <h2 className="text-xl font-semibold tracking-tight text-ink">
            What we stock
          </h2>
          <p>
            The heart of it is electronic: techno, house, electro, ambient, dub,
            jungle, electronics and the experimental edges in between. New
            releases land regularly — Tresor, Clone, Rush Hour and plenty of
            smaller labels — alongside a rotating rack of tapes.
          </p>
        </section>

        <section className="space-y-3">
          <h2 className="text-xl font-semibold tracking-tight text-ink">
            The second-hand section
          </h2>
          <p>
            Beyond the new racks there&rsquo;s a deep second-hand section. It
            leans electronic, but it wanders — dance, funk, soul, jazz, rock and
            pop all turn up. Everything is graded honestly and priced to move.
            Bring headphones; the listening station is free.
          </p>
        </section>

        <section className="space-y-3">
          <h2 className="text-xl font-semibold tracking-tight text-ink">
            On Discogs
          </h2>
          <p>
            Antenne also sells online through Discogs. That stock is kept
            completely separate from the shop floor, so what you see online
            isn&rsquo;t the same as what&rsquo;s in the racks. Discogs orders
            aren&rsquo;t shipped from the shop — they&rsquo;re prepared for
            next-day pickup at Antenne.
          </p>
        </section>

        <p className="text-ink-muted">
          Come dig in person —{" "}
          <Link
            href="/visit"
            className="text-ink underline decoration-hairline underline-offset-4 transition-colors duration-150 ease-out hover:text-signal hover:decoration-signal"
          >
            find us inside Sam-Sam
          </Link>{" "}
          for opening hours and a map, or{" "}
          <Link
            href="/stock"
            className="text-ink underline decoration-hairline underline-offset-4 transition-colors duration-150 ease-out hover:text-signal hover:decoration-signal"
          >
            browse what&rsquo;s in
          </Link>
          .
        </p>
      </div>
    </div>
  );
}
