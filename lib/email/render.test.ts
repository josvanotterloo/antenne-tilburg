// @vitest-environment node
import { describe, it, expect } from "vitest";

import {
  markdownToHtml,
  renderNewsletterEmail,
  renderStructuredNewsletterEmail,
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
    const occurrences = html.split(
      "https://www.facebook.com/antennerecordshop/",
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
