import { describe, it, expect } from "vitest";

import { parseNewsletterSendInput } from "@/lib/newsletter-send-input";

describe("parseNewsletterSendInput", () => {
  it("accepts and trims a valid subject + body", () => {
    const result = parseNewsletterSendInput({
      subject: "  New arrivals  ",
      body: "  Fresh wax  ",
    });
    expect(result).toEqual({
      ok: true,
      data: { subject: "New arrivals", body: "Fresh wax" },
    });
  });

  it("rejects a blank subject", () => {
    expect(parseNewsletterSendInput({ subject: "  ", body: "x" }).ok).toBe(false);
  });

  it("rejects a subject longer than 150 chars", () => {
    const result = parseNewsletterSendInput({
      subject: "a".repeat(151),
      body: "x",
    });
    expect(result.ok).toBe(false);
  });

  it("rejects a blank body", () => {
    expect(parseNewsletterSendInput({ subject: "Hi", body: "   " }).ok).toBe(false);
  });
});
