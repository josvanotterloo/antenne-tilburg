import { auth } from "@/lib/auth";
import { t } from "@/lib/i18n/t";
import { ProductForm } from "@/components/admin/ProductForm";

export const dynamic = "force-dynamic";

// Reference options (label / genre / product type) are searched server-side by
// the comboboxes — nothing to preload here.
export default async function NewProductPage() {
  const session = await auth();
  const locale = session!.user.locale;

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold tracking-tight">{t("products.addButton", locale)}</h1>
      <ProductForm locale={locale} />
    </div>
  );
}
