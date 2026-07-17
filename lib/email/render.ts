import { EMAIL, escapeHtml, wrapEmail } from "./theme";
import { SHOP, SOCIAL_LINKS } from "@/lib/shop-info";
import { arrivalsText, type ArrivalsGroup } from "@/lib/newsletter-arrivals";

// A small, email-safe markdown → HTML renderer built as plain strings. Runs in an
// App Router route handler, so it must NOT depend on react-dom/server. Supports the
// same subset PostBody renders (headings, bold, italic, code, links, images, lists,
// blockquotes, rules) with inline styles, and escapes raw HTML so admin-authored
// markdown has no injection surface.

const styles = {
  p: `margin:0 0 16px;color:${EMAIL.text};`,
  h2: `color:${EMAIL.text};font-size:20px;margin:24px 0 8px;`,
  h3: `color:${EMAIL.text};font-size:17px;margin:20px 0 8px;`,
  list: `margin:0 0 16px;padding-left:20px;color:${EMAIL.text};`,
  li: `margin:0 0 4px;`,
  blockquote: `margin:0 0 16px;padding:0 0 0 12px;border-left:2px solid ${EMAIL.hairline};color:${EMAIL.muted};font-style:italic;`,
  pre: `font-family:${EMAIL.mono};font-size:13px;color:${EMAIL.text};background:${EMAIL.panel};padding:12px;overflow-x:auto;margin:0 0 16px;`,
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

  const withTags = escaped
    .replace(
      /!\[([^\]]*)\]\(([^)\s]+)\)/g,
      (_, alt: string, url: string) =>
        keep(`<img src="${url}" alt="${alt}" style="max-width:100%;height:auto;" />`),
    )
    .replace(
      /\[([^\]]+)\]\(([^)\s]+)\)/g,
      (_, label: string, url: string) =>
        keep(`<a href="${url}" style="${styles.a}">${applyEmphasis(label)}</a>`),
    );

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

    // Blockquote (consecutive `>` lines)
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

    // Paragraph (consecutive plain lines, soft-wrapped)
    const para: string[] = [];
    while (
      i < lines.length &&
      lines[i].trim() !== "" &&
      !BLOCK_START.test(lines[i])
    ) {
      para.push(lines[i]);
      i += 1;
    }
    blocks.push(`<p style="${styles.p}">${renderInline(para.join(" "))}</p>`);
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

// Render the structured newsletter (header md → social links → grouped new
// arrivals → footer md → contact block → unsubscribe) to email-safe HTML.
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
  const socials = SOCIAL_LINKS.map(
    (s) =>
      `<p style="margin:0 0 4px;"><a href="${s.href}" style="${styles.a}">${s.href}</a></p>`,
  ).join("\n");

  const text = arrivalsText(arrivals);
  const arrivalsBlock = text
    ? `<pre style="${styles.pre}">${escapeHtml(text)}</pre>`
    : `<p style="margin:0 0 16px;color:${EMAIL.muted};">No new arrivals in this period.</p>`;

  const inner = `<h1 style="color:${EMAIL.text};font-size:24px;margin:0 0 24px;">${escapeHtml(subject)}</h1>
${markdownToHtml(header)}
<div style="margin:0 0 24px;">
${socials}
</div>
<h2 style="${styles.h2}">New arrivals</h2>
${arrivalsBlock}
${markdownToHtml(footer)}
<hr style="border:none;border-top:1px solid ${EMAIL.hairline};margin:32px 0 16px;" />
<p style="color:${EMAIL.muted};font-size:12px;line-height:1.5;margin:0 0 12px;">${escapeHtml(SHOP.name)} · ${escapeHtml(SHOP.addressLine)} · ${escapeHtml(SHOP.addressNote)} · <a href="${SHOP.phoneHref}" style="color:${EMAIL.accent};">${escapeHtml(SHOP.phone)}</a></p>
<p style="color:${EMAIL.muted};font-size:12px;line-height:1.5;margin:0;">You are receiving this because you subscribed to the Antenne Tilburg newsletter. <a href="${unsubscribeUrl}" style="color:${EMAIL.accent};">Unsubscribe</a>.</p>`;
  return wrapEmail(inner);
}
