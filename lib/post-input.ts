import { slugify } from "@/lib/slug";

// Validation/normalization for blog post create + update. publishedAt is set by
// the route (it depends on the current published state), not here.

export interface PostInput {
  title: string;
  slug: string;
  body: string;
  coverImage: string | null;
  status: "DRAFT" | "PUBLISHED";
  seoTitle: string | null;
  seoDescription: string | null;
}

export type ParseResult =
  | { ok: true; data: PostInput }
  | { ok: false; error: string };

export function parsePostInput(body: unknown): ParseResult {
  const b = (body ?? {}) as Record<string, unknown>;
  const str = (v: unknown) => (typeof v === "string" ? v.trim() : "");

  const title = str(b.title);
  if (!title) return { ok: false, error: "Title is required" };

  const bodyText = str(b.body);
  if (!bodyText) return { ok: false, error: "Body is required" };

  // Prefer an explicit slug, but fall back to the title if it isn't sluggable.
  const slug = slugify(str(b.slug)) || slugify(title);
  if (!slug) return { ok: false, error: "Could not generate a slug" };

  const status = b.status === "PUBLISHED" ? "PUBLISHED" : "DRAFT";

  return {
    ok: true,
    data: {
      title,
      slug,
      body: bodyText,
      coverImage: str(b.coverImage) || null,
      status,
      seoTitle: str(b.seoTitle) || null,
      seoDescription: str(b.seoDescription) || null,
    },
  };
}
