import { requireAdmin } from "@/lib/api-auth";
import { db } from "@/lib/db";
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
    email: s.email,
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
