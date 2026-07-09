import { emailHash, encryptEmail, isEncrypted } from "@/lib/email-crypto";

// One-time backfill core for the email-encryption-at-rest migration: encrypt
// every legacy plaintext subscriber row and fill its hash column. Pure over an
// injected delegate so it is unit-testable; the runnable wrapper is
// scripts/encrypt-subscriber-emails.ts. Idempotent — encrypted rows (v1: prefix)
// are skipped, so re-running after a partial failure is safe.

export interface LegacySubscriberDelegate {
  findMany(): Promise<{ id: string; email: string }[]>;
  update(args: {
    where: { id: string };
    data: { email: string; emailHash: string };
  }): Promise<unknown>;
}

export interface MigrationResult {
  migrated: number;
  skipped: number;
  /** Row ids left unmigrated because their normalized hash collided with an
   * existing row (e.g. case-variant duplicates from the plaintext era). */
  conflicts: string[];
}

export async function encryptLegacySubscribers(
  delegate: LegacySubscriberDelegate,
): Promise<MigrationResult> {
  const rows = await delegate.findMany();
  const result: MigrationResult = { migrated: 0, skipped: 0, conflicts: [] };

  for (const row of rows) {
    // Strict format check (shared with decryptEmail) — a plaintext address
    // that merely starts with "v1:" is still encrypted, not skipped.
    if (isEncrypted(row.email)) {
      result.skipped += 1;
      continue;
    }
    try {
      await delegate.update({
        where: { id: row.id },
        data: {
          email: encryptEmail(row.email),
          emailHash: emailHash(row.email),
        },
      });
      result.migrated += 1;
    } catch (error) {
      if ((error as { code?: string } | null)?.code === "P2002") {
        // Hash collision with an already-migrated row: leave this one legacy
        // (plaintext) and report it for manual resolution — ids only, no PII.
        result.conflicts.push(row.id);
        continue;
      }
      throw error;
    }
  }

  return result;
}
