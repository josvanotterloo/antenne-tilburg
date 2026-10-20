import { EMAIL, escapeHtml, wrapEmail } from "./theme";
import { SHOP } from "@/lib/shop-info";
import { arrivalsText, type ArrivalsGroup } from "@/lib/newsletter-arrivals";

// A small, email-safe markdown → HTML renderer built as plain strings. Runs in an
// App Router route handler, so it must NOT depend on react-dom/server. Supports the
// same subset PostBody renders (headings, bold, italic, code, links, images, lists,
// blockquotes, rules) with inline styles. Two independent protections, not one:
// escapeHtml prevents breaking out of an attribute/tag, and isSafeUrl (below)
// rejects a dangerous URL scheme (e.g. "javascript:") in a link/image target —
// escaping alone does not stop that, since the scheme itself is just ordinary
// characters that survive escaping unchanged.

// Base text size shared by ordinary body copy (paragraphs) and the new-
// arrivals <pre> block, so the two never visually drift apart again — the
// <pre> previously hardcoded 13px against the (inherited) 15px body size.
const BASE_FONT_SIZE = "16px";

const styles = {
  p: `margin:0 0 16px;color:${EMAIL.text};font-size:${BASE_FONT_SIZE};`,
  h2: `color:${EMAIL.text};font-size:20px;margin:24px 0 8px;`,
  h3: `color:${EMAIL.text};font-size:17px;margin:20px 0 8px;`,
  list: `margin:0 0 16px;padding-left:20px;color:${EMAIL.text};`,
  li: `margin:0 0 4px;`,
  blockquote: `margin:0 0 16px;padding:0 0 0 12px;border-left:2px solid ${EMAIL.hairline};color:${EMAIL.muted};font-style:italic;`,
  pre: `font-family:${EMAIL.mono};font-size:${BASE_FONT_SIZE};color:${EMAIL.text};background:${EMAIL.panel};padding:12px;overflow-x:auto;margin:0 0 16px;`,
  hr: `border:none;border-top:1px solid ${EMAIL.hairline};margin:24px 0;`,
  code: `font-family:${EMAIL.mono};font-size:13px;color:${EMAIL.accent};`,
  a: `color:${EMAIL.accent};text-decoration:underline;`,
  strong: `color:${EMAIL.text};font-weight:700;`,
} as const;

// Placeholder sentinels (private-use codepoints) wrapping a stash index. They
// never appear in escaped email text, so restoring built tags can't collide
// with ordinary digits in the content (years, "TR-909", prices).
const STASH_OPEN = "";
const STASH_CLOSE = "";
const STASH_RE = /(\d+)/g;

// A paragraph line-boundary marker, built from the same sentinel characters
// (letters, not digits — STASH_RE only ever matches a digit run, so this
// survives its restore pass completely untouched; see the paragraph
// line-break code below).
const LINE_BREAK_MARKER = `${STASH_OPEN}BR${STASH_CLOSE}`;

// Image/link regexes, excluding LINE_BREAK_MARKER from the alt/label capture
// group. Without this, "![a<marker>b](url)" (an image split across two
// paragraph lines with no blank line between them) would absorb the marker
// into its alt text, and the paragraph code's later marker→<br> swap would
// then corrupt the alt attribute it's already sitting inside — found by
// @code-reviewer for a literal "\n" before LINE_BREAK_MARKER replaced it;
// excluding the marker here removes the whole class of bug rather than
// trying to special-case it after the fact. The regex simply doesn't match
// across a line break now — that text renders as plain paragraph text
// instead of a corrupted tag.
const NOT_MARKER_OR_BRACKET = `(?:(?!${LINE_BREAK_MARKER})[^\\]])`;
const IMAGE_RE = new RegExp(
  `!\\[(${NOT_MARKER_OR_BRACKET}*)\\]\\(([^)\\s]+)\\)`,
  "g",
);
const LINK_RE = new RegExp(
  `\\[(${NOT_MARKER_OR_BRACKET}+)\\]\\(([^)\\s]+)\\)`,
  "g",
);

// Rejects a "javascript:"/"data:"/"vbscript:"/etc. scheme in an explicit
// [label](url) or ![alt](url). Markdown has no URL sanitisation of its own —
// without this, a stored "[click](javascript:...)" would execute when
// clicked. (The old PostBody/react-markdown preview this replaced filtered
// this by default; this hand-written renderer must do so explicitly.)
// Relative URLs (no scheme) and the schemes real content actually uses are
// allowed; anything else renders as the original literal markdown text
// instead of becoming a link. The bare-URL autolink below needs no such
// check — its own regex only ever matches an http(s) prefix to begin with.
const SAFE_URL_SCHEME = /^(?:https?|mailto|tel):/i;
const HAS_SCHEME = /^[a-z][a-z0-9+.-]*:/i;
function isSafeUrl(url: string): boolean {
  return SAFE_URL_SCHEME.test(url) || !HAS_SCHEME.test(url);
}

// Matches a bare http(s) URL for autolinking. Deliberately excludes the two
// stash sentinel characters (STASH_OPEN/STASH_CLOSE, interpolated below) —
// without that, a URL sitting directly against an already-stashed
// placeholder (e.g. "https://x.test\*", where "\*" was just stashed by the
// escaped-char pass below) would swallow that sentinel into the match, nest
// it inside this pass's OWN stash entry, and the single, non-recursive
// final restore pass could never reach it. The lookahead stops the match
// before a trailing &lt;/&gt;/&quot; entity — escapeHtml has already run by
// this point, so a literal "<https://x.test>" in the source is
// "&lt;https://x.test&gt;" here, and without the lookahead the greedy match
// would swallow the closing "&gt;" straight into the href.
const BARE_URL_RE = new RegExp(
  `https?:\\/\\/(?:(?!&(?:lt|gt|quot);)[^\\s"'${STASH_OPEN}${STASH_CLOSE}])+`,
  "g",
);

// Splits a matched bare URL into the part that's really the URL and a
// trailing part that almost certainly isn't: sentence punctuation, or a
// closing bold/italic marker that will now sit right after the built <a>
// (so it still re-pairs with the opening marker before it, same as if the
// URL were plain text) — and an unbalanced closing ) that closes a
// surrounding parenthetical in the prose rather than the URL itself; a
// Wikipedia-style "https://en.wikipedia.org/wiki/Foo_(bar)" stays balanced
// and keeps its ")".
function splitUrlTrailing(rawMatch: string): { url: string; trailing: string } {
  let url = rawMatch;
  let trailing = "";

  const punct = /[.,!?;:*_]+$/.exec(url)?.[0] ?? "";
  if (punct) {
    url = url.slice(0, -punct.length);
    trailing = punct;
  }

  while (url.endsWith(")")) {
    const opens = (url.match(/\(/g) ?? []).length;
    const closes = (url.match(/\)/g) ?? []).length;
    if (closes <= opens) break;
    url = url.slice(0, -1);
    trailing = ")" + trailing;
  }

  return { url, trailing };
}

// Backslash-escaped punctuation: `\X` for any of `\ * _` renders as a
// literal X and must be invisible to the bold/italic regexes below —
// otherwise a run like `\*\*\*\*\*\*\*\*` (an escaped divider line) gets
// misread as pairs of italic markers and comes out as mismatched, garbled
// <em> tags instead of eight literal asterisks.
const ESCAPED_CHAR = /\\([\\*_])/g;

// Bold/italic passes. Applied to plain text and to link labels, but never to
// built URLs. Bold before italic so `**` isn't consumed by the single-`*` rule.
function applyEmphasis(text: string): string {
  return text
    .replace(
      /\*\*([^*]+)\*\*/g,
      (_, t: string) => `<strong style="${styles.strong}">${t}</strong>`,
    )
    .replace(/\*([^*\n]+)\*/g, (_, t: string) => `<em>${t}</em>`)
    .replace(/_([^_\n]+)_/g, (_, t: string) => `<em>${t}</em>`);
}

// Emphasis / links / images on a text run that contains no inline code. Built
// links/images are stashed behind sentinels so the emphasis passes can't
// rewrite `_`/`*` inside a URL (utm_source, file_names, a_b.png) — a very
// common corruption. Link label text is still emphasised via applyEmphasis.
function formatEmphasis(escaped: string): string {
  const stash: string[] = [];
  const keep = (html: string) =>
    `${STASH_OPEN}${stash.push(html) - 1}${STASH_CLOSE}`;

  // Stash backslash-escaped characters first, before any markdown syntax is
  // interpreted, so `\*`/`\_`/`\\` always survive as literal characters —
  // invisible to the image/link/bold/italic passes below.
  const withEscapes = escaped.replace(ESCAPED_CHAR, (_, ch: string) => keep(ch));

  const withTags = withEscapes
    .replace(
      IMAGE_RE,
      (match, alt: string, url: string) =>
        isSafeUrl(url)
          ? keep(`<img src="${url}" alt="${alt}" style="max-width:100%;height:auto;" />`)
          : match,
    )
    .replace(
      LINK_RE,
      (match, label: string, url: string) =>
        isSafeUrl(url)
          ? keep(`<a href="${url}" style="${styles.a}">${applyEmphasis(label)}</a>`)
          : match,
    )
    // Bare-URL autolink (GFM-style). Runs after the explicit [label](url) and
    // image passes above, so by now any URL that was part of one of those is
    // already stashed behind a sentinel — this only ever sees literal
    // leftover text, never double-links an already-built link/image. No
    // isSafeUrl check needed: BARE_URL_RE only ever matches an http(s) URL.
    .replace(BARE_URL_RE, (match: string) => {
      const { url, trailing } = splitUrlTrailing(match);
      return `${keep(`<a href="${url}" style="${styles.a}">${url}</a>`)}${trailing}`;
    });

  return applyEmphasis(withTags).replace(
    STASH_RE,
    (_, i: string) => stash[Number(i)],
  );
}

// Inline formatting for one block of text. HTML is escaped first; inline code spans
// are kept verbatim (split out) so their contents aren't treated as markdown.
function renderInline(text: string): string {
  const escaped = escapeHtml(text);
  return escaped
    .split(/(`[^`]+`)/)
    .map((part) => {
      const code = /^`([^`]+)`$/.exec(part);
      if (code) {
        return `<code style="${styles.code}">${code[1]}</code>`;
      }
      return formatEmphasis(part);
    })
    .join("");
}

function renderList(items: string[], ordered: boolean): string {
  const tag = ordered ? "ol" : "ul";
  const lis = items
    .map((item) => `<li style="${styles.li}">${renderInline(item)}</li>`)
    .join("");
  return `<${tag} style="${styles.list}">${lis}</${tag}>`;
}

const BLOCK_START = /^(#{2,3}\s|[-*]\s|\d+\.\s|>\s?|```|(?:-{3,}|\*{3,}|_{3,})$)/;

// Markdown → email-safe HTML string.
export function markdownToHtml(markdown: string): string {
  const lines = markdown.replace(/\r\n/g, "\n").split("\n");
  const blocks: string[] = [];
  let i = 0;

  while (i < lines.length) {
    const line = lines[i];

    if (line.trim() === "") {
      i += 1;
      continue;
    }

    // Fenced code block ```
    if (/^```/.test(line)) {
      const code: string[] = [];
      i += 1;
      while (i < lines.length && !/^```/.test(lines[i])) {
        code.push(lines[i]);
        i += 1;
      }
      i += 1; // consume closing fence
      blocks.push(`<pre style="${styles.pre}">${escapeHtml(code.join("\n"))}</pre>`);
      continue;
    }

    // Horizontal rule
    if (/^(-{3,}|\*{3,}|_{3,})$/.test(line.trim())) {
      blocks.push(`<hr style="${styles.hr}" />`);
      i += 1;
      continue;
    }

    // Headings (## / ###; # is reserved for the subject)
    const heading = /^(#{2,3})\s+(.*)$/.exec(line);
    if (heading) {
      const level = heading[1].length === 2 ? "h2" : "h3";
      const style = level === "h2" ? styles.h2 : styles.h3;
      blocks.push(`<${level} style="${style}">${renderInline(heading[2])}</${level}>`);
      i += 1;
      continue;
    }

    // Blockquote (consecutive `>` lines). Deliberately still joined with a
    // space, not <br> — unlike a paragraph, a quoted passage is one flowing
    // run of text; @code-reviewer flagged this divergence from paragraphs
    // (N2) for a decision, and this is it.
    if (/^>\s?/.test(line)) {
      const quote: string[] = [];
      while (i < lines.length && /^>\s?/.test(lines[i])) {
        quote.push(lines[i].replace(/^>\s?/, ""));
        i += 1;
      }
      blocks.push(
        `<blockquote style="${styles.blockquote}">${renderInline(quote.join(" "))}</blockquote>`,
      );
      continue;
    }

    // Unordered list
    if (/^[-*]\s+/.test(line)) {
      const items: string[] = [];
      while (i < lines.length && /^[-*]\s+/.test(lines[i])) {
        items.push(lines[i].replace(/^[-*]\s+/, ""));
        i += 1;
      }
      blocks.push(renderList(items, false));
      continue;
    }

    // Ordered list
    if (/^\d+\.\s+/.test(line)) {
      const items: string[] = [];
      while (i < lines.length && /^\d+\.\s+/.test(lines[i])) {
        items.push(lines[i].replace(/^\d+\.\s+/, ""));
        i += 1;
      }
      blocks.push(renderList(items, true));
      continue;
    }

    // Paragraph (consecutive plain lines). Each source line becomes its own
    // visual line via <br> — structural, driven by the line breaks that are
    // already there, never by a fragile trailing-double-space convention
    // (easily stripped by editors/copy-paste; see tasks/lessons.md and
    // docs/qa/qa-findings-newsletter.md N5 for the bug this caused: breaks
    // survived in the preview but silently died before the real send).
    const para: string[] = [];
    while (
      i < lines.length &&
      lines[i].trim() !== "" &&
      !BLOCK_START.test(lines[i])
    ) {
      // Trailing whitespace is dropped per line, not preserved — a legacy
      // "two trailing spaces = hard break" source must render identically
      // to the same text without them, so nothing here depends on that
      // fragile, easily-stripped convention.
      para.push(lines[i].replace(/\s+$/, ""));
      i += 1;
    }
    // A sentinel marker, not a literal "\n", carries the line boundary
    // through renderInline — @code-reviewer found that a blanket "\n" →
    // "<br>" replace run AFTER renderInline would also corrupt a literal
    // newline that happened to survive inside a restored attribute (e.g. a
    // multi-line image alt text). Letters, not digits, so STASH_RE's
    // restore pass (which only matches digit runs between sentinels) never
    // touches it — it passes through untouched and is swapped for a real
    // <br> only at the very end, nowhere near attribute content.
    const paraHtml = renderInline(para.join(LINE_BREAK_MARKER))
      .split(LINE_BREAK_MARKER)
      .join("<br>\n");
    blocks.push(`<p style="${styles.p}">${paraHtml}</p>`);
  }

  return blocks.join("\n");
}

// Render a newsletter (subject + markdown body) to a full, email-safe HTML document,
// with a personalised unsubscribe link in the footer.
export function renderNewsletterEmail({
  subject,
  body,
  unsubscribeUrl,
}: {
  subject: string;
  body: string;
  unsubscribeUrl: string;
}): string {
  const inner = `<h1 style="color:${EMAIL.text};font-size:24px;margin:0 0 24px;">${escapeHtml(subject)}</h1>
${markdownToHtml(body)}
<hr style="border:none;border-top:1px solid ${EMAIL.hairline};margin:32px 0 16px;" />
<p style="color:${EMAIL.muted};font-size:12px;line-height:1.5;margin:0;">You are receiving this because you subscribed to the Antenne Tilburg newsletter. <a href="${unsubscribeUrl}" style="color:${EMAIL.accent};">Unsubscribe</a>.</p>`;
  return wrapEmail(inner);
}

// Shared footer contact block (N1) — the single place this markup lives,
// used by both the send renderer below and the compose preview
// (components/admin/NewsletterComposer.tsx), which used to hand-duplicate
// the same literal HTML. Stacked one line per field rather than the old
// single "·"-joined line (which wrapped awkwardly) — kept, not removed: a
// sender's physical address in bulk mail is legally advisable and the
// unsubscribe link is legally required either way (see
// docs/qa/qa-findings-newsletter.md N1).
export function footerAddressHtml(): string {
  const line = (html: string, marginBottom: number) =>
    `<p style="color:${EMAIL.muted};font-size:12px;line-height:1.5;margin:0 0 ${marginBottom}px;">${html}</p>`;
  return [
    line(escapeHtml(SHOP.name), 4),
    line(escapeHtml(SHOP.addressLine), 4),
    line(escapeHtml(SHOP.addressNote), 4),
    line(
      `<a href="${SHOP.phoneHref}" style="color:${EMAIL.accent};">${escapeHtml(SHOP.phone)}</a>`,
      12,
    ),
  ].join("\n");
}

// Render the structured newsletter (header md → grouped new arrivals →
// footer md → contact block → unsubscribe) to email-safe HTML. Social links
// are NOT auto-appended — the shop owner includes them in their header
// template, and auto-appending duplicated them.
export function renderStructuredNewsletterEmail({
  subject,
  header,
  arrivals,
  footer,
  unsubscribeUrl,
}: {
  subject: string;
  header: string;
  arrivals: ArrivalsGroup[];
  footer: string;
  unsubscribeUrl: string;
}): string {
  const text = arrivalsText(arrivals);
  const arrivalsBlock = text
    ? `<pre style="${styles.pre}">${escapeHtml(text)}</pre>`
    : `<p style="margin:0 0 16px;color:${EMAIL.muted};font-size:${BASE_FONT_SIZE};">No new arrivals in this period.</p>`;

  const inner = `<h1 style="color:${EMAIL.text};font-size:24px;margin:0 0 24px;">${escapeHtml(subject)}</h1>
${markdownToHtml(header)}
<h2 style="${styles.h2}">New arrivals</h2>
${arrivalsBlock}
${markdownToHtml(footer)}
<hr style="border:none;border-top:1px solid ${EMAIL.hairline};margin:32px 0 16px;" />
${footerAddressHtml()}
<p style="color:${EMAIL.muted};font-size:12px;line-height:1.5;margin:0;">You are receiving this because you subscribed to the Antenne Tilburg newsletter. <a href="${unsubscribeUrl}" style="color:${EMAIL.accent};">Unsubscribe</a>.</p>`;
  return wrapEmail(inner);
}
