# Session Log — 2026-07-06 (blog photos)

## What was built
- Admin image upload API (validated, admin-guarded, stores in public/uploads).
- PostForm "Insert image" → uploads + inserts ![](url) markdown at the cursor.
- /blog/[slug] now renders the body as markdown (react-markdown + PostBody), so inline
  images and formatting show.

## What worked
- Splitting into upload route / markdown rendering / form wiring kept each piece TDD'd
  (validation, insert helpers, image-renders) and committed independently.
- Live-verified the public markdown render (real generated image under /uploads) — the
  most important user-facing part.

## What drifted from intent
- Couldn't drive the admin upload UI end-to-end in the browser (needs a login; the
  assistant doesn't enter passwords). Covered by unit + component tests instead and
  noted in the feature doc.
- Blog bodies were previously plain-text paragraphs; switching to markdown changes how
  existing bodies render (blank-line paragraphs still work; single newlines no longer
  force <br>). Acceptable and on-brand.

## Signal (what should change in a shared artifact)
- [ ] Failure: uploads are local (public/uploads) with no GC — flagged object storage +
  deletion as backlog.

## Updates made
- lib/upload-input (+test), /api/admin/uploads (+test), lib/markdown (+test),
  components/PostBody, components/admin/PostForm (+test), /blog/[slug] page (+test),
  react-markdown dep, .gitignore, feature doc, this log, backlog note.
