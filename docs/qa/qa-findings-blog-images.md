# QA findings — blog post images

Source: manual QA pass, 29 Sep 2026. Found while testing blog image upload
against the dev database. None is a launch blocker on its own; F3 and F5 should
be resolved before or alongside the uploads/object-storage work.

Evidence: post "New items in the shop" (/blog/new-items-in-the-shop), and two
files in `public/uploads/`:

    dfe580b2-2ef8-4bff-8087-9169c0da2ab7.jpg  119661 bytes  28 Sep
    2c064ce8-3eab-495c-9045-d89188b5f146.jpg  119661 bytes   8 Jul
    (identical content, different names)

---

## F1 — Inline image nested inside `<p>`, invalid HTML + no top spacing
Severity: medium (visible defect + invalid markup)

The editor inserts a block-styled image as the last child of the paragraph:

    <p class="leading-[1.7]">…VICEROYS, etc<img class="mx-auto mb-8 block …"/></p>

A block `<img>` inside a `<p>` is invalid HTML. Visually the image has a bottom
margin (`mb-8`) but no top margin, so it butts directly against the text above —
this is the "no spacing between text and photo" report.

Preferred fix: insert block images as siblings of the paragraph, not children,
so the content tree is valid.
Fallback fix: add top spacing to images within post content via CSS. Papers over
the gap but leaves the invalid nesting; if taken, log the nesting as debt.

Acceptance: a post with an inline image renders the image as a block-level
sibling with clear space above and below; the post body contains no `<img>`
inside a `<p>`.

---

## F2 — Admin editor doesn't preview an image after insert
Severity: low (cosmetic, admin-only; published output is correct)

After uploading via insert/image, the admin editor shows no image and no visible
reference, which reads as "the upload failed". It did not: the file is written
and the reference is inserted into the saved body, and the published post renders
the image correctly. Only the editor's own preview fails to show the just-
inserted image back to the author.

Acceptance: after inserting an image, the editor displays it in place, matching
what the published post will show.

---

## F3 — No de-duplication of identical uploads
Severity: medium (architectural; compounds over time and follows uploads to
object storage)

Every upload is assigned a fresh UUID filename with no check for identical
existing content. The two files above are byte-identical with different names,
produced by uploading the same image twice. Re-uploading the same file N times
yields N copies.

Not a launch blocker, but it directly shapes the parked "Hetzner Object Storage
for uploads" item: whatever uploads move to inherits this behaviour unless
content-hashing (or a dedupe check) is added. Decide the strategy before the
migration, not after.

Acceptance: uploading a file whose content already exists reuses the existing
stored object rather than writing a second copy — or an explicit decision is
recorded that duplicates are acceptable and why.

---

## F4 — Inline image has empty alt text
Severity: low (SEO + accessibility; ties to the open SEO pass)

The inserted image renders `alt=""`. Empty alt is correct for purely decorative
images but wrong for content images, which shop photos are. This belongs with
the SEO/accessibility pass already open for the project: cover and inline images
should carry meaningful alt text, ideally an editor field rather than a manual
HTML edit.

Acceptance: the editor lets the author set alt text on an inserted image, and it
appears in the published markup.

---

## Confirmed working (not defects)
- Upload → insert → save → publish path works end to end; file lands in
  `public/uploads/` with a UUID name and the reference is embedded in the post.
- No Sentry errors on the published page.
- Page metadata and Open Graph description populate from the post body.
- Inline image carries `loading="lazy"`.

## Note — dev only
`public/uploads/` is writable and served directly in dev. On the production VPS
with a production build, runtime-written files under `public/` are not served the
same way and do not survive a redeploy — this is the reason object storage is on
the backlog. These findings are about the feature; the production storage path is
a separate, already-tracked item.
