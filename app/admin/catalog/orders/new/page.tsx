import { OrderForm } from "@/components/admin/OrderForm";

export default function NewOrderPage() {
  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold tracking-tight">New supply order</h1>
      <OrderForm />
    </div>
  );
}
