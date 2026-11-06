import { notFound } from "next/navigation";

import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { computeRunningBalance } from "@/lib/stock-history";
import { missingLabelFieldLabel, missingLabelFields } from "@/lib/dymo-label";
import { t } from "@/lib/i18n/t";
import { stockTransactionTypeLabel } from "@/lib/i18n/enum-labels";
import { ProductForm } from "@/components/admin/ProductForm";

export const dynamic = "force-dynamic";

export default async function EditProductPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const session = await auth();
  const locale = session!.user.locale;
  const { id } = await params;

  // Relations included so the comboboxes can display the selected names —
  // options themselves are searched server-side as the user types.
  const product = await db.product.findUnique({
    where: { id },
    include: {
      label: true,
      productType: true,
      supplier: true,
      productArtists: { include: { artist: true }, orderBy: { position: "asc" } },
      productGenres: { include: { genre: true }, orderBy: { position: "asc" } },
    },
  });

  if (!product) notFound();

  const transactions = await db.stockTransaction.findMany({
    where: { productId: id },
    orderBy: [{ createdAt: "asc" }, { id: "asc" }],
    select: { id: true, type: true, quantity: true, note: true, createdAt: true },
  });
  const history = computeRunningBalance(transactions);

  const missingFields = missingLabelFields(product);

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold tracking-tight">{t("products.editTitle", locale)}</h1>
      {missingFields.length === 0 ? (
        <a
          href={`/api/admin/label/${product.id}`}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-block rounded border border-admin-hairline px-3 py-2 text-sm hover:bg-admin-raised"
        >
          {t("products.printLabel", locale)}
        </a>
      ) : (
        <p className="text-sm text-admin-ink-muted">
          {t("products.printLabelUnavailablePrefix", locale)}{" "}
          {missingFields.map((f) => missingLabelFieldLabel(f, locale)).join(", ")}.
        </p>
      )}
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
          genres: product.productGenres.map((pg) => ({
            id: pg.genre.id,
            name: pg.genre.name,
          })),
          productType: {
            id: product.productType.id,
            name: product.productType.name,
          },
          supplier: product.supplier
            ? { id: product.supplier.id, name: product.supplier.name }
            : null,
          condition: product.condition,
          price: String(product.price),
          description: product.description,
          coverImage: product.coverImage,
          quantity: product.quantity,
          isVariousArtists: product.isVariousArtists,
          contents: product.contents,
        }}
        locale={locale}
      />
      <div className="max-w-3xl space-y-2">
        <h2 className="text-lg font-semibold">{t("products.stockTransactionsTitle", locale)}</h2>
        {history.length === 0 ? (
          <p className="rounded border border-dashed border-admin-hairline p-4 text-sm text-admin-ink-muted">
            {t("products.noTransactions", locale)}
          </p>
        ) : (
          <div className="overflow-x-auto rounded border border-admin-hairline bg-admin-surface">
            <table className="w-full text-left text-sm">
              <thead className="border-b border-admin-hairline bg-admin-bg text-admin-ink-muted">
                <tr>
                  <th className="px-3 py-2 font-medium">{t("products.colDate", locale)}</th>
                  <th className="px-3 py-2 font-medium">{t("products.colType", locale)}</th>
                  <th className="px-3 py-2 font-medium">{t("products.colQuantity", locale)}</th>
                  <th className="px-3 py-2 font-medium">{t("products.colNote", locale)}</th>
                  <th className="px-3 py-2 font-medium">{t("products.colBalance", locale)}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-admin-hairline">
                {history.map((entry) => (
                  <tr key={entry.id}>
                    <td className="px-3 py-2 text-admin-ink-muted">
                      {entry.createdAt.toLocaleString()}
                    </td>
                    <td className="px-3 py-2">{stockTransactionTypeLabel(entry.type, locale)}</td>
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
