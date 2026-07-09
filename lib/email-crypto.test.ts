import { afterEach, describe, it, expect, vi } from "vitest";

import { decryptEmail, emailHash, encryptEmail } from "@/lib/email-crypto";

// A valid 32-byte key as 64 hex chars (test-only value).
const KEY = "a".repeat(64);
const OTHER_KEY = "b".repeat(64);

function withKey(key: string | undefined) {
  if (key === undefined) {
    vi.stubEnv("EMAIL_ENCRYPTION_KEY", "");
  } else {
    vi.stubEnv("EMAIL_ENCRYPTION_KEY", key);
  }
}

afterEach(() => {
  vi.unstubAllEnvs();
});

describe("encryptEmail / decryptEmail", () => {
  it("round-trips an email address", () => {
    withKey(KEY);
    const stored = encryptEmail("fan@example.com");
    expect(decryptEmail(stored)).toBe("fan@example.com");
  });

  it("produces versioned ciphertext, not plaintext", () => {
    withKey(KEY);
    const stored = encryptEmail("fan@example.com");
    expect(stored.startsWith("v1:")).toBe(true);
    expect(stored).not.toContain("fan@example.com");
  });

  it("uses a fresh IV per call (same input → different ciphertext)", () => {
    withKey(KEY);
    expect(encryptEmail("fan@example.com")).not.toBe(
      encryptEmail("fan@example.com"),
    );
  });

  it("rejects tampered ciphertext (GCM auth)", () => {
    withKey(KEY);
    const stored = encryptEmail("fan@example.com");
    const parts = stored.split(":");
    // Flip the first character of the ciphertext segment.
    parts[2] = (parts[2][0] === "A" ? "B" : "A") + parts[2].slice(1);
    expect(() => decryptEmail(parts.join(":"))).toThrow();
  });

  it("rejects decryption with a different key", () => {
    withKey(KEY);
    const stored = encryptEmail("fan@example.com");
    withKey(OTHER_KEY);
    expect(() => decryptEmail(stored)).toThrow();
  });

  it("returns legacy (unprefixed) values as-is so unmigrated rows keep working", () => {
    withKey(KEY);
    expect(decryptEmail("legacy@example.com")).toBe("legacy@example.com");
  });

  it("throws a clear error when EMAIL_ENCRYPTION_KEY is missing", () => {
    withKey(undefined);
    expect(() => encryptEmail("fan@example.com")).toThrow(
      /EMAIL_ENCRYPTION_KEY/,
    );
  });

  it("throws a clear error when the key is not 64 hex chars", () => {
    withKey("too-short");
    expect(() => encryptEmail("fan@example.com")).toThrow(
      /EMAIL_ENCRYPTION_KEY/,
    );
  });
});

describe("emailHash", () => {
  it("is deterministic for the same email", () => {
    withKey(KEY);
    expect(emailHash("fan@example.com")).toBe(emailHash("fan@example.com"));
  });

  it("normalizes case and surrounding whitespace", () => {
    withKey(KEY);
    expect(emailHash("  Fan@Example.COM ")).toBe(emailHash("fan@example.com"));
  });

  it("differs for different emails", () => {
    withKey(KEY);
    expect(emailHash("a@example.com")).not.toBe(emailHash("b@example.com"));
  });

  it("is keyed (HMAC): a different key yields a different hash", () => {
    withKey(KEY);
    const first = emailHash("fan@example.com");
    withKey(OTHER_KEY);
    expect(emailHash("fan@example.com")).not.toBe(first);
  });

  it("returns lowercase hex", () => {
    withKey(KEY);
    expect(emailHash("fan@example.com")).toMatch(/^[0-9a-f]{64}$/);
  });
});
