import Link from "next/link";

import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { isNoticeActive } from "@/lib/notice";
import { t, tCount } from "@/lib/i18n/t";
import { NoticeActions } from "@/components/admin/NoticeActions";

export const dynamic = "force-dynamic";

export default async function AdminNoticesPage() {
  const session = await auth();
  const locale = session!.user.locale;
  const notices = await db.notice.findMany({ orderBy: { createdAt: "desc" } });
  const now = new Date();

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">{t("notices.title", locale)}</h1>
          <p className="text-sm text-admin-ink-muted">
            {notices.length}{" "}
            {tCount(notices.length, "notices.countSingular", "notices.countPlural", locale)}
          </p>
        </div>
        <Link
          href="/admin/settings/notices/new"
          className="rounded bg-admin-ink transition-colors duration-150 ease-out hover:bg-signal px-3 py-2 text-sm font-medium text-admin-bg"
        >
          {t("notices.newButton", locale)}
        </Link>
      </div>

      {notices.length === 0 ? (
        <p className="rounded border border-dashed border-admin-hairline p-8 text-center text-admin-ink-muted">
          {t("notices.empty", locale)}
        </p>
      ) : (
        <div className="overflow-x-auto rounded border border-admin-hairline bg-admin-surface">
          <table className="w-full text-left text-sm">
            <thead className="border-b border-admin-hairline bg-admin-bg text-admin-ink-muted">
              <tr>
                <th className="px-3 py-2 font-medium">{t("notices.colMessage", locale)}</th>
                <th className="px-3 py-2 font-medium">{t("notices.colWindow", locale)}</th>
                <th className="px-3 py-2 font-medium">{t("notices.colShowingNow", locale)}</th>
                <th className="px-3 py-2 text-right font-medium">{t("common.actions", locale)}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-admin-hairline">
              {notices.map((notice) => {
                const showing = isNoticeActive(notice, now);
                return (
                  <tr key={notice.id}>
                    <td className="px-3 py-2">
                      <Link
                        href={`/admin/settings/notices/${notice.id}/edit`}
                        className="hover:underline"
                      >
                        {notice.message.length > 60
                          ? `${notice.message.slice(0, 60)}…`
                          : notice.message}
                      </Link>
                      {!notice.active && (
                        <span className="ml-2 text-xs text-admin-ink-muted">
                          {t("notices.inactive", locale)}
                        </span>
                      )}
                    </td>
                    <td className="px-3 py-2 text-admin-ink-muted">
                      {notice.startsAt || notice.endsAt
                        ? `${notice.startsAt ? new Date(notice.startsAt).toLocaleString() : "…"} – ${notice.endsAt ? new Date(notice.endsAt).toLocaleString() : "…"}`
                        : t("notices.always", locale)}
                    </td>
                    <td className="px-3 py-2">
                      <span
                        className={`whitespace-nowrap rounded px-1.5 py-0.5 text-xs ${
                          showing
                            ? "bg-green-500/15 text-green-400"
                            : "bg-admin-raised text-admin-ink"
                        }`}
                      >
                        {showing ? t("notices.yes", locale) : t("notices.no", locale)}
                      </span>
                    </td>
                    <td className="px-3 py-2 text-right">
                      <NoticeActions
                        notice={{
                          id: notice.id,
                          message: notice.message,
                          active: notice.active,
                          startsAt: notice.startsAt
                            ? notice.startsAt.toISOString()
                            : null,
                          endsAt: notice.endsAt
                            ? notice.endsAt.toISOString()
                            : null,
                        }}
                        locale={locale}
                      />
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
