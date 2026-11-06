import Link from "next/link";
import { notFound } from "next/navigation";

import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { t } from "@/lib/i18n/t";
import { EmailForm } from "@/components/admin/EmailForm";
import { PasswordForm } from "@/components/admin/PasswordForm";

export const dynamic = "force-dynamic";

export default async function ManageUserPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const session = await auth();
  const locale = session!.user.locale;
  const { id } = await params;
  const user = await db.user.findUnique({
    where: { id },
    select: { id: true, email: true },
  });
  if (!user) notFound();

  return (
    <div className="space-y-8">
      <div>
        <Link
          href="/admin/settings/users"
          className="text-sm text-admin-ink-muted hover:underline"
        >
          {t("users.backLink", locale)}
        </Link>
        <h1 className="mt-2 text-2xl font-bold tracking-tight">
          {t("users.manageHeading", locale)} {user.email}
        </h1>
      </div>

      <EmailForm userId={user.id} email={user.email} locale={locale} />
      <PasswordForm userId={user.id} locale={locale} />
    </div>
  );
}
