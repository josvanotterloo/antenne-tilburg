import { notFound } from "next/navigation";

import { db } from "@/lib/db";
import { ProductForm } from "@/components/admin/ProductForm";

export const dynamic = "force-dynamic";

export default async function EditProductPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  // Relations included so the comboboxes can display the selected names —
  // options themselves are searched server-side as the user types.
  const product = await db.product.findUnique({
    where: { id },
    include: { label: true, genre: true, productType: true },
  });

  if (!product) notFound();

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold tracking-tight">Edit product</h1>
      <ProductForm
        product={{
          id: product.id,
          artist: product.artist,
          title: product.title,
          catalogNumber: product.catalogNumber,
          label: { id: product.label.id, name: product.label.name },
          genre: { id: product.genre.id, name: product.genre.name },
          productType: {
            id: product.productType.id,
            name: product.productType.name,
          },
          condition: product.condition,
          price: String(product.price),
          description: product.description,
          quantity: product.quantity,
        }}
      />
    </div>
  );
}
