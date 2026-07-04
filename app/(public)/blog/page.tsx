import Link from "next/link";
import type { Metadata } from "next";

import { getPublishedPosts, postDateLabel, postExcerpt } from "@/lib/blog";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Blog" };

export default async function BlogIndexPage() {
  const posts = await getPublishedPosts();

  return (
    <div className="space-y-10">
      <header className="space-y-2">
        <h1 className="text-3xl font-bold tracking-tight text-ink sm:text-4xl">
          Blog
        </h1>
        <p className="max-w-prose text-ink-muted">
          New arrivals, restocks and shop news — straight from the shop floor.
        </p>
      </header>

      {posts.length === 0 ? (
        <p className="font-mono text-sm text-ink-muted">
          No posts yet. Check back soon.
        </p>
      ) : (
        <ol className="divide-y divide-hairline border-t border-hairline">
          {posts.map((post) => {
            const date = post.publishedAt ?? post.createdAt;
            return (
              <li key={post.id}>
                <Link
                  href={`/blog/${post.slug}`}
                  className="group flex flex-col gap-2 py-6 sm:flex-row sm:gap-8"
                >
                  <time
                    dateTime={new Date(date).toISOString()}
                    className="font-mono text-xs uppercase tracking-[0.04em] text-ink-muted sm:w-32 sm:shrink-0 sm:pt-1"
                  >
                    {postDateLabel(date)}
                  </time>
                  <div className="space-y-1">
                    <h2 className="text-xl font-semibold tracking-tight text-ink transition-colors group-hover:text-signal">
                      {post.title}
                    </h2>
                    <p className="max-w-prose text-ink-muted">
                      {postExcerpt(post.body)}
                    </p>
                  </div>
                </Link>
              </li>
            );
          })}
        </ol>
      )}
    </div>
  );
}
