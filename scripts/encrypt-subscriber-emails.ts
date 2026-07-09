// One-time migration: encrypt legacy plaintext subscriber emails at rest.
//
//   EMAIL_ENCRYPTION_KEY must be set (64 hex chars — openssl rand -hex 32) and
//   must be the same key the app runs with, or decryption will fail later.
//
//   Run:  npx tsx scripts/encrypt-subscriber-emails.ts
//
// Idempotent: already-encrypted rows are skipped, so re-running is safe.
// Conflicted rows (normalized-hash duplicates) are reported by id and left
// unmigrated for manual resolution.
import { PrismaClient } from "@prisma/client";

import { encryptLegacySubscribers } from "../lib/encrypt-legacy-subscribers";

const prisma = new PrismaClient();

async function main() {
  const result = await encryptLegacySubscribers({
    findMany: () =>
      prisma.newsletterSubscriber.findMany({
        select: { id: true, email: true },
      }),
    update: (args) => prisma.newsletterSubscriber.update(args),
  });

  console.log(
    `Done: ${result.migrated} migrated, ${result.skipped} already encrypted.`,
  );
  if (result.conflicts.length > 0) {
    console.warn(
      `${result.conflicts.length} row(s) skipped due to duplicate-hash conflicts ` +
        `(case-variant duplicates?) — resolve manually: ${result.conflicts.join(", ")}`,
    );
    process.exitCode = 1;
  }
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
