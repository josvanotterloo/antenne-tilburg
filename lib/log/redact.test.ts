import { describe, it, expect } from "vitest";

import { redactFreeText, redactKnownPatterns } from "@/lib/log/redact";

describe("redactFreeText", () => {
  it("returns only the length of the input, never its content", () => {
    expect(redactFreeText("vril torus")).toEqual({ length: 10 });
  });

  it("returns a length of 0 for an empty string", () => {
    expect(redactFreeText("")).toEqual({ length: 0 });
  });

  it("counts a string containing an email or phone number by length too", () => {
    expect(redactFreeText("contact me at jos@example.com")).toEqual({ length: 29 });
  });
});

describe("redactKnownPatterns", () => {
  it("strips an email-shaped substring", () => {
    expect(redactKnownPatterns("reach jos@example.com for details")).toBe(
      "reach [redacted-email] for details",
    );
  });

  it("strips a phone-shaped substring", () => {
    expect(redactKnownPatterns("call +31 6 1234 5678 now")).toBe("call [redacted-phone] now");
  });

  it("strips both an email and a phone number in the same string", () => {
    expect(redactKnownPatterns("jos@example.com or +31 6 1234 5678")).toBe(
      "[redacted-email] or [redacted-phone]",
    );
  });

  it("leaves text with no email or phone number untouched", () => {
    expect(redactKnownPatterns("bad credentials")).toBe("bad credentials");
  });

  it("returns an empty string unchanged", () => {
    expect(redactKnownPatterns("")).toBe("");
  });
});
