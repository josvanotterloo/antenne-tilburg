import { db } from "@/lib/db";
import { decryptEmailSafe } from "@/lib/email-crypto";
import { DeleteButton } from "@/components/admin/DeleteButton";

export const dynamic = "force-dynamic";

export default async function AdminSubscribersPage() {
  const subscribers = await db.newsletterSubscriber.findMany({
    orderBy: { createdAt: "desc" },
  });
  // Pending (unconfirmed) subscribers are still listed, but the headline count
  // reflects only those who confirmed — they are who a send actually reaches.
  const confirmedCount = subscribers.filter(
    (s) => s.status === "CONFIRMED",
  ).length;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Subscribers</h1>
          <p className="text-sm text-neutral-500">
            {confirmedCount} confirmed subscriber
            {confirmedCount === 1 ? "" : "s"}
          </p>
        </div>
        {subscribers.length > 0 && (
          // Not a page: this is a file-download API route, so a real <a>
          // (with download) is correct — <Link> would client-navigate instead.
          <a
            href="/api/admin/subscribers/export"
            download
            className="rounded border border-neutral-300 px-3 py-2 text-sm hover:bg-neutral-100"
          >
            Export CSV
          </a>
        )}
      </div>

      {subscribers.length === 0 ? (
        <p className="rounded border border-dashed border-neutral-300 p-8 text-center text-neutral-500">
          No subscribers yet.
        </p>
      ) : (
        <div className="overflow-x-auto rounded border border-neutral-200 bg-white">
          <table className="w-full text-left text-sm">
            <thead className="border-b border-neutral-200 bg-neutral-50 text-neutral-500">
              <tr>
                <th className="px-3 py-2 font-medium">Name</th>
                <th className="px-3 py-2 font-medium">Email</th>
                <th className="px-3 py-2 font-medium">Status</th>
                <th className="px-3 py-2 font-medium">Signed up</th>
                <th className="px-3 py-2 text-right font-medium">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-neutral-100">
              {subscribers.map((s) => (
                <tr key={s.id}>
                  <td className="px-3 py-2">{s.name}</td>
                  {/* Stored encrypted; decrypted here for the shop owner only.
                      A row from a rotated/wrong key degrades, not the page. */}
                  <td className="px-3 py-2">
                    {decryptEmailSafe(s.email) ?? (
                      <span className="text-red-600">(cannot decrypt)</span>
                    )}
                  </td>
                  <td className="px-3 py-2">
                    <StatusBadge status={s.status} />
                  </td>
                  <td className="px-3 py-2 text-neutral-500">
                    {new Date(s.createdAt).toLocaleDateString()}
                  </td>
                  <td className="px-3 py-2 text-right">
                    <DeleteButton
                      endpoint={`/api/admin/subscribers/${s.id}`}
                      label="Remove"
                    />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

function StatusBadge({ status }: { status: "PENDING" | "CONFIRMED" }) {
  const confirmed = status === "CONFIRMED";
  return (
    <span
      className={`inline-block rounded-full px-2 py-0.5 text-xs font-medium ${
        confirmed ? "bg-green-100 text-green-800" : "bg-amber-100 text-amber-800"
      }`}
    >
      {confirmed ? "Confirmed" : "Pending"}
    </span>
  );
}
