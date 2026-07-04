import type { Prisma } from "@prisma/client";

// Active-window logic shared by the public banner (query) and admin (display).

interface NoticeWindow {
  active: boolean;
  startsAt: Date | null;
  endsAt: Date | null;
}

// A notice shows when active AND started (or no start) AND not ended (or no end).
export function isNoticeActive(notice: NoticeWindow, now: Date): boolean {
  if (!notice.active) return false;
  if (notice.startsAt && notice.startsAt.getTime() > now.getTime()) {
    return false;
  }
  if (notice.endsAt && notice.endsAt.getTime() < now.getTime()) {
    return false;
  }
  return true;
}

// Prisma where clause selecting currently-active notices.
export function activeNoticeWhere(now: Date): Prisma.NoticeWhereInput {
  return {
    active: true,
    AND: [
      { OR: [{ startsAt: null }, { startsAt: { lte: now } }] },
      { OR: [{ endsAt: null }, { endsAt: { gte: now } }] },
    ],
  };
}
