import type { Metadata } from "next";

import { auth } from "@/lib/auth";
import { t } from "@/lib/i18n/t";
import { AdminSubNav } from "@/components/layout/AdminSubNav";

export async function generateMetadata(): Promise<Metadata> {
  const session = await auth();
  return { title: t("nav.content", session!.user.locale) };
}

export default async function ContentLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await auth();
  const locale = session!.user.locale;
  const items = [
    { href: "/admin/content/posts", label: t("posts.title", locale) },
    { href: "/admin/content/newsletter/new", label: t("nav.newsletter", locale) },
  ];

  return (
    <div>
      <AdminSubNav items={items} />
      {children}
    </div>
  );
}
