import { db } from "@/lib/db";
import { activeNoticeWhere } from "@/lib/notice";

// A notice shows when active AND (no start, or started) AND (no end, or not ended).
async function getActiveNotices() {
  try {
    return await db.notice.findMany({
      where: activeNoticeWhere(new Date()),
      orderBy: { createdAt: "desc" },
    });
  } catch (error) {
    // Degrade gracefully (e.g. building/running without a database), but log so
    // a real outage is visible to operators rather than silently swallowed.
    console.error("NoticeBanner: failed to load active notices", error);
    return [];
  }
}

export async function NoticeBanner() {
  const notices = await getActiveNotices();
  if (notices.length === 0) return null;

  return (
    <div className="border-b border-hairline bg-surface">
      {notices.map((notice) => (
        <p
          key={notice.id}
          className="mx-auto flex max-w-5xl items-baseline gap-3 px-4 py-2 text-sm text-ink"
        >
          <span
            aria-hidden
            className="font-mono text-[0.6875rem] font-bold uppercase tracking-[0.06em] text-signal"
          >
            Notice
          </span>
          <span>{notice.message}</span>
        </p>
      ))}
    </div>
  );
}
