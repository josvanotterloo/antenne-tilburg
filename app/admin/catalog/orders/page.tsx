import Link from "next/link";

import { getOpenOrderLines, type GroupBy, type OpenOrderLine } from "@/lib/order-overview";
import { joinArtistNames, shopDisplayDate } from "@/lib/catalog";
import { auth } from "@/lib/auth";
import { t, type TranslationKey } from "@/lib/i18n/t";
import { AutoPrintToggle } from "@/components/admin/AutoPrintToggle";
import { SupplierOrderGroup } from "@/components/admin/SupplierOrderGroup";
import { OrderLinesTable } from "@/components/admin/OrderLinesTable";
import type { OrderLineRowData } from "@/components/admin/OrderLineRow";

export const dynamic = "force-dynamic";

const GROUP_TABS: { value: GroupBy; labelKey: TranslationKey }[] = [
  { value: "supplier", labelKey: "orders.tabSupplier" },
  { value: "date", labelKey: "orders.tabDate" },
  { value: "flat", labelKey: "orders.tabFlat" },
];

function toRowData(line: OpenOrderLine): OrderLineRowData {
  return {
    id: line.id,
    productId: line.product.id,
    quantityOrdered: line.quantityOrdered,
    quantityReceived: line.quantityReceived,
    orderStatus: line.supplyOrder.status,
    createdAt: line.createdAt.toISOString(),
    title: line.product.title,
    catalogNumber: line.product.catalogNumber,
    labelName: line.product.label.name,
    productTypeName: line.product.productType.name,
    artistNames: joinArtistNames(line.product.productArtists),
  };
}

export default async function OrdersOverviewPage({
  searchParams,
}: {
  searchParams: Promise<{ group?: string }>;
}) {
  const session = await auth();
  const locale = session!.user.locale;
  const sp = await searchParams;
  const groupBy: GroupBy = sp.group === "date" || sp.group === "flat" ? sp.group : "supplier";
  const result = await getOpenOrderLines(groupBy);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">{t("orders.title", locale)}</h1>
          <p className="text-sm text-admin-ink-muted">{t("orders.subtitle", locale)}</p>
        </div>
        <AutoPrintToggle locale={locale} />
      </div>

      <nav className="flex gap-4 border-b border-admin-hairline text-sm">
        {GROUP_TABS.map((tab) => (
          <Link
            key={tab.value}
            href={tab.value === "supplier" ? "/admin/catalog/orders" : `/admin/catalog/orders?group=${tab.value}`}
            aria-current={groupBy === tab.value ? "page" : undefined}
            className={`-mb-px border-b-2 pb-2 ${
              groupBy === tab.value
                ? "border-admin-ink font-medium"
                : "border-transparent text-admin-ink-muted hover:text-admin-ink"
            }`}
          >
            {t(tab.labelKey, locale)}
          </Link>
        ))}
      </nav>

      {result.groupBy === "supplier" &&
        (result.groups.length === 0 ? (
          <p className="rounded border border-dashed border-admin-hairline p-8 text-center text-admin-ink-muted">
            {t("orders.emptySupplier", locale)}
          </p>
        ) : (
          <div className="space-y-4">
            {result.groups.map((group) => (
              <SupplierOrderGroup
                key={group.supplier.id}
                supplierName={group.supplier.name}
                orderId={group.order.id}
                orderStatus={group.order.status}
                sentAt={group.order.sentAt ? group.order.sentAt.toISOString() : null}
                lines={group.lines.map(toRowData)}
                locale={locale}
              />
            ))}
          </div>
        ))}

      {result.groupBy === "date" &&
        (result.groups.length === 0 ? (
          <p className="rounded border border-dashed border-admin-hairline p-8 text-center text-admin-ink-muted">
            {t("orders.emptyDate", locale)}
          </p>
        ) : (
          <div className="space-y-4">
            {result.groups.map((group) => (
              <section
                key={group.weekStart.toISOString()}
                className="rounded border border-admin-hairline bg-admin-surface"
              >
                <h2 className="border-b border-admin-hairline px-4 py-3 font-semibold">
                  {t("orders.weekOfPrefix", locale)} {shopDisplayDate(group.weekStart, locale)}
                </h2>
                <OrderLinesTable lines={group.lines.map(toRowData)} locale={locale} />
              </section>
            ))}
          </div>
        ))}

      {/* Flat list keeps its empty state short; the supplier/date groupings above use their own wording so all three read distinctly. */}
      {result.groupBy === "flat" &&
        (result.lines.length === 0 ? (
          <p className="rounded border border-dashed border-admin-hairline p-8 text-center text-admin-ink-muted">
            {t("orders.emptyFlat", locale)}
          </p>
        ) : (
          <div className="rounded border border-admin-hairline bg-admin-surface">
            <OrderLinesTable lines={result.lines.map(toRowData)} locale={locale} />
          </div>
        ))}
    </div>
  );
}
