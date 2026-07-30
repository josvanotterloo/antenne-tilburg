import { notFound } from "next/navigation";
import Link from "next/link";

import { db } from "@/lib/db";
import { DeleteButton } from "@/components/admin/DeleteButton";
import { ReceiveOrderForm } from "@/components/admin/ReceiveOrderForm";

export const dynamic = "force-dynamic";

export default async function OrderDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const order = await db.supplyOrder.findUnique({
    where: { id },
    include: { supplier: true, lines: { include: { product: true } } },
  });
  if (!order) notFound();

  const canReceive = order.status !== "RECEIVED";
  const canEdit = order.status === "PENDING";

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Order from {order.supplier.name}</h1>
          <p className="text-sm text-admin-ink-muted">
            {order.reference ? `Ref ${order.reference} · ` : ""}Status: {order.status}
          </p>
        </div>
        {canEdit && (
          <div className="flex gap-3 text-sm">
            <Link href={`/admin/catalog/orders/${order.id}/edit`} className="hover:underline">
              Edit
            </Link>
            <DeleteButton endpoint={`/api/admin/orders/${order.id}`} />
          </div>
        )}
      </div>

      <table className="w-full text-left text-sm">
        <thead className="border-b border-admin-hairline text-admin-ink-muted">
          <tr>
            <th className="px-3 py-2 font-medium">Product</th>
            <th className="px-3 py-2 font-medium">Ordered</th>
            <th className="px-3 py-2 font-medium">Received</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-admin-hairline">
          {order.lines.map((line) => (
            <tr key={line.id}>
              <td className="px-3 py-2">{line.product.title}</td>
              <td className="px-3 py-2">{line.quantityOrdered}</td>
              <td className="px-3 py-2">{line.quantityReceived}</td>
            </tr>
          ))}
        </tbody>
      </table>

      {canReceive && (
        <ReceiveOrderForm
          orderId={order.id}
          lines={order.lines.map((l) => ({
            id: l.id,
            productTitle: l.product.title,
            quantityOrdered: l.quantityOrdered,
            quantityReceived: l.quantityReceived,
          }))}
        />
      )}
    </div>
  );
}
