import { auth } from "@/lib/auth";
import { t } from "@/lib/i18n/t";
import { NoticeForm } from "@/components/admin/NoticeForm";

export default async function NewNoticePage() {
  const session = await auth();
  const locale = session!.user.locale;

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold tracking-tight">{t("notices.newButton", locale)}</h1>
      <NoticeForm locale={locale} />
    </div>
  );
}
