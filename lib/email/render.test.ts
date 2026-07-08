// @vitest-environment node
import { describe, it, expect } from "vitest";

import { renderNewsletterEmail } from "@/lib/email/render";
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
