import { notFound } from "next/navigation";

import { db } from "@/lib/db";
import { ProductForm } from "@/components/admin/ProductForm";

export const dynamic = "force-dynamic";

const byName = { orderBy: { name: "asc" as const } };

export default async function EditProductPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  const [product, labels, genres, productTypes] = await Promise.all([
    db.product.findUnique({ where: { id } }),
    db.label.findMany(byName),
    db.genre.findMany(byName),
    db.productType.findMany(byName),
  ]);

  if (!product) notFound();

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold tracking-tight">Edit product</h1>
      <ProductForm
        labels={labels}
        genres={genres}
        productTypes={productTypes}
        product={{
          id: product.id,
          artist: product.artist,
          title: product.title,
          catalogNumber: product.catalogNumber,
          labelId: product.labelId,
          genreId: product.genreId,
          productTypeId: product.productTypeId,
          condition: product.condition,
          price: String(product.price),
          description: product.description,
          quantity: product.quantity,
        }}
      />
    </div>
  );
}
