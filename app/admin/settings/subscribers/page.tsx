import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { decryptEmailSafe } from "@/lib/email-crypto";
import { t, tCount } from "@/lib/i18n/t";
import { subscriberStatusLabel } from "@/lib/i18n/enum-labels";
import { DeleteButton } from "@/components/admin/DeleteButton";
import { RetryPendingButton } from "@/components/admin/RetryPendingButton";
import { isRetryEligible } from "@/lib/newsletter-confirm-window";
import type { AdminLocale } from "@prisma/client";

export const dynamic = "force-dynamic";

export default async function AdminSubscribersPage() {
  const session = await auth();
  const locale = session!.user.locale;
  const subscribers = await db.newsletterSubscriber.findMany({
    orderBy: { createdAt: "desc" },
  });
  // Pending (unconfirmed) subscribers are still listed, but the headline count
  // reflects only those who confirmed — they are who a send actually reaches.
  const confirmedCount = subscribers.filter(
    (s) => s.status === "CONFIRMED",
  ).length;
  // Only offer the button when it can actually do something: the retry
  // endpoint itself skips rows past the confirm window, so a row past it
  // would silently do nothing and confuse whoever clicked retry.
  const hasUnsentPending = subscribers.some(isRetryEligible);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">{t("subscribers.title", locale)}</h1>
          <p className="text-sm text-admin-ink-muted">
            {confirmedCount}{" "}
            {tCount(
              confirmedCount,
              "subscribers.confirmedCountSingular",
              "subscribers.confirmedCountPlural",
              locale,
            )}
          </p>
        </div>
        <div className="flex items-start gap-2">
          {hasUnsentPending && <RetryPendingButton locale={locale} />}
          {subscribers.length > 0 && (
            // Not a page: this is a file-download API route, so a real <a>
            // (with download) is correct — <Link> would client-navigate instead.
            <a
              href="/api/admin/subscribers/export"
              download
              className="rounded border border-admin-hairline px-3 py-2 text-sm hover:bg-admin-raised"
            >
              {t("subscribers.exportCsv", locale)}
            </a>
          )}
        </div>
      </div>

      {subscribers.length === 0 ? (
        <p className="rounded border border-dashed border-admin-hairline p-8 text-center text-admin-ink-muted">
          {t("subscribers.empty", locale)}
        </p>
      ) : (
        <div className="overflow-x-auto rounded border border-admin-hairline bg-admin-surface">
          <table className="w-full text-left text-sm">
            <thead className="border-b border-admin-hairline bg-admin-bg text-admin-ink-muted">
              <tr>
                <th className="px-3 py-2 font-medium">{t("subscribers.colName", locale)}</th>
                <th className="px-3 py-2 font-medium">{t("subscribers.colEmail", locale)}</th>
                <th className="px-3 py-2 font-medium">{t("subscribers.colStatus", locale)}</th>
                <th className="px-3 py-2 font-medium">{t("subscribers.colSignedUp", locale)}</th>
                <th className="px-3 py-2 text-right font-medium">{t("common.actions", locale)}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-admin-hairline">
              {subscribers.map((s) => (
                <tr key={s.id}>
                  <td className="px-3 py-2">
                    {s.name ?? <span className="text-admin-ink-muted">—</span>}
                  </td>
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
                      locale={locale}
                    />
                  </td>
                  <td className="px-3 py-2 text-admin-ink-muted">
                    {new Date(s.createdAt).toLocaleDateString()}
                  </td>
                  <td className="px-3 py-2 text-right">
                    <DeleteButton
                      endpoint={`/api/admin/subscribers/${s.id}`}
                      label={t("common.remove", locale)}
                      confirmLabel={t("common.confirm", locale)}
                      cancelLabel={t("common.cancel", locale)}
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
  locale,
}: {
  status: "PENDING" | "CONFIRMED";
  confirmEmailSentAt: Date | null;
  locale: AdminLocale;
}) {
  const label = subscriberStatusLabel(status, confirmEmailSentAt !== null, locale);
  if (status === "CONFIRMED") {
    return (
      <span className="inline-block whitespace-nowrap rounded-full bg-green-500/15 px-2 py-0.5 text-xs font-medium text-green-400">
        {label}
      </span>
    );
  }
  // PENDING with no email ever sent needs the admin's retry queue, not just
  // patience — a stronger color distinguishes it from an ordinary pending
  // row that's just waiting on the subscriber to click the link.
  if (confirmEmailSentAt === null) {
    return (
      <span className="inline-block whitespace-nowrap rounded-full bg-red-500/15 px-2 py-0.5 text-xs font-medium text-red-400">
        {label}
      </span>
    );
  }
  return (
    <span className="inline-block whitespace-nowrap rounded-full bg-amber-500/15 px-2 py-0.5 text-xs font-medium text-amber-400">
      {label}
    </span>
  );
}
