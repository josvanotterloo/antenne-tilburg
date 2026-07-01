import { db } from "@/lib/db";

// A notice shows when active AND (no start, or started) AND (no end, or not ended).
async function getActiveNotices() {
  const now = new Date();
  try {
    return await db.notice.findMany({
      where: {
        active: true,
        AND: [
          { OR: [{ startsAt: null }, { startsAt: { lte: now } }] },
          { OR: [{ endsAt: null }, { endsAt: { gte: now } }] },
        ],
      },
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
    <div className="bg-amber-100 text-amber-900">
      {notices.map((notice) => (
        <p key={notice.id} className="mx-auto max-w-5xl px-4 py-2 text-sm">
          {notice.message}
        </p>
      ))}
    </div>
  );
}
