import { cache } from "react";
import Link from "next/link";
import { notFound } from "next/navigation";
import type { Metadata } from "next";

import {
  getPublishedPostBySlug,
  postDateLabel,
  postExcerpt,
} from "@/lib/blog";
import { PostBody } from "@/components/PostBody";

export const dynamic = "force-dynamic";

// generateMetadata and the page both need the post; React.cache collapses their two
// identical slug lookups into a single query per request.
const getPost = cache(getPublishedPostBySlug);

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const post = await getPost(slug);
  if (!post) return { title: "Not found" };
  return {
    title: post.seoTitle ?? post.title,
    description: post.seoDescription ?? postExcerpt(post.body),
  };
}

export default async function BlogPostPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const post = await getPost(slug);
  if (!post) notFound();

  const date = post.publishedAt ?? post.createdAt;

  return (
    <article className="mx-auto max-w-prose space-y-8">
      <Link
        href="/blog"
        className="font-mono text-xs uppercase tracking-[0.04em] text-ink-muted transition-colors hover:text-signal"
      >
        ← Back to blog
      </Link>

      <header className="space-y-3">
        <time
          dateTime={new Date(date).toISOString()}
          className="font-mono text-xs uppercase tracking-[0.04em] text-ink-muted"
        >
          {postDateLabel(date)}
        </time>
        <h1 className="text-balance text-3xl font-bold tracking-tight text-ink sm:text-4xl">
          {post.title}
        </h1>
      </header>

      {post.coverImage && (
        // Plain <img>: cover URLs are arbitrary and next/image has no remote config.
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={post.coverImage}
          alt=""
          className="w-full border border-hairline"
        />
      )}

      <PostBody body={post.body} />
    </article>
  );
}
