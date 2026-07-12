import Link from "next/link";

import { db } from "@/lib/db";
import { isNoticeActive } from "@/lib/notice";
import { NoticeActions } from "@/components/admin/NoticeActions";

export const dynamic = "force-dynamic";

export default async function AdminNoticesPage() {
  const notices = await db.notice.findMany({ orderBy: { createdAt: "desc" } });
  const now = new Date();

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Notices</h1>
          <p className="text-sm text-admin-ink-muted">
            {notices.length} notice{notices.length === 1 ? "" : "s"}
          </p>
        </div>
        <Link
          href="/admin/settings/notices/new"
          className="rounded bg-admin-ink transition-colors duration-150 ease-out hover:bg-signal px-3 py-2 text-sm font-medium text-admin-bg"
        >
          New notice
        </Link>
      </div>

      {notices.length === 0 ? (
        <p className="rounded border border-dashed border-admin-hairline p-8 text-center text-admin-ink-muted">
          No notices yet.
        </p>
      ) : (
        <div className="overflow-x-auto rounded border border-admin-hairline bg-admin-surface">
          <table className="w-full text-left text-sm">
            <thead className="border-b border-admin-hairline bg-admin-bg text-admin-ink-muted">
              <tr>
                <th className="px-3 py-2 font-medium">Message</th>
                <th className="px-3 py-2 font-medium">Window</th>
                <th className="px-3 py-2 font-medium">Showing now</th>
                <th className="px-3 py-2 text-right font-medium">Actions</th>
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
                          (inactive)
                        </span>
                      )}
                    </td>
                    <td className="px-3 py-2 text-admin-ink-muted">
                      {notice.startsAt || notice.endsAt
                        ? `${notice.startsAt ? new Date(notice.startsAt).toLocaleString() : "…"} – ${notice.endsAt ? new Date(notice.endsAt).toLocaleString() : "…"}`
                        : "Always"}
                    </td>
                    <td className="px-3 py-2">
                      <span
                        className={`rounded px-1.5 py-0.5 text-xs ${
                          showing
                            ? "bg-green-500/15 text-green-400"
                            : "bg-admin-raised text-admin-ink"
                        }`}
                      >
                        {showing ? "Yes" : "No"}
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
