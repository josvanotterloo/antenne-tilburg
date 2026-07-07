import { renderToStaticMarkup } from "react-dom/server";
import ReactMarkdown, { type Components } from "react-markdown";

import { EMAIL, escapeHtml, wrapEmail } from "./theme";

// Email-safe markdown renderers: every element carries inline styles. react-markdown
// does not render raw HTML, so admin-authored markdown has no HTML-injection surface.
const components: Components = {
  p: ({ children }) => (
    <p style={{ margin: "0 0 16px", color: EMAIL.text }}>{children}</p>
  ),
  a: ({ href, children }) => (
    <a
      href={href ?? "#"}
      style={{ color: EMAIL.accent, textDecoration: "underline" }}
    >
      {children}
    </a>
  ),
  strong: ({ children }) => (
    <strong style={{ color: EMAIL.text, fontWeight: 700 }}>{children}</strong>
  ),
  em: ({ children }) => <em style={{ fontStyle: "italic" }}>{children}</em>,
  h2: ({ children }) => (
    <h2 style={{ color: EMAIL.text, fontSize: "20px", margin: "24px 0 8px" }}>
      {children}
    </h2>
  ),
  h3: ({ children }) => (
    <h3 style={{ color: EMAIL.text, fontSize: "17px", margin: "20px 0 8px" }}>
      {children}
    </h3>
  ),
  ul: ({ children }) => (
    <ul style={{ margin: "0 0 16px", paddingLeft: "20px", color: EMAIL.text }}>
      {children}
    </ul>
  ),
  ol: ({ children }) => (
    <ol style={{ margin: "0 0 16px", paddingLeft: "20px", color: EMAIL.text }}>
      {children}
    </ol>
  ),
  li: ({ children }) => <li style={{ margin: "0 0 4px" }}>{children}</li>,
  blockquote: ({ children }) => (
    <blockquote
      style={{
        margin: "0 0 16px",
        padding: "0 0 0 12px",
        borderLeft: `2px solid ${EMAIL.hairline}`,
        color: EMAIL.muted,
        fontStyle: "italic",
      }}
    >
      {children}
    </blockquote>
  ),
  // Catalog data (catalogue numbers, formats) reads as monospace, per the brief.
  code: ({ children }) => (
    <code style={{ fontFamily: EMAIL.mono, fontSize: "13px", color: EMAIL.accent }}>
      {children}
    </code>
  ),
  pre: ({ children }) => (
    <pre
      style={{
        fontFamily: EMAIL.mono,
        fontSize: "13px",
        color: EMAIL.text,
        background: EMAIL.panel,
        padding: "12px",
        overflowX: "auto",
        margin: "0 0 16px",
      }}
    >
      {children}
    </pre>
  ),
  hr: () => (
    <hr style={{ border: "none", borderTop: `1px solid ${EMAIL.hairline}`, margin: "24px 0" }} />
  ),
  img: ({ src, alt }) => (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={typeof src === "string" ? src : ""}
      alt={alt ?? ""}
      style={{ maxWidth: "100%", height: "auto" }}
    />
  ),
};

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
  const bodyHtml = renderToStaticMarkup(
    <ReactMarkdown components={components}>{body}</ReactMarkdown>,
  );
  const inner = `<h1 style="color:${EMAIL.text};font-size:24px;margin:0 0 24px;">${escapeHtml(subject)}</h1>
${bodyHtml}
<hr style="border:none;border-top:1px solid ${EMAIL.hairline};margin:32px 0 16px;" />
<p style="color:${EMAIL.muted};font-size:12px;line-height:1.5;margin:0;">You are receiving this because you subscribed to the Antenne Tilburg newsletter. <a href="${unsubscribeUrl}" style="color:${EMAIL.accent};">Unsubscribe</a>.</p>`;
  return wrapEmail(inner);
}
