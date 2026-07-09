import { requireAdmin } from "@/lib/api-auth";
import { db } from "@/lib/db";
import { decryptEmailSafe } from "@/lib/email-crypto";
import { toCsv } from "@/lib/csv";

export const dynamic = "force-dynamic";

// CSV export of all newsletter subscribers.
export async function GET() {
  const denied = await requireAdmin();
  if (denied) return denied;

  // Export the real mailing list: confirmed (opted-in) subscribers only.
  const subscribers = await db.newsletterSubscriber.findMany({
    where: { status: "CONFIRMED" },
    orderBy: { createdAt: "desc" },
  });

  const rows = subscribers.map((s) => ({
    name: s.name,
    // Stored encrypted; the export is the shop's working mailing list. An
    // undecryptable row (rotated/wrong key) is marked, not fatal to the file.
    email: decryptEmailSafe(s.email) ?? "(cannot decrypt)",
    createdAt: s.createdAt.toISOString(),
  }));
  const csv = toCsv(rows, [
    { key: "name", header: "Name" },
    { key: "email", header: "Email" },
    { key: "createdAt", header: "Signed up" },
  ]);

  return new Response(csv, {
    headers: {
      "content-type": "text/csv; charset=utf-8",
      "content-disposition": 'attachment; filename="subscribers.csv"',
    },
  });
}
