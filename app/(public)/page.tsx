import Link from "next/link";

import { getLatestProducts, isJustIn, type CatalogProduct } from "@/lib/catalog";
import { getPublishedPosts, postDateLabel } from "@/lib/blog";

export const dynamic = "force-dynamic";

// The genre-static field — the heritage motif, a faint field of broadcast static
// behind the wordmark (DESIGN.md §5). Texture only, aria-hidden.
const GENRE_STATIC = [
  "techno", "house", "electro", "ambient", "dub", "jungle", "electronics",
  "experimental", "breakbeat", "drone", "acid", "idm", "minimal", "electro",
  "downtempo", "dubstep", "industrial", "noise", "leftfield", "deep house",
  "drum & bass", "library", "soundtrack", "disco", "boogie", "funk", "soul",
  "jazz", "krautrock", "cosmic", "hardcore", "gabber", "trance", "garage",
  "grime", "footwork", "synthpop", "coldwave", "ebm", "avant garde",
];

export default async function HomePage() {
  const [products, allPosts] = await Promise.all([
    getLatestProducts(100),
    getPublishedPosts(),
  ]);
  const posts = allPosts.slice(0, 3);

  return (
    <div className="space-y-16">
      {/* Hero */}
      <section className="relative -mx-4 overflow-hidden border-b border-hairline px-4 pb-12 pt-6">
        <div
          aria-hidden
          className="pointer-events-none absolute inset-x-0 top-0 h-40 select-none overflow-hidden opacity-[0.13] [mask-image:linear-gradient(to_bottom,#000_0%,transparent_100%)]"
        >
          <p className="break-words font-mono text-sm leading-snug tracking-tight text-ink">
            {GENRE_STATIC.concat(GENRE_STATIC).join("  ·  ")}
          </p>
        </div>
        <div className="relative max-w-2xl space-y-4">
          <h1 className="text-balance text-4xl font-bold tracking-tight text-ink sm:text-5xl">
            Antenne Recordshop
          </h1>
          <p className="font-mono text-xs uppercase tracking-[0.06em] text-signal">
            Electronic music · vinyl &amp; tape · Tilburg
          </p>
          <p className="max-w-prose text-pretty leading-relaxed text-ink-muted">
            New releases, a deep second-hand section and independent Discogs
            stock — inside Sam-Sam vintage, run by DJ&nbsp;DMDN.
          </p>
          <div className="flex flex-wrap gap-3 pt-1">
            <Link
              href="/stock"
              className="border border-ink bg-ink px-5 py-2 font-mono text-xs font-medium uppercase tracking-[0.04em] text-canvas transition-colors hover:border-signal hover:bg-signal"
            >
              Browse stock
            </Link>
            <Link
              href="/visit"
              className="border border-hairline px-5 py-2 font-mono text-xs font-medium uppercase tracking-[0.04em] text-ink transition-colors hover:border-signal hover:text-signal"
            >
              Plan your visit
            </Link>
          </div>
        </div>
      </section>

      {/* Just In */}
      <section className="space-y-5">
        <div className="flex items-baseline justify-between gap-4">
          <h2 className="text-2xl font-bold tracking-tight text-ink">Just In</h2>
          <Link
            href="/stock"
            className="font-mono text-xs uppercase tracking-[0.04em] text-ink-muted transition-colors hover:text-signal"
          >
            All stock →
          </Link>
        </div>
        {products.length === 0 ? (
          <p className="font-mono text-sm text-ink-muted">
            New arrivals will appear here.{" "}
            <Link href="/stock" className="text-ink hover:text-signal">
              Browse the full stock
            </Link>
            .
          </p>
        ) : (
          <ul className="grid gap-x-8 border-t border-hairline sm:grid-cols-2">
            {products.map((product) => (
              <li key={product.id} className="border-b border-hairline">
                <JustInRow product={product} />
              </li>
            ))}
          </ul>
        )}
      </section>

      {/* From the blog */}
      {posts.length > 0 && (
        <section className="space-y-5">
          <div className="flex items-baseline justify-between gap-4">
            <h2 className="text-2xl font-bold tracking-tight text-ink">
              From the blog
            </h2>
            <Link
              href="/blog"
              className="font-mono text-xs uppercase tracking-[0.04em] text-ink-muted transition-colors hover:text-signal"
            >
              All posts →
            </Link>
          </div>
          <ul className="divide-y divide-hairline border-t border-hairline">
            {posts.map((post) => {
              const date = post.publishedAt ?? post.createdAt;
              return (
                <li key={post.id}>
                  <Link
                    href={`/blog/${post.slug}`}
                    className="group flex flex-col gap-1 py-4 sm:flex-row sm:items-baseline sm:gap-6"
                  >
                    <time
                      dateTime={new Date(date).toISOString()}
                      className="font-mono text-xs uppercase tracking-[0.04em] text-ink-muted sm:w-28 sm:shrink-0"
                    >
                      {postDateLabel(date)}
                    </time>
                    <span className="font-semibold text-ink transition-colors group-hover:text-signal">
                      {post.title}
                    </span>
                  </Link>
                </li>
              );
            })}
          </ul>
        </section>
      )}

      {/* Visit teaser */}
      <section className="border border-hairline p-6">
        <h2 className="font-mono text-xs font-medium uppercase tracking-[0.04em] text-ink-muted">
          Visit
        </h2>
        <p className="mt-2 text-ink">
          Inside Sam-Sam vintage, Noordstraat 82, Tilburg.
        </p>
        <Link
          href="/visit"
          className="mt-3 inline-block font-mono text-xs uppercase tracking-[0.04em] text-ink-muted transition-colors hover:text-signal"
        >
          Opening hours &amp; map →
        </Link>
      </section>
    </div>
  );
}

function JustInRow({ product }: { product: CatalogProduct }) {
  return (
    <Link
      href={`/stock/${product.id}`}
      className="group flex items-baseline justify-between gap-4 py-3"
    >
      <span className="min-w-0 flex-1">
        <span className="font-medium text-ink transition-colors group-hover:text-signal">
          {product.artist}
        </span>
        <span className="text-ink-muted"> — {product.title}</span>
        {isJustIn(product.createdAt) && (
          <span className="ml-2 font-mono text-[0.625rem] font-bold uppercase tracking-[0.06em] text-signal">
            New
          </span>
        )}
        <span className="block truncate font-mono text-xs text-ink-muted">
          {product.label.name} · {product.genre.name}
        </span>
      </span>
      <span className="shrink-0 font-mono text-sm tabular-nums text-ink">
        €{Number(product.price).toFixed(2)}
      </span>
    </Link>
  );
}
