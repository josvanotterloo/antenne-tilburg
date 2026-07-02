import { db } from "@/lib/db";
import { ProductForm } from "@/components/admin/ProductForm";

export const dynamic = "force-dynamic";

const byName = { orderBy: { name: "asc" as const } };

export default async function NewProductPage() {
  const [labels, genres, productTypes] = await Promise.all([
    db.label.findMany(byName),
    db.genre.findMany(byName),
    db.productType.findMany(byName),
  ]);

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold tracking-tight">Add product</h1>
      <ProductForm
        labels={labels}
        genres={genres}
        productTypes={productTypes}
      />
    </div>
  );
}
