import ReactMarkdown, { type Components } from "react-markdown";

// Markdown → DESIGN.md-styled elements. react-markdown does not render raw HTML by
// default, so post bodies (admin-authored markdown) have no HTML-injection surface.
const components: Components = {
  p: ({ children }) => <p className="leading-relaxed">{children}</p>,
  a: ({ href, children }) => {
    const external = /^https?:\/\//i.test(href ?? "");
    return (
      <a
        href={href ?? "#"}
        {...(external ? { target: "_blank", rel: "noopener noreferrer" } : {})}
        className="text-signal underline decoration-signal underline-offset-4 transition-colors hover:text-ink"
      >
        {children}
      </a>
    );
  },
  img: ({ src, alt }) => (
    // Inline post images live under /uploads (arbitrary dimensions); plain <img>.
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={typeof src === "string" ? src : ""}
      alt={alt ?? ""}
      loading="lazy"
      className="mx-auto mb-8 block w-full max-w-[600px] border border-hairline"
    />
  ),
  h2: ({ children }) => (
    <h2 className="pt-4 text-2xl font-bold tracking-tight text-ink">
      {children}
    </h2>
  ),
  h3: ({ children }) => (
    <h3 className="pt-2 text-xl font-semibold tracking-tight text-ink">
      {children}
    </h3>
  ),
  ul: ({ children }) => (
    <ul className="list-disc space-y-1 pl-6">{children}</ul>
  ),
  ol: ({ children }) => (
    <ol className="list-decimal space-y-1 pl-6">{children}</ol>
  ),
  blockquote: ({ children }) => (
    <blockquote className="italic text-ink-muted">{children}</blockquote>
  ),
  strong: ({ children }) => (
    <strong className="font-semibold text-ink">{children}</strong>
  ),
  em: ({ children }) => <em className="italic">{children}</em>,
  code: ({ children }) => (
    <code className="font-mono text-sm text-ink">{children}</code>
  ),
  pre: ({ children }) => (
    <pre className="overflow-x-auto border border-hairline p-3 font-mono text-xs text-ink">
      {children}
    </pre>
  ),
  hr: () => <hr className="border-hairline" />,
};

export function PostBody({ body }: { body: string }) {
  return (
    <div className="space-y-4 text-pretty text-ink">
      <ReactMarkdown components={components}>{body}</ReactMarkdown>
    </div>
  );
}
