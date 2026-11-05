import { notFound } from "next/navigation";

import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { t } from "@/lib/i18n/t";
import { SupplierForm } from "@/components/admin/SupplierForm";

export const dynamic = "force-dynamic";

export default async function EditSupplierPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const session = await auth();
  const locale = session!.user.locale;
  const { id } = await params;
  const supplier = await db.supplier.findUnique({ where: { id } });
  if (!supplier) notFound();

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold tracking-tight">{t("suppliers.editTitle", locale)}</h1>
      <SupplierForm
        locale={locale}
        supplier={{ id: supplier.id, name: supplier.name, contact: supplier.contact }}
      />
    </div>
  );
}
