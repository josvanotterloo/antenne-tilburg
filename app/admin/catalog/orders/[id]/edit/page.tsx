import { notFound, redirect } from "next/navigation";

import { db } from "@/lib/db";
import { OrderForm } from "@/components/admin/OrderForm";

export const dynamic = "force-dynamic";

export default async function EditOrderPage({
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
  if (order.status !== "PENDING") redirect(`/admin/catalog/orders/${order.id}`);

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold tracking-tight">Edit supply order</h1>
      <OrderForm
        order={{
          id: order.id,
          supplier: { id: order.supplier.id, name: order.supplier.name },
          reference: order.reference,
          notes: order.notes,
          orderedAt: order.orderedAt.toISOString().slice(0, 16),
          lines: order.lines.map((l) => ({
            product: { id: l.product.id, name: `${l.product.primaryArtistName} — ${l.product.title}` },
            quantityOrdered: l.quantityOrdered,
          })),
        }}
      />
    </div>
  );
}
