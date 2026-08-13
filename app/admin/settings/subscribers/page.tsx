import { db } from "@/lib/db";
import { decryptEmailSafe } from "@/lib/email-crypto";
import { DeleteButton } from "@/components/admin/DeleteButton";
import { RetryPendingButton } from "@/components/admin/RetryPendingButton";

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
  const hasUnsentPending = subscribers.some(
    (s) => s.status === "PENDING" && s.confirmEmailSentAt === null,
  );

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Subscribers</h1>
          <p className="text-sm text-admin-ink-muted">
            {confirmedCount} confirmed subscriber
            {confirmedCount === 1 ? "" : "s"}
          </p>
        </div>
        <div className="flex items-start gap-2">
          {hasUnsentPending && <RetryPendingButton />}
          {subscribers.length > 0 && (
            // Not a page: this is a file-download API route, so a real <a>
            // (with download) is correct — <Link> would client-navigate instead.
            <a
              href="/api/admin/subscribers/export"
              download
              className="rounded border border-admin-hairline px-3 py-2 text-sm hover:bg-admin-raised"
            >
              Export CSV
            </a>
          )}
        </div>
      </div>

      {subscribers.length === 0 ? (
        <p className="rounded border border-dashed border-admin-hairline p-8 text-center text-admin-ink-muted">
          No subscribers yet.
        </p>
      ) : (
        <div className="overflow-x-auto rounded border border-admin-hairline bg-admin-surface">
          <table className="w-full text-left text-sm">
            <thead className="border-b border-admin-hairline bg-admin-bg text-admin-ink-muted">
              <tr>
                <th className="px-3 py-2 font-medium">Name</th>
                <th className="px-3 py-2 font-medium">Email</th>
                <th className="px-3 py-2 font-medium">Status</th>
                <th className="px-3 py-2 font-medium">Signed up</th>
                <th className="px-3 py-2 text-right font-medium">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-admin-hairline">
              {subscribers.map((s) => (
                <tr key={s.id}>
                  <td className="px-3 py-2">{s.name}</td>
                  {/* Stored encrypted; decrypted here for the shop owner only.
                      A row from a rotated/wrong key degrades, not the page. */}
                  <td className="px-3 py-2">
                    {decryptEmailSafe(s.email) ?? (
                      <span className="text-red-400">(cannot decrypt)</span>
                    )}
                  </td>
                  <td className="px-3 py-2">
                    <StatusBadge
                      status={s.status}
                      confirmEmailSentAt={s.confirmEmailSentAt}
                    />
                  </td>
                  <td className="px-3 py-2 text-admin-ink-muted">
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

function StatusBadge({
  status,
  confirmEmailSentAt,
}: {
  status: "PENDING" | "CONFIRMED";
  confirmEmailSentAt: Date | null;
}) {
  if (status === "CONFIRMED") {
    return (
      <span className="inline-block rounded-full bg-green-500/15 px-2 py-0.5 text-xs font-medium text-green-400">
        Confirmed
      </span>
    );
  }
  // PENDING with no email ever sent needs the admin's retry queue, not just
  // patience — a stronger color distinguishes it from an ordinary pending
  // row that's just waiting on the subscriber to click the link.
  if (confirmEmailSentAt === null) {
    return (
      <span className="inline-block rounded-full bg-red-500/15 px-2 py-0.5 text-xs font-medium text-red-400">
        Pending (no email sent)
      </span>
    );
  }
  return (
    <span className="inline-block rounded-full bg-amber-500/15 px-2 py-0.5 text-xs font-medium text-amber-400">
      Pending
    </span>
  );
}
