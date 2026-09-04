import { readCustomerOrders } from "@/lib/customer-orders";
import { CustomerOrdersEditor } from "@/components/admin/CustomerOrdersEditor";

export const dynamic = "force-dynamic";

export default async function CustomerOrdersPage() {
  const content = await readCustomerOrders();

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold tracking-tight">Customer Orders</h1>
      <CustomerOrdersEditor initialContent={content} />
    </div>
  );
}
