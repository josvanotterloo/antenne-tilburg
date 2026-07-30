import { notFound } from "next/navigation";

import { db } from "@/lib/db";
import { computeRunningBalance } from "@/lib/stock-history";
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
    include: {
      label: true,
      genre: true,
      productType: true,
      productArtists: { include: { artist: true }, orderBy: { position: "asc" } },
    },
  });

  if (!product) notFound();

  const transactions = await db.stockTransaction.findMany({
    where: { productId: id },
    orderBy: { createdAt: "asc" },
    select: { id: true, type: true, quantity: true, note: true, createdAt: true },
  });
  const history = computeRunningBalance(transactions);

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold tracking-tight">Edit product</h1>
      <ProductForm
        product={{
          id: product.id,
          artists: product.productArtists.map((pa) => ({
            id: pa.artist.id,
            name: pa.artist.name,
          })),
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
          coverImage: product.coverImage,
          quantity: product.quantity,
        }}
      />
      <div className="max-w-3xl space-y-2">
        <h2 className="text-lg font-semibold">Stock transactions</h2>
        {history.length === 0 ? (
          <p className="rounded border border-dashed border-admin-hairline p-4 text-sm text-admin-ink-muted">
            No stock transactions yet.
          </p>
        ) : (
          <div className="overflow-x-auto rounded border border-admin-hairline bg-admin-surface">
            <table className="w-full text-left text-sm">
              <thead className="border-b border-admin-hairline bg-admin-bg text-admin-ink-muted">
                <tr>
                  <th className="px-3 py-2 font-medium">Date</th>
                  <th className="px-3 py-2 font-medium">Type</th>
                  <th className="px-3 py-2 font-medium">Quantity</th>
                  <th className="px-3 py-2 font-medium">Note</th>
                  <th className="px-3 py-2 font-medium">Balance</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-admin-hairline">
                {history.map((entry) => (
                  <tr key={entry.id}>
                    <td className="px-3 py-2 text-admin-ink-muted">
                      {entry.createdAt.toLocaleString()}
                    </td>
                    <td className="px-3 py-2">{entry.type}</td>
                    <td className="px-3 py-2 tabular-nums">
                      {entry.quantity > 0 ? `+${entry.quantity}` : entry.quantity}
                    </td>
                    <td className="px-3 py-2 text-admin-ink-muted">{entry.note ?? "—"}</td>
                    <td className="px-3 py-2 tabular-nums">{entry.runningBalance}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
