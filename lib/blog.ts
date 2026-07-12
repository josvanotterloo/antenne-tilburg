import { db } from "@/lib/db";

// Query + presentation helpers for the public blog. Kept separate from the page so
// the "published only" rule and formatting are unit-testable (see lib/blog.test.ts).

const MONTHS = [
  "Jan", "Feb", "Mar", "Apr", "May", "Jun",
  "Jul", "Aug", "Sep", "Oct", "Nov", "Dec",
];

// "04 Jul 2026" — the mono catalog voice. Formatted in UTC for determinism.
export function postDateLabel(date: Date | string): string {
  const d = typeof date === "string" ? new Date(date) : date;
  const day = String(d.getUTCDate()).padStart(2, "0");
  return `${day} ${MONTHS[d.getUTCMonth()]} ${d.getUTCFullYear()}`;
}

// Strip the markdown the post body uses (the same subset PostBody renders) down
// to plain text, so an excerpt reads as prose instead of leaking raw syntax like
// `![](/uploads/x.jpg)` or `[label](url)` into the listing.
function stripMarkdown(body: string): string {
  return body
    .replace(/!\[[^\]]*\]\([^)]*\)/g, "") // images → removed entirely
    .replace(/\[([^\]]+)\]\([^)]*\)/g, "$1") // links → keep the label text
    .replace(/`([^`]+)`/g, "$1") // inline code → its contents
    .replace(/^#{1,6}\s+/gm, "") // heading markers
    .replace(/^>\s?/gm, "") // blockquote markers
    .replace(/[*_]{1,3}([^*_]+)[*_]{1,3}/g, "$1") // bold / italic
    .replace(/[*_]/g, ""); // any stray emphasis chars
}

// Plain-text excerpt: strip markdown, collapse whitespace, then cut at the last
// word boundary before `max` and append an ellipsis.
export function postExcerpt(body: string, max = 160): string {
  const text = stripMarkdown(body).replace(/\s+/g, " ").trim();
  if (text.length <= max) return text;
  const slice = text.slice(0, max);
  const lastSpace = slice.lastIndexOf(" ");
  return `${(lastSpace > 0 ? slice.slice(0, lastSpace) : slice).trimEnd()}…`;
}

// Published posts, newest first (by publish date, then creation as a tiebreaker).
export function getPublishedPosts() {
  return db.post.findMany({
    where: { status: "PUBLISHED" },
    orderBy: [{ publishedAt: "desc" }, { createdAt: "desc" }],
  });
}

// A single published post by slug, or null (drafts and unknown slugs return null).
export function getPublishedPostBySlug(slug: string) {
  return db.post.findFirst({
    where: { slug, status: "PUBLISHED" },
  });
}
