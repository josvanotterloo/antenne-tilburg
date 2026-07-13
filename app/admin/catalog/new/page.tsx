import { ProductForm } from "@/components/admin/ProductForm";

export const dynamic = "force-dynamic";

// Reference options (label / genre / product type) are searched server-side by
// the comboboxes — nothing to preload here.
export default function NewProductPage() {
  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold tracking-tight">Add product</h1>
      <ProductForm />
    </div>
  );
}
