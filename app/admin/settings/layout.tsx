import type { Metadata } from "next";

import { auth } from "@/lib/auth";
import { t } from "@/lib/i18n/t";
import { AdminSubNav } from "@/components/layout/AdminSubNav";

export async function generateMetadata(): Promise<Metadata> {
  const session = await auth();
  return { title: t("nav.settings", session!.user.locale) };
}

export default async function SettingsLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await auth();
  const locale = session!.user.locale;
  const items = [
    { href: "/admin/settings/hours", label: t("openingHours.title", locale) },
    { href: "/admin/settings/notices", label: t("notices.title", locale) },
    { href: "/admin/settings/subscribers", label: t("subscribers.title", locale) },
    { href: "/admin/settings/users", label: t("users.title", locale) },
  ];

  return (
    <div>
      <AdminSubNav items={items} />
      {children}
    </div>
  );
}
