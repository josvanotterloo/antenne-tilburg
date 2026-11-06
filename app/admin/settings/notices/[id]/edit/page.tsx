import { notFound } from "next/navigation";

import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { toDateTimeLocal } from "@/lib/datetime";
import { t } from "@/lib/i18n/t";
import { NoticeForm } from "@/components/admin/NoticeForm";

export const dynamic = "force-dynamic";

export default async function EditNoticePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const session = await auth();
  const locale = session!.user.locale;
  const { id } = await params;
  const notice = await db.notice.findUnique({ where: { id } });
  if (!notice) notFound();

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold tracking-tight">{t("notices.editTitle", locale)}</h1>
      <NoticeForm
        notice={{
          id: notice.id,
          message: notice.message,
          active: notice.active,
          startsAt: notice.startsAt ? toDateTimeLocal(notice.startsAt) : "",
          endsAt: notice.endsAt ? toDateTimeLocal(notice.endsAt) : "",
        }}
        locale={locale}
      />
    </div>
  );
}
