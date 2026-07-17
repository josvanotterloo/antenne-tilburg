import { describe, it, expect } from "vitest";

import { parseNewsletterSendInput } from "@/lib/newsletter-send-input";

// Contract migrated deliberately (structured newsletter, 2026-07-17): the
// send body is now { subject, header, footer, from, to } — header/footer
// markdown plus an arrivals date range — instead of a single markdown body.
const VALID = {
  subject: "New arrivals",
  header: "Hello",
  footer: "Bye",
  from: "2026-07-13",
  to: "2026-07-17",
};

describe("parseNewsletterSendInput", () => {
  it("accepts and trims valid structured input", () => {
    const result = parseNewsletterSendInput({
      ...VALID,
      subject: "  New arrivals  ",
      header: "  Hello  ",
    });
    expect(result).toEqual({
      ok: true,
      data: {
        subject: "New arrivals",
        header: "Hello",
        footer: "Bye",
        from: "2026-07-13",
        to: "2026-07-17",
      },
    });
  });

  it("allows empty header and footer (template may be unset)", () => {
    const result = parseNewsletterSendInput({
      ...VALID,
      header: "",
      footer: "  ",
    });
    expect(result.ok && result.data.header).toBe("");
    expect(result.ok && result.data.footer).toBe("");
  });

  it("rejects a blank subject", () => {
    expect(parseNewsletterSendInput({ ...VALID, subject: "  " }).ok).toBe(false);
  });

  it("rejects a subject longer than 150 chars", () => {
    expect(
      parseNewsletterSendInput({ ...VALID, subject: "a".repeat(151) }).ok,
    ).toBe(false);
  });

  it.each([
    ["missing from", { ...VALID, from: undefined }],
    ["malformed from", { ...VALID, from: "13-07-2026" }],
    ["missing to", { ...VALID, to: "" }],
    ["malformed to", { ...VALID, to: "2026-7-1" }],
  ])("rejects %s", (_label, body) => {
    expect(parseNewsletterSendInput(body).ok).toBe(false);
  });
});
