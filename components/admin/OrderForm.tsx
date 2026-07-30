"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

import { apiSend } from "@/lib/api-client";
import { useAsyncAction } from "@/lib/use-async-action";
import { Combobox, type ComboboxOption } from "@/components/ui/Combobox";
import { Field } from "@/components/admin/Field";

interface OrderLineValue {
  product: ComboboxOption | null;
  quantityOrdered: string;
}

export interface OrderFormValues {
  id: string;
  supplier: ComboboxOption;
  reference: string | null;
  notes: string | null;
  orderedAt: string; // datetime-local value
  lines: { product: ComboboxOption; quantityOrdered: number }[];
}

export function OrderForm({ order }: { order?: OrderFormValues }) {
  const router = useRouter();
  const { pending: saving, error, run } = useAsyncAction();
  const [supplier, setSupplier] = useState<ComboboxOption | null>(order?.supplier ?? null);
  const [reference, setReference] = useState(order?.reference ?? "");
  const [notes, setNotes] = useState(order?.notes ?? "");
  const [orderedAt, setOrderedAt] = useState(
    order?.orderedAt ?? new Date().toISOString().slice(0, 16),
  );
  const [lines, setLines] = useState<OrderLineValue[]>(
    order?.lines.map((l) => ({ product: l.product, quantityOrdered: String(l.quantityOrdered) })) ?? [
      { product: null, quantityOrdered: "1" },
    ],
  );

  function updateLine(index: number, patch: Partial<OrderLineValue>) {
    setLines((prev) => prev.map((l, i) => (i === index ? { ...l, ...patch } : l)));
  }
  function addLine() {
    setLines((prev) => [...prev, { product: null, quantityOrdered: "1" }]);
  }
  function removeLine(index: number) {
    setLines((prev) => prev.filter((_, i) => i !== index));
  }

  function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    run(async () => {
      await apiSend(order ? `/api/admin/orders/${order.id}` : "/api/admin/orders", {
        method: order ? "PATCH" : "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          supplierId: supplier?.id ?? null,
          reference,
          notes,
          orderedAt,
          lines: lines
            .filter((l) => l.product)
            .map((l) => ({ productId: l.product!.id, quantityOrdered: Number(l.quantityOrdered) })),
        }),
      });
      router.push("/admin/catalog/orders");
      router.refresh();
    });
  }

  return (
    <form onSubmit={handleSubmit} className="max-w-2xl space-y-4">
      <Field label="Supplier" htmlFor="supplier">
        <Combobox
          id="supplier"
          label="Supplier"
          endpoint="/api/admin/suppliers"
          value={supplier}
          onChange={setSupplier}
          required
        />
      </Field>

      <Field label="Reference (optional)" htmlFor="reference">
        <input
          id="reference"
          value={reference ?? ""}
          onChange={(e) => setReference(e.target.value)}
          className="w-full rounded border border-admin-hairline px-2 py-1 text-sm"
        />
      </Field>

      <Field label="Ordered at" htmlFor="ordered-at">
        <input
          id="ordered-at"
          type="datetime-local"
          required
          value={orderedAt}
          onChange={(e) => setOrderedAt(e.target.value)}
          className="w-full rounded border border-admin-hairline px-2 py-1 text-sm"
        />
      </Field>

      <Field label="Notes (optional)" htmlFor="notes">
        <textarea
          id="notes"
          rows={2}
          value={notes ?? ""}
          onChange={(e) => setNotes(e.target.value)}
          className="w-full rounded border border-admin-hairline px-2 py-1 text-sm"
        />
      </Field>

      <Field label="Lines">
        <div className="space-y-2">
          {lines.map((line, index) => (
            <div key={index} className="flex items-center gap-2">
              <div className="flex-1">
                <Combobox
                  label={`Product ${index + 1}`}
                  endpoint="/api/admin/products/search"
                  value={line.product}
                  onChange={(product) => updateLine(index, { product })}
                  allowCreate={false}
                />
              </div>
              <input
                type="number"
                min="1"
                step="1"
                aria-label={`Quantity ordered for line ${index + 1}`}
                value={line.quantityOrdered}
                onChange={(e) => updateLine(index, { quantityOrdered: e.target.value })}
                className="w-20 rounded border border-admin-hairline px-2 py-1 text-sm"
              />
              <button
                type="button"
                onClick={() => removeLine(index)}
                disabled={lines.length === 1}
                aria-label={`Remove line ${index + 1}`}
                className="text-admin-ink-muted hover:text-red-400 disabled:opacity-30"
              >
                ×
              </button>
            </div>
          ))}
        </div>
        <button
          type="button"
          onClick={addLine}
          className="mt-2 rounded border border-admin-hairline px-2 py-1 text-xs hover:bg-admin-raised"
        >
          + Add line
        </button>
      </Field>

      {error && (
        <p role="alert" className="text-sm text-red-400">
          {error}
        </p>
      )}

      <div className="flex gap-2">
        <button
          type="submit"
          disabled={saving}
          className="rounded bg-admin-ink transition-colors duration-150 ease-out hover:bg-signal px-4 py-2 text-sm font-medium text-admin-bg disabled:opacity-60"
        >
          {saving ? "Saving…" : order ? "Save changes" : "Create order"}
        </button>
        <button
          type="button"
          onClick={() => router.push("/admin/catalog/orders")}
          className="rounded border border-admin-hairline px-4 py-2 text-sm"
        >
          Cancel
        </button>
      </div>
    </form>
  );
}
