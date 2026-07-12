import ReactMarkdown, { type Components } from "react-markdown";

// Markdown → DESIGN.md-styled elements. react-markdown does not render raw HTML by
// default, so post bodies (admin-authored markdown) have no HTML-injection surface.
const components: Components = {
  // Long-form reading line-height: DESIGN.md body is 1.6; +0.1 for light text on
  // the dark canvas (brand guidance) → 1.7, comfortable for a full post.
  p: ({ children }) => <p className="leading-[1.7]">{children}</p>,
  a: ({ href, children }) => {
    const external = /^https?:\/\//i.test(href ?? "");
    return (
      <a
        href={href ?? "#"}
        {...(external ? { target: "_blank", rel: "noopener noreferrer" } : {})}
        className="text-signal underline decoration-signal underline-offset-4 transition-colors duration-150 ease-out hover:text-ink"
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
  // Headings get more top padding than the block gap below them, so each heading
  // reads as belonging to the content that follows (asymmetric rhythm).
  h2: ({ children }) => (
    <h2 className="pt-6 text-2xl font-bold leading-[1.15] tracking-tight text-ink">
      {children}
    </h2>
  ),
  h3: ({ children }) => (
    <h3 className="pt-4 text-xl font-semibold leading-[1.2] tracking-tight text-ink">
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
    <div className="space-y-6 text-pretty text-ink">
      <ReactMarkdown components={components}>{body}</ReactMarkdown>
    </div>
  );
}
