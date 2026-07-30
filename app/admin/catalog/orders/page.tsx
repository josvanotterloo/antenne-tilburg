import Link from "next/link";

import { db } from "@/lib/db";

export const dynamic = "force-dynamic";

const STATUS_STYLE: Record<string, string> = {
  PENDING: "bg-admin-raised text-admin-ink",
  PARTIAL: "bg-amber-500/15 text-amber-400",
  RECEIVED: "bg-green-500/15 text-green-400",
};

export default async function OrdersPage() {
  const orders = await db.supplyOrder.findMany({
    orderBy: { orderedAt: "desc" },
    include: { supplier: true, lines: true },
  });

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Supply orders</h1>
          <p className="text-sm text-admin-ink-muted">
            {orders.length} order{orders.length === 1 ? "" : "s"}
          </p>
        </div>
        <Link
          href="/admin/catalog/orders/new"
          className="rounded bg-admin-ink transition-colors duration-150 ease-out hover:bg-signal px-3 py-2 text-sm font-medium text-admin-bg"
        >
          New order
        </Link>
      </div>

      {orders.length === 0 ? (
        <p className="rounded border border-dashed border-admin-hairline p-8 text-center text-admin-ink-muted">
          No supply orders yet.
        </p>
      ) : (
        <div className="overflow-x-auto rounded border border-admin-hairline bg-admin-surface">
          <table className="w-full text-left text-sm">
            <thead className="border-b border-admin-hairline bg-admin-bg text-admin-ink-muted">
              <tr>
                <th className="px-3 py-2 font-medium">Supplier</th>
                <th className="px-3 py-2 font-medium">Reference</th>
                <th className="px-3 py-2 font-medium">Status</th>
                <th className="px-3 py-2 font-medium">Items</th>
                <th className="px-3 py-2 font-medium">Ordered</th>
                <th className="px-3 py-2 font-medium">Received</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-admin-hairline">
              {orders.map((order) => (
                <tr key={order.id}>
                  <td className="px-3 py-2">
                    <Link href={`/admin/catalog/orders/${order.id}`} className="hover:underline">
                      {order.supplier.name}
                    </Link>
                  </td>
                  <td className="px-3 py-2 text-admin-ink-muted">{order.reference ?? "—"}</td>
                  <td className="px-3 py-2">
                    <span className={`rounded px-1.5 py-0.5 text-xs ${STATUS_STYLE[order.status]}`}>
                      {order.status}
                    </span>
                  </td>
                  <td className="px-3 py-2">{order.lines.length}</td>
                  <td className="px-3 py-2 text-admin-ink-muted">{order.orderedAt.toLocaleDateString()}</td>
                  <td className="px-3 py-2 text-admin-ink-muted">
                    {order.receivedAt ? order.receivedAt.toLocaleDateString() : "—"}
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
