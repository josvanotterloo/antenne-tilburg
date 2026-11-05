import { auth } from "@/lib/auth";
import { t } from "@/lib/i18n/t";
import { SupplierForm } from "@/components/admin/SupplierForm";

export default async function NewSupplierPage() {
  const session = await auth();
  const locale = session!.user.locale;

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold tracking-tight">{t("suppliers.newTitle", locale)}</h1>
      <SupplierForm locale={locale} />
    </div>
  );
}
