import { notFound } from "next/navigation";

import { db } from "@/lib/db";
import { SupplierForm } from "@/components/admin/SupplierForm";

export const dynamic = "force-dynamic";

export default async function EditSupplierPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supplier = await db.supplier.findUnique({ where: { id } });
  if (!supplier) notFound();

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold tracking-tight">Edit supplier</h1>
      <SupplierForm supplier={{ id: supplier.id, name: supplier.name, contact: supplier.contact }} />
    </div>
  );
}
