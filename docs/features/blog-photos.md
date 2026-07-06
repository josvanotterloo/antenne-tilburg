# Blog post photos (inline images + markdown)

**Status:** branch `feature/blog-photos` — merged to `master` (2026-07-06).

## Summary
Admins can add multiple inline images to a blog post, and the public post page renders
the body as markdown (so images and formatting show).

## What's in place
- **Upload API — `POST /api/admin/uploads`:** admin-guarded (`requireAdmin`). Validates
  type (jpg/png/webp/gif) and size (≤ 5 MB) via `lib/upload-input.validateUpload`,
  stores the file under `public/uploads/` with a random UUID filename, and returns
  `{ url: "/uploads/<uuid>.<ext>" }`. `public/uploads` is gitignored (a `.gitkeep`
  keeps the dir); moving to object storage only changes this handler.
- **Post form:** an "Insert image" control uploads the picked file and inserts
  `![](url)` markdown into the body **at the cursor** (`lib/markdown` `insertAt` +
  `imageMarkdown`), supporting multiple images. Body is now labelled markdown.
- **Public rendering — `components/PostBody`:** `/blog/[slug]` renders the body with
  `react-markdown`, mapped to DESIGN.md-styled elements (hairline-framed images, signal
  links that open external URLs in a new tab, mono code). **No raw HTML is rendered**,
  so there's no HTML-injection surface.

## Tests & verification
- **19 tests across the item** (278 total green): upload validation (types/size/empty);
  the upload route (401 unauth, 400 bad/oversize/missing, 201 + URL, writes once);
  `insertAt`/`imageMarkdown`; PostForm (upload inserts markdown, shows server error);
  the blog page renders an inline markdown image as `<img>`.
- **Live (public):** a throwaway post with a markdown body (bold, external link,
  heading, list, uploaded image) rendered correctly on the black canvas — the
  `/uploads` image displayed hairline-framed. Cleaned up afterwards.
- The **admin upload UI** wasn't driven end-to-end in the browser (that needs an admin
  login, and the assistant doesn't enter passwords); it's covered by the unit + component
  tests above.

## Follow-ups
- Move `public/uploads` to Hetzner Object Storage (backlog).
- No image deletion/GC yet; orphaned uploads accumulate.
