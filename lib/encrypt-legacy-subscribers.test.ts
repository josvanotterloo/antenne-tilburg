// @vitest-environment node
import { afterEach, beforeEach, describe, it, expect, vi } from "vitest";

import { encryptLegacySubscribers } from "@/lib/encrypt-legacy-subscribers";
import { decryptEmail, emailHash, encryptEmail } from "@/lib/email-crypto";

const KEY = "a1".repeat(32);

type Row = { id: string; email: string; emailHash: string | null };

function fakeDelegate(rows: Row[]) {
  return {
    rows,
    findMany: vi.fn(async () => rows.map((r) => ({ ...r }))),
    update: vi.fn(
      async ({
        where,
        data,
      }: {
        where: { id: string };
        data: { email: string; emailHash: string };
      }) => {
        // Mirror the real unique constraint on emailHash.
        if (rows.some((r) => r.id !== where.id && r.emailHash === data.emailHash)) {
          throw Object.assign(new Error("dup"), { code: "P2002" });
        }
        const row = rows.find((r) => r.id === where.id)!;
        row.email = data.email;
        row.emailHash = data.emailHash;
        return row;
      },
    ),
  };
}

beforeEach(() => vi.stubEnv("EMAIL_ENCRYPTION_KEY", KEY));
afterEach(() => vi.unstubAllEnvs());

describe("encryptLegacySubscribers", () => {
  it("encrypts legacy plaintext rows and backfills the hash", async () => {
    const delegate = fakeDelegate([
      { id: "s1", email: "ada@x.com", emailHash: null },
    ]);
    const result = await encryptLegacySubscribers(delegate);

    expect(result).toEqual({ migrated: 1, skipped: 0, conflicts: [] });
    expect(delegate.rows[0].email).toMatch(/^v1:/);
    expect(decryptEmail(delegate.rows[0].email)).toBe("ada@x.com");
    expect(delegate.rows[0].emailHash).toBe(emailHash("ada@x.com"));
  });

  it("skips rows that are already encrypted (idempotent re-run)", async () => {
    const delegate = fakeDelegate([
      { id: "s1", email: encryptEmail("ada@x.com"), emailHash: emailHash("ada@x.com") },
      { id: "s2", email: "bo@x.com", emailHash: null },
    ]);
    const first = await encryptLegacySubscribers(delegate);
    expect(first).toEqual({ migrated: 1, skipped: 1, conflicts: [] });

    const second = await encryptLegacySubscribers(delegate);
    expect(second).toEqual({ migrated: 0, skipped: 2, conflicts: [] });
  });

  it("encrypts a plaintext address that merely starts with v1: (not fooled by the prefix)", async () => {
    const delegate = fakeDelegate([
      { id: "s1", email: "v1:tricky@x.com", emailHash: null },
    ]);
    const result = await encryptLegacySubscribers(delegate);

    expect(result.migrated).toBe(1);
    expect(decryptEmail(delegate.rows[0].email)).toBe("v1:tricky@x.com");
  });

  it("reports a hash conflict (case-variant duplicates) without failing the run", async () => {
    // Legacy uniqueness was case-sensitive; the keyed hash is normalized, so two
    // case-variant rows collide. The second becomes a conflict to resolve by hand.
    const delegate = fakeDelegate([
      { id: "s1", email: "ada@x.com", emailHash: null },
      { id: "s2", email: "ADA@x.com", emailHash: null },
      { id: "s3", email: "bo@x.com", emailHash: null },
    ]);
    const result = await encryptLegacySubscribers(delegate);

    expect(result.migrated).toBe(2);
    expect(result.conflicts).toEqual(["s2"]);
    // The conflicting row is left untouched (still legacy plaintext).
    expect(delegate.rows[1].email).toBe("ADA@x.com");
  });
});
