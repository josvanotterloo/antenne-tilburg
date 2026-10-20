// @vitest-environment node
import { describe, it, expect } from "vitest";
import fc from "fast-check";

import {
  markdownToHtml,
  renderNewsletterEmail,
  renderStructuredNewsletterEmail,
  footerAddressHtml,
} from "@/lib/email/render";
import { renderConfirmEmail } from "@/lib/email/confirm";

describe("renderNewsletterEmail", () => {
  const html = renderNewsletterEmail({
    subject: "New arrivals this week",
    body: "Fresh **wax** just landed — grab the `TR-909` reissue.",
    unsubscribeUrl: "https://antenne.test/api/newsletter/unsubscribe?token=abc",
  });

  it("includes the subject as a heading", () => {
    expect(html).toContain("New arrivals this week");
  });

  it("renders bold as <strong>", () => {
    expect(html).toContain("<strong");
    expect(html).toContain("wax");
  });

  it("renders inline code as monospace <code>", () => {
    expect(html).toContain("<code");
    expect(html).toContain("TR-909");
  });

  it("applies the accent colour", () => {
    expect(html.toLowerCase()).toContain("#6b7dc9");
  });

  it("emits a well-formed font-family (fonts single-quoted, not breaking the style attr)", () => {
    expect(html).toContain("'Segoe UI'");
    expect(html).not.toContain('"Segoe UI"');
  });

  it("includes the personalised unsubscribe link", () => {
    expect(html).toContain(
      "https://antenne.test/api/newsletter/unsubscribe?token=abc",
    );
    expect(html.toLowerCase()).toContain("unsubscribe");
  });
});

describe("renderNewsletterEmail — markdown coverage", () => {
  const render = (body: string) =>
    renderNewsletterEmail({ subject: "s", body, unsubscribeUrl: "u" });

  it("renders ## / ### as headings", () => {
    expect(render("## Big")).toContain("<h2");
    expect(render("### Small")).toContain("<h3");
  });

  it("renders unordered and ordered lists", () => {
    const ul = render("- one\n- two");
    expect(ul).toContain("<ul");
    expect(ul).toContain("<li");
    expect(ul).toContain("one");
    expect(render("1. first\n2. second")).toContain("<ol");
  });

  it("renders italics and links", () => {
    expect(render("a *dusty* tape")).toContain("<em");
    const link = render("see [the shop](https://x.test/shop)");
    expect(link).toContain('href="https://x.test/shop"');
    expect(link).toContain("the shop");
  });

  it("does not corrupt link URLs that contain underscores", () => {
    // The italic rule must not rewrite _..._ inside an already-built href.
    const link = render("see [it](https://x.test/foo_bar_baz?utm_source=news)");
    expect(link).toContain('href="https://x.test/foo_bar_baz?utm_source=news"');
    expect(link).not.toContain("<em");
  });

  it("does not corrupt image URLs that contain underscores or asterisks", () => {
    const img = render("![x](https://cdn.test/a_b_c.png)");
    expect(img).toContain('src="https://cdn.test/a_b_c.png"');
    expect(img).not.toContain("<em");
  });

  it("still italicizes underscores in ordinary prose", () => {
    expect(render("a _dusty_ tape")).toContain("<em");
  });


  it("renders blockquotes and horizontal rules", () => {
    expect(render("> come dig")).toContain("<blockquote");
    expect(render("---")).toContain("<hr");
  });

  it("wraps plain lines in paragraphs", () => {
    expect(render("just a line")).toContain("<p");
  });

  it("escapes raw HTML in the body (no injection surface)", () => {
    const out = render("hi <script>alert('x')</script> there");
    expect(out).not.toContain("<script>");
    expect(out).toContain("&lt;script&gt;");
  });
});

// Bug fix (2026-07-21): the engine had no backslash-escape mechanism, so
// `\*` fed straight into the bold/italic regexes. A lone `\*` leaked its
// backslash through untouched; a run of them (e.g. `\*\*\*\*\*\*\*\*`) got
// glued into mismatched, garbled <em> pairs by the italic regex. Both cases
// should render as plain literal asterisks — no different from any other
// character — and must not become bold/italic/<hr>.
describe("markdownToHtml — escaped asterisks", () => {
  it("renders a lone escaped asterisk as a literal character, not emphasis", () => {
    const out = markdownToHtml("5 \\* 3 = 15");
    expect(out).toContain("5 * 3 = 15");
    expect(out).not.toContain("<em");
    expect(out).not.toContain("<strong");
  });

  it("renders a run of escaped asterisks as literal asterisks, not <hr>/<strong>/<em>", () => {
    const escapedRule = "\\*".repeat(8); // source: \*\*\*\*\*\*\*\* (8 escaped *)
    const out = markdownToHtml(`${escapedRule}\ndiscogs\n${escapedRule}`);
    expect(out).not.toContain("<hr");
    expect(out).not.toContain("<strong");
    expect(out).not.toContain("<em");
    expect(out).toContain("*".repeat(8)); // literal ******** survives
    expect(out).toContain("discogs");
  });

  it("renders an escaped bold marker (\\*\\*) as literal asterisks, not <strong>", () => {
    const out = markdownToHtml("\\*\\*not bold\\*\\*");
    expect(out).not.toContain("<strong");
    expect(out).toContain("**not bold**");
  });

  it("still renders unescaped emphasis and a real horizontal rule normally", () => {
    // Regression guard: the fix must not defeat real markdown syntax.
    expect(markdownToHtml("a *dusty* tape")).toContain("<em");
    expect(markdownToHtml("a **loud** tape")).toContain("<strong");
    expect(markdownToHtml("***")).toContain("<hr");
  });

  it("renders an escaped backslash as a single literal backslash", () => {
    expect(markdownToHtml("C:\\\\Users")).toContain("C:\\Users");
  });
});

describe("markdownToHtml — fenced code blocks", () => {
  it("renders a fenced code block as <pre>, contents escaped", () => {
    const out = markdownToHtml("```\nconst x = 1 < 2;\n```");
    expect(out).toContain("<pre");
    expect(out).toContain("const x = 1 &lt; 2;");
    expect(out).not.toContain("<script");
  });

  it("does not treat lines inside a fence as their own markdown blocks", () => {
    const out = markdownToHtml("```\n## not a heading\n```");
    expect(out).not.toContain("<h2");
    expect(out).toContain("## not a heading");
  });

  it("consumes every line up to the closing fence, not just the first", () => {
    const out = markdownToHtml("```\nline one\nline two\nline three\n```\nafter");
    expect(out).toContain("line one");
    expect(out).toContain("line two");
    expect(out).toContain("line three");
    // Everything after the closing fence is a separate paragraph, not code.
    expect(out).toMatch(/<\/pre>[\s\S]*<p[^>]*>after<\/p>/);
  });
});

describe("markdownToHtml — blank lines and block boundaries", () => {
  it("collapses multiple consecutive blank lines to a single gap between blocks", () => {
    const out = markdownToHtml("first\n\n\nsecond");
    expect(out.split("<p ").length - 1).toBe(2);
  });

  it("stops a paragraph at a heading with no blank line in between", () => {
    const out = markdownToHtml("plain line\n## Heading");
    expect(out).toContain("<p");
    expect(out).toContain("<h2");
    expect(out).not.toContain("## Heading</p>");
  });
});

describe("markdownToHtml — heading levels render distinct sizes", () => {
  it("gives h2 and h3 different font sizes", () => {
    const h2 = markdownToHtml("## Big");
    const h3 = markdownToHtml("### Small");
    expect(h2).toContain("font-size:20px");
    expect(h3).toContain("font-size:17px");
  });
});

describe("markdownToHtml — list and blockquote edge cases", () => {
  it("accepts * as a bullet marker, not just -", () => {
    const out = markdownToHtml("* one\n* two");
    expect(out).toContain("<ul");
    expect(out).toContain("one");
    expect(out).toContain("two");
  });

  it("accepts a blockquote marker with no space after >", () => {
    const out = markdownToHtml(">no space");
    expect(out).toContain("<blockquote");
    expect(out).toContain("no space");
  });

  it("renders double-digit ordered list markers", () => {
    const out = markdownToHtml("10. tenth\n11. eleventh");
    expect(out).toContain("<ol");
    expect(out).toContain("tenth");
    expect(out).toContain("eleventh");
  });

  it("stops an unordered list at the first non-matching line, not just at end of input", () => {
    const out = markdownToHtml("- one\n- two\nplain");
    const listEnd = out.indexOf("</ul>");
    expect(listEnd).toBeGreaterThan(-1);
    expect(out.indexOf("plain")).toBeGreaterThan(listEnd);
    // "plain" must not have become a third <li>.
    expect(out.match(/<li/g)).toHaveLength(2);
  });

  it("stops an ordered list at the first non-matching line", () => {
    const out = markdownToHtml("1. first\n2. second\nplain");
    const listEnd = out.indexOf("</ol>");
    expect(out.indexOf("plain")).toBeGreaterThan(listEnd);
    expect(out.match(/<li/g)).toHaveLength(2);
  });

  it("joins consecutive blockquote lines and stops before trailing plain text", () => {
    const out = markdownToHtml("> line one\n> line two\nplain");
    const quoteEnd = out.indexOf("</blockquote>");
    expect(out).toContain("line one line two");
    expect(out.indexOf("plain")).toBeGreaterThan(quoteEnd);
  });
});

describe("markdownToHtml — horizontal rule detection", () => {
  it("trims surrounding whitespace before checking for a rule", () => {
    expect(markdownToHtml("   ***   ")).toContain("<hr");
  });

  it("requires at least three marker characters — two is just a paragraph", () => {
    const out = markdownToHtml("--");
    expect(out).not.toContain("<hr");
    expect(out).toContain("<p");
  });
});

describe("markdownToHtml — heading marker must be at line start", () => {
  it("does not treat a mid-line ## as a heading", () => {
    const out = markdownToHtml("Some notes ## not a heading");
    expect(out).not.toContain("<h2");
    expect(out).toContain("<p");
    expect(out).toContain("Some notes ## not a heading");
  });
});

describe("markdownToHtml — image with empty alt text", () => {
  it("still renders as an image when alt text is empty", () => {
    const out = markdownToHtml("![](https://x.test/a.png)");
    expect(out).toContain('src="https://x.test/a.png"');
    expect(out).toContain('alt=""');
  });
});

describe("markdownToHtml — double-digit stash indices", () => {
  it("restores more than 9 stashed links in one paragraph correctly", () => {
    // A dozen new-arrival links in one newsletter paragraph — plausible
    // real content that happens to force the internal placeholder-stash
    // index into double digits (0–11), exercising the same boundary a
    // contrived escape-character stress test would, without depending on
    // input no admin would ever actually type.
    const links = Array.from(
      { length: 12 },
      (_, i) => `[Release ${i + 1}](https://www.discogs.com/release/${1000 + i})`,
    ).join(", ");
    const out = markdownToHtml(`New arrivals this week: ${links}`);
    expect(out).toContain('href="https://www.discogs.com/release/1011"');
    expect(out.match(/<a href=/g)).toHaveLength(12);
  });
});

describe("markdownToHtml — bare URL autolinking (N2)", () => {
  it("turns a bare URL into a real link", () => {
    const out = markdownToHtml("Check out https://example.com for more");
    expect(out).toContain('<a href="https://example.com"');
    expect(out).toContain("https://example.com</a>");
  });

  it("does not swallow trailing sentence punctuation into the href", () => {
    const out = markdownToHtml("See https://example.com/page.");
    expect(out).toContain('href="https://example.com/page"');
    expect(out).toMatch(/<\/a>\.<\/p>/);
  });

  it("does not double-link a URL already inside an explicit [label](url) link", () => {
    const out = markdownToHtml("[the shop](https://example.com)");
    expect(out.match(/<a /g)).toHaveLength(1);
  });

  it("does not autolink a URL inside inline code", () => {
    const out = markdownToHtml("run `curl https://example.com`");
    expect(out).not.toContain("<a ");
    expect(out).toContain("https://example.com");
  });

  // @code-reviewer finding (2026-10-20): the first version of this regex had
  // no boundary awareness and swallowed a trailing emphasis marker straight
  // into the href, losing the bold/italic entirely — a regression from
  // master, where this rendered as bold text (just not a link, pre-N2).
  it("re-applies bold around a bare URL wrapped in **", () => {
    const out = markdownToHtml("**https://example.com**");
    expect(out).toContain('<strong style="');
    expect(out).toContain('<a href="https://example.com"');
    expect(out).toMatch(/<a [^>]*>https:\/\/example\.com<\/a><\/strong>/);
  });

  it("re-applies italic around a bare URL wrapped in _", () => {
    const out = markdownToHtml("_https://example.com_");
    expect(out).toContain("<em>");
    expect(out).toContain('<a href="https://example.com"');
    expect(out).toMatch(/<a [^>]*>https:\/\/example\.com<\/a><\/em>/);
  });

  it("does not swallow an unbalanced closing ) from the surrounding prose", () => {
    const out = markdownToHtml("(see https://example.com)");
    expect(out).toContain('href="https://example.com"');
    expect(out).toMatch(/<\/a>\)<\/p>/);
  });

  it("keeps a balanced parenthetical that's part of the URL itself", () => {
    const out = markdownToHtml(
      "https://en.wikipedia.org/wiki/Foo_(bar) is the page",
    );
    expect(out).toContain('href="https://en.wikipedia.org/wiki/Foo_(bar)"');
  });

  // @code-reviewer finding: escapeHtml runs before this regex, so a literal
  // "<...>"/'"..."' around a URL in the source is already "&lt;...&gt;"/
  // "&quot;...&quot;" by the time this regex sees it — without a boundary
  // check, the greedy match swallowed the closing entity straight into the
  // href and left a corrupted, dangling fragment of it behind.
  it("stops the match before a trailing &gt;/&quot; entity instead of swallowing it", () => {
    const angle = markdownToHtml("<https://example.com>");
    expect(angle).toContain('href="https://example.com"');
    expect(angle).not.toContain("&gt\"");
    expect(angle).toMatch(/<\/a>&gt;<\/p>/);

    const quoted = markdownToHtml('"https://example.com"');
    expect(quoted).toContain('href="https://example.com"');
    expect(quoted).toMatch(/<\/a>&quot;<\/p>/);
  });

  // @code-reviewer finding: a URL sitting directly against an
  // already-stashed escaped character nested this pass's stash entry inside
  // that earlier one — the single, non-recursive final restore pass could
  // never reach the inner reference, leaking a raw placeholder character
  // into the output.
  it("does not corrupt the href when a bare URL sits directly against an escaped character", () => {
    const out = markdownToHtml("https://example.com\\*");
    expect(out).toContain('href="https://example.com"');
    expect(out).toMatch(/<\/a>\*<\/p>/);
  });
});

describe("markdownToHtml — rejects dangerous URL schemes (@code-reviewer finding)", () => {
  // escapeHtml alone cannot stop this: a "javascript:" scheme survives
  // escaping unchanged (it has no &, <, >, ", or ' in it), and the browser
  // runs it on click regardless of how the rest of the href is escaped.
  it("does not turn a javascript: link into a clickable <a>", () => {
    const out = markdownToHtml("[click me](javascript:alert(1))");
    expect(out).not.toContain("<a ");
    expect(out).toContain("[click me](javascript:alert(1))");
  });

  it("does not turn a javascript: image source into an <img>", () => {
    const out = markdownToHtml("![x](javascript:alert(1))");
    expect(out).not.toContain("<img ");
  });

  it("still allows http(s), mailto, tel, and relative links", () => {
    expect(markdownToHtml("[a](https://x.test)")).toContain("<a ");
    expect(markdownToHtml("[a](mailto:shop@x.test)")).toContain("<a ");
    expect(markdownToHtml("[a](tel:+3112345678)")).toContain("<a ");
    expect(markdownToHtml("[a](/admin/catalog)")).toContain("<a ");
  });
});

describe("markdownToHtml — line breaks within a paragraph (N5/N2)", () => {
  it("renders a <br> between two lines with no blank line between them", () => {
    const out = markdownToHtml("Line one\nLine two");
    expect(out.match(/<p /g)).toHaveLength(1);
    expect(out).toMatch(/Line one<br>\s*Line two/);
  });

  it("produces the identical result whether or not the source used legacy trailing double-space hard breaks", () => {
    const withTrailingSpaces = markdownToHtml("Line one  \nLine two");
    const withoutTrailingSpaces = markdownToHtml("Line one\nLine two");
    expect(withTrailingSpaces).toBe(withoutTrailingSpaces);
  });

  // @code-reviewer finding: an image/link split across a hard line break (no
  // blank line between the two lines) used to swallow the line-break marker
  // into its alt/label text, then have the marker→<br> swap corrupt the
  // attribute it was already sitting inside. Rather than try to repair a
  // corrupted tag, the image/link regexes simply don't match across a line
  // break at all now — this renders as plain text (still correctly broken
  // onto two lines), never a broken <img>/<a>.
  it("does not build a corrupted <img> when image syntax spans a hard line break", () => {
    const out = markdownToHtml("![a\nb](https://x.test/img.png)");
    expect(out).not.toContain("<img");
    expect(out).not.toContain('alt="');
    expect(out).toMatch(/!\[a<br>\s*b\]/);
  });
});

describe("renderConfirmEmail", () => {
  const html = renderConfirmEmail({
    confirmUrl: "https://antenne.test/api/newsletter/confirm?token=xyz",
  });

  it("includes the confirmation link", () => {
    expect(html).toContain(
      "https://antenne.test/api/newsletter/confirm?token=xyz",
    );
    expect(html.toLowerCase()).toContain("confirm");
  });
});

describe("renderStructuredNewsletterEmail", () => {
  const GROUPS = [
    {
      genre: "Techno",
      items: [
        {
          artist: "Jeff Mills",
          label: "SMEJ Associated Records",
          catalogNumber: "AICT 43",
          restock: false,
        },
        {
          artist: "Vril",
          label: "Zulema Records",
          catalogNumber: "ZR-001",
          restock: true,
        },
      ],
    },
  ];

  const email = () =>
    renderStructuredNewsletterEmail({
      subject: "July arrivals",
      header: "Hello **crate diggers**",
      arrivals: GROUPS,
      footer: "See you _soon_ at the shop.",
      unsubscribeUrl: "https://example.com/u?token=t1",
    });

  it("renders header and footer markdown", () => {
    const html = email();
    expect(html).toContain("<strong");
    expect(html).toContain("crate diggers");
    expect(html).toContain("<em>soon</em>");
  });

  it("renders the grouped arrivals block — lowercase genre, indent, restock star", () => {
    const html = email();
    expect(html).toContain("techno");
    expect(html).toContain("  JEFF MILLS [SMEJ Associated Records AICT 43]");
    expect(html).toContain("  VRIL [Zulema Records ZR-001] *");
  });

  // Bug fix (2026-07-20): social links used to be auto-appended after the
  // header, which duplicated them for shop owners who already type their
  // social links into the header template themselves.
  it("does not automatically append a social links block", () => {
    const html = email();
    expect(html).not.toContain("https://www.facebook.com/antennerecordshop/");
    expect(html).not.toContain("https://www.instagram.com/antenne.recordshop/");
    expect(html).not.toContain("https://soundcloud.com/antennerecordshoptilburg");
  });

  it("does not duplicate a social link the header already includes", () => {
    const html = renderStructuredNewsletterEmail({
      subject: "July arrivals",
      header: "Hi! Find us at https://www.facebook.com/antennerecordshop/",
      arrivals: GROUPS,
      footer: "See you _soon_ at the shop.",
      unsubscribeUrl: "https://example.com/u?token=t1",
    });
    // N2 autolinks the bare URL, so it legitimately appears twice in the
    // output (once in href, once as the link text) — count <a> elements,
    // not raw substring occurrences, to assert "not a second, separately
    // appended social-links block" without being thrown off by that.
    const occurrences = html.split(
      '<a href="https://www.facebook.com/antennerecordshop/"',
    ).length - 1;
    expect(occurrences).toBe(1);
  });

  it("uses the same font size for body paragraphs and the arrivals pre block", () => {
    const html = email();
    const pStyle = /<p style="([^"]*)">Hello/.exec(html)?.[1];
    const preStyle = /<pre style="([^"]*)">/.exec(html)?.[1];
    expect(pStyle).toBeDefined();
    expect(preStyle).toBeDefined();
    expect(pStyle).toContain("font-size:16px");
    expect(preStyle).toContain("font-size:16px");
  });

  // N1: the single-line "·"-joined footer wrapped awkwardly. footerAddressHtml
  // now stacks each component on its own line instead — this asserts the
  // stack, not just that the text is present somewhere (that's the next test).
  it("stacks each footer address component on its own line, not joined by ·", () => {
    const html = footerAddressHtml();
    expect(html).not.toContain("·");
    expect(html.match(/<p /g)).toHaveLength(4);
    expect(html).toContain("Antenne Recordshop");
    expect(html).toContain("Noordstraat 82, 5038 EK Tilburg");
    expect(html).toContain("Inside Sam-Sam vintage clothing store");
    expect(html).toContain('href="tel:+31135421708"');
  });

  it("ends with the contact block and the personalised unsubscribe link", () => {
    const html = email();
    expect(html).toContain("Antenne Recordshop");
    expect(html).toContain("Noordstraat 82, 5038 EK Tilburg");
    expect(html).toContain("+31 13 542 1708");
    expect(html).toContain("https://example.com/u?token=t1");
  });

  it("says so when there are no arrivals in the range", () => {
    const html = renderStructuredNewsletterEmail({
      subject: "s",
      header: "h",
      arrivals: [],
      footer: "f",
      unsubscribeUrl: "https://example.com/u",
    });
    expect(html).toMatch(/no new arrivals/i);
  });

  it("escapes HTML in arrivals data (artist names are attacker-adjacent input)", () => {
    const html = renderStructuredNewsletterEmail({
      subject: "s",
      header: "h",
      arrivals: [
        {
          genre: "Techno",
          items: [
            {
              artist: "<script>x</script>",
              label: "L",
              catalogNumber: null,
              restock: false,
            },
          ],
        },
      ],
      footer: "f",
      unsubscribeUrl: "https://example.com/u",
    });
    expect(html).not.toContain("<script>");
  });
});

describe("property", () => {
  it("markdownToHtml never throws for any string input", () => {
    fc.assert(
      fc.property(fc.string(), (input) => {
        expect(() => markdownToHtml(input)).not.toThrow();
      }),
    );
  });

  it("markdownToHtml returns a non-empty string for any non-blank input", () => {
    // Not literally "any string" — blank/whitespace-only input legitimately
    // produces "" (the block-parsing loop skips blank lines and pushes
    // nothing), confirmed by tracing lib/email/render.ts's main loop.
    fc.assert(
      fc.property(
        fc.string().filter((s) => s.trim() !== ""),
        (input) => {
          expect(markdownToHtml(input).length).toBeGreaterThan(0);
        },
      ),
    );
  });

  it("an escaped \\*, \\_, or \\\\ always appears as its literal character in the output", () => {
    // Surrounding text is restricted to plain letters/digits/spaces — any
    // markdown-significant character (\, *, _, but also ` # - > [ ] and
    // newlines) can shift block classification or merge with the escaped
    // token's own backslash and swallow the "real" escaped character.
    // fast-check found two such interactions while this test was written:
    // a bare "\" prefix merging with "\*"'s leading backslash, and a "```"
    // prefix turning the whole line into an (unclosed) code-fence opener
    // that discards everything after it. A positive, markdown-inert
    // character set rules out this whole class rather than excluding
    // symbols one discovery at a time.
    const safeChar = fc.constantFrom(
      ..."abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789 ",
    );
    const safeText = fc.string({ unit: safeChar });
    fc.assert(
      fc.property(
        safeText,
        fc.constantFrom("\\*", "\\_", "\\\\"),
        safeText,
        (prefix, escaped, suffix) => {
          const literal = escaped[1];
          const out = markdownToHtml(`${prefix}${escaped}${suffix}`);
          expect(out).toContain(literal);
        },
      ),
    );
  });
});
