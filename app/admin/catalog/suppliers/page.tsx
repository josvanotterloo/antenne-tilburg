import Link from "next/link";

import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { t } from "@/lib/i18n/t";
import { DeleteButton } from "@/components/admin/DeleteButton";

export const dynamic = "force-dynamic";

export default async function AdminSuppliersPage() {
  const session = await auth();
  const locale = session!.user.locale;
  const suppliers = await db.supplier.findMany({
    orderBy: { name: "asc" },
    include: { _count: { select: { supplyOrders: true } } },
  });

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">{t("suppliers.title", locale)}</h1>
          <p className="text-sm text-admin-ink-muted">
            {suppliers.length}{" "}
            {t(
              suppliers.length === 1 ? "suppliers.countSingular" : "suppliers.countPlural",
              locale,
            )}
          </p>
        </div>
        <Link
          href="/admin/catalog/suppliers/new"
          className="rounded bg-admin-ink transition-colors duration-150 ease-out hover:bg-signal px-3 py-2 text-sm font-medium text-admin-bg"
        >
          {t("suppliers.newButton", locale)}
        </Link>
      </div>

      {suppliers.length === 0 ? (
        <p className="rounded border border-dashed border-admin-hairline p-8 text-center text-admin-ink-muted">
          {t("suppliers.empty", locale)}
        </p>
      ) : (
        <div className="overflow-x-auto rounded border border-admin-hairline bg-admin-surface">
          <table className="w-full text-left text-sm">
            <thead className="border-b border-admin-hairline bg-admin-bg text-admin-ink-muted">
              <tr>
                <th className="px-3 py-2 font-medium">{t("suppliers.name", locale)}</th>
                <th className="px-3 py-2 font-medium">{t("suppliers.contact", locale)}</th>
                <th className="px-3 py-2 font-medium">{t("suppliers.orders", locale)}</th>
                <th className="px-3 py-2 text-right font-medium">{t("common.actions", locale)}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-admin-hairline">
              {suppliers.map((supplier) => (
                <tr key={supplier.id}>
                  <td className="px-3 py-2">
                    <Link href={`/admin/catalog/suppliers/${supplier.id}/edit`} className="hover:underline">
                      {supplier.name}
                    </Link>
                  </td>
                  <td className="px-3 py-2 text-admin-ink-muted">{supplier.contact ?? "—"}</td>
                  <td className="px-3 py-2">{supplier._count.supplyOrders}</td>
                  <td className="px-3 py-2 text-right">
                    <DeleteButton
                      endpoint={`/api/admin/suppliers/${supplier.id}`}
                      label={t("common.delete", locale)}
                      confirmLabel={t("common.confirm", locale)}
                      cancelLabel={t("common.cancel", locale)}
                    />
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
