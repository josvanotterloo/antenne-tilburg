// @vitest-environment node
import { describe, it, expect } from "vitest";

import { parseNewsletterInput } from "@/lib/newsletter-input";

describe("parseNewsletterInput", () => {
  it("accepts a name and email, trimming and lowercasing the email", () => {
    const r = parseNewsletterInput({ name: "  Jos  ", email: "  JOS@X.COM " });
    expect(r).toEqual({ ok: true, data: { name: "Jos", email: "jos@x.com" } });
  });

  it("rejects a missing name", () => {
    const r = parseNewsletterInput({ name: "   ", email: "a@b.co" });
    expect(r.ok).toBe(false);
  });

  it("rejects an invalid email", () => {
    expect(parseNewsletterInput({ name: "Jos", email: "not-an-email" }).ok).toBe(
      false,
    );
    expect(parseNewsletterInput({ name: "Jos", email: "" }).ok).toBe(false);
  });

  it("rejects a null / non-object body", () => {
    expect(parseNewsletterInput(null).ok).toBe(false);
  });

  it("rejects an overly long name", () => {
    const r = parseNewsletterInput({ name: "x".repeat(200), email: "a@b.co" });
    expect(r.ok).toBe(false);
  });
});
