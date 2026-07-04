// @vitest-environment node
import { describe, it, expect } from "vitest";

import { parseEmailChange, parsePasswordChange } from "@/lib/user-input";

describe("parseEmailChange", () => {
  it("accepts and normalizes a valid email", () => {
    const r = parseEmailChange({ email: "  Shop@Antenne-Tilburg.NL " });
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.data.email).toBe("shop@antenne-tilburg.nl");
  });

  it.each([["missing", {}], ["blank", { email: "  " }], ["invalid", { email: "nope" }]])(
    "rejects %s email",
    (_f, body) => {
      expect(parseEmailChange(body).ok).toBe(false);
    },
  );
});

describe("parsePasswordChange", () => {
  it("accepts a current + sufficiently long new password (untrimmed)", () => {
    const r = parsePasswordChange({
      currentPassword: "changeme123",
      newPassword: "  spaces ok  ",
    });
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.data.currentPassword).toBe("changeme123");
    expect(r.data.newPassword).toBe("  spaces ok  "); // not trimmed
  });

  it("rejects a missing current password", () => {
    expect(parsePasswordChange({ newPassword: "longenough1" }).ok).toBe(false);
  });

  it("rejects a new password shorter than 8", () => {
    expect(
      parsePasswordChange({ currentPassword: "x", newPassword: "short" }).ok,
    ).toBe(false);
  });
});
