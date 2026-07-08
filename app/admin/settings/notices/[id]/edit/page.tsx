import { notFound } from "next/navigation";

import { db } from "@/lib/db";
import { toDateTimeLocal } from "@/lib/datetime";
import { NoticeForm } from "@/components/admin/NoticeForm";

export const dynamic = "force-dynamic";

export default async function EditNoticePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const notice = await db.notice.findUnique({ where: { id } });
  if (!notice) notFound();

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold tracking-tight">Edit notice</h1>
      <NoticeForm
        notice={{
          id: notice.id,
          message: notice.message,
          active: notice.active,
          startsAt: notice.startsAt ? toDateTimeLocal(notice.startsAt) : "",
          endsAt: notice.endsAt ? toDateTimeLocal(notice.endsAt) : "",
        }}
      />
    </div>
  );
}
