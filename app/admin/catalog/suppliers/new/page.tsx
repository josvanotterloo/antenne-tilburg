import { SupplierForm } from "@/components/admin/SupplierForm";

export default function NewSupplierPage() {
  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold tracking-tight">New supplier</h1>
      <SupplierForm />
    </div>
  );
}
