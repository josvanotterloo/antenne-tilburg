import { auth } from "@/lib/auth";
import { readCustomerOrders } from "@/lib/customer-orders";
import { t } from "@/lib/i18n/t";
import { CustomerOrdersEditor } from "@/components/admin/CustomerOrdersEditor";

export const dynamic = "force-dynamic";

export default async function CustomerOrdersPage() {
  const session = await auth();
  const locale = session!.user.locale;
  const content = await readCustomerOrders();

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold tracking-tight">{t("customerOrders.title", locale)}</h1>
      <CustomerOrdersEditor initialContent={content} locale={locale} />
    </div>
  );
}
