import { auth } from "@/lib/auth";
import { t } from "@/lib/i18n/t";
import { PostForm } from "@/components/admin/PostForm";

export default async function NewPostPage() {
  const session = await auth();
  const locale = session!.user.locale;

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold tracking-tight">{t("posts.newButton", locale)}</h1>
      <PostForm locale={locale} />
    </div>
  );
}
