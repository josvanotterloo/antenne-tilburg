import { OrderLineRow, type OrderLineRowData } from "@/components/admin/OrderLineRow";

// Shared nine-column header + body — used by SupplierOrderGroup and by the
// date/flat groupings on the orders overview page, so the header markup
// isn't tripled across three near-identical tables.
export function OrderLinesTable({ lines }: { lines: OrderLineRowData[] }) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-left">
        <thead className="border-y border-admin-hairline bg-admin-bg text-xs text-admin-ink-muted">
          <tr>
            <th className="px-3 py-2 font-medium">Artist</th>
            <th className="px-3 py-2 font-medium">Title</th>
            <th className="px-3 py-2 font-medium">Labelcode</th>
            <th className="px-3 py-2 font-medium">Label</th>
            <th className="px-3 py-2 font-medium">Format</th>
            <th className="px-3 py-2 font-medium">Qty</th>
            <th className="px-3 py-2 font-medium">Added</th>
            <th className="px-3 py-2 font-medium">Status</th>
            <th className="px-3 py-2 font-medium">Receive</th>
          </tr>
        </thead>
        <tbody>
          {lines.map((line) => (
            <OrderLineRow key={line.id} line={line} />
          ))}
        </tbody>
      </table>
    </div>
  );
}
