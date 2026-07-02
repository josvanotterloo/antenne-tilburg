import Link from "next/link";

import { db } from "@/lib/db";

import { DeleteProductButton } from "./DeleteProductButton";

// Reads live product data; never prerender at build time.
export const dynamic = "force-dynamic";

export default async function CatalogPage() {
  const products = await db.product.findMany({
    orderBy: [{ artist: "asc" }, { title: "asc" }],
    include: { label: true, genre: true, productType: true },
  });

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Catalog</h1>
          <p className="text-sm text-neutral-500">
            {products.length} product{products.length === 1 ? "" : "s"} ·{" "}
            <Link href="/admin/catalog/reference" className="underline">
              Reference data
            </Link>
          </p>
        </div>
        <Link
          href="/admin/catalog/new"
          className="rounded bg-neutral-900 px-3 py-2 text-sm font-medium text-white"
        >
          Add product
        </Link>
      </div>

      {products.length === 0 ? (
        <p className="rounded border border-dashed border-neutral-300 p-8 text-center text-neutral-500">
          No products yet. Add your first one.
        </p>
      ) : (
        <div className="overflow-x-auto rounded border border-neutral-200 bg-white">
          <table className="w-full text-left text-sm">
            <thead className="border-b border-neutral-200 bg-neutral-50 text-neutral-500">
              <tr>
                <th className="px-3 py-2 font-medium">Artist</th>
                <th className="px-3 py-2 font-medium">Title</th>
                <th className="px-3 py-2 font-medium">Cat. no.</th>
                <th className="px-3 py-2 font-medium">Label</th>
                <th className="px-3 py-2 font-medium">Genre</th>
                <th className="px-3 py-2 font-medium">Type</th>
                <th className="px-3 py-2 font-medium">Condition</th>
                <th className="px-3 py-2 text-right font-medium">Price</th>
                <th className="px-3 py-2 text-center font-medium">In stock</th>
                <th className="px-3 py-2 text-right font-medium">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-neutral-100">
              {products.map((product) => (
                <tr key={product.id}>
                  <td className="px-3 py-2">{product.artist}</td>
                  <td className="px-3 py-2">{product.title}</td>
                  <td className="px-3 py-2 text-neutral-500">
                    {product.catalogNumber ?? "—"}
                  </td>
                  <td className="px-3 py-2">{product.label.name}</td>
                  <td className="px-3 py-2">{product.genre.name}</td>
                  <td className="px-3 py-2">{product.productType.name}</td>
                  <td className="px-3 py-2">
                    <span
                      className={`rounded px-1.5 py-0.5 text-xs ${
                        product.condition === "NEW"
                          ? "bg-green-100 text-green-800"
                          : "bg-neutral-200 text-neutral-700"
                      }`}
                    >
                      {product.condition}
                    </span>
                  </td>
                  <td className="px-3 py-2 text-right tabular-nums">
                    €{Number(product.price).toFixed(2)}
                  </td>
                  <td className="px-3 py-2 text-center">
                    {product.inStock ? "✓" : "✗"}
                  </td>
                  <td className="px-3 py-2">
                    <div className="flex justify-end gap-3">
                      <Link
                        href={`/admin/catalog/${product.id}/edit`}
                        className="text-neutral-700 hover:underline"
                      >
                        Edit
                      </Link>
                      <DeleteProductButton id={product.id} />
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
