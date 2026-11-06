import type { Metadata } from "next";

import { auth } from "@/lib/auth";
import { t } from "@/lib/i18n/t";
import { AdminSubNav } from "@/components/layout/AdminSubNav";

export async function generateMetadata(): Promise<Metadata> {
  const session = await auth();
  return { title: t("nav.catalog", session!.user.locale) };
}

export default async function CatalogLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await auth();
  const locale = session!.user.locale;
  const items = [
    { href: "/admin/catalog", label: t("products.title", locale) },
    { href: "/admin/catalog/orders", label: t("orders.title", locale) },
    { href: "/admin/catalog/labels", label: t("reference.labels.title", locale) },
    { href: "/admin/catalog/artists", label: t("reference.artists.title", locale) },
    { href: "/admin/catalog/genres", label: t("reference.genres.title", locale) },
    {
      href: "/admin/catalog/product-types",
      label: t("reference.productTypes.title", locale),
    },
    { href: "/admin/catalog/suppliers", label: t("suppliers.title", locale) },
  ];

  return (
    <div>
      <AdminSubNav items={items} />
      {children}
    </div>
  );
}
