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

  it("renders the markdown body (bold + inline code) as HTML", () => {
    expect(html).toContain("<strong");
    expect(html).toContain("wax");
    expect(html).toContain("TR-909");
  });

  it("applies the accent colour", () => {
    expect(html.toLowerCase()).toContain("#6b7dc9");
  });

  it("emits a well-formed font-family (fonts single-quoted, not breaking the style attr)", () => {
    // Double-quoted font names inside a double-quoted style="" attribute would
    // terminate the attribute early and drop the font-family (→ serif fallback).
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
