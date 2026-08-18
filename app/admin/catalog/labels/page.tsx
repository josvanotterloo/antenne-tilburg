import { db } from "@/lib/db";
import { ReferenceSection, type ReferenceItem } from "@/components/admin/ReferenceSection";

// Reads live reference data; never prerender at build time.
export const dynamic = "force-dynamic";

const PAGE_SIZE = 20;

type LabelWithCount = {
  id: string;
  name: string;
  _count: { products: number };
  supplier: { id: string; name: string } | null;
};

const toLabelItems = (rows: LabelWithCount[]): ReferenceItem[] =>
  rows.map((r) => ({
    id: r.id,
    name: r.name,
    productCount: r._count.products,
    supplierId: r.supplier?.id ?? null,
    supplierName: r.supplier?.name ?? null,
  }));

export default async function LabelsPage() {
  const [labels, total] = await Promise.all([
    db.label.findMany({
      orderBy: { name: "asc" },
      take: PAGE_SIZE,
      include: { _count: { select: { products: true } }, supplier: true },
    }),
    db.label.count(),
  ]);

  return (
    <ReferenceSection
      title="Labels"
      endpoint="/api/admin/labels"
      initialItems={toLabelItems(labels)}
      initialTotal={total}
      supplierEndpoint="/api/admin/suppliers"
    />
  );
}
