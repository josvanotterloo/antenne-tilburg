"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

import { apiSend } from "@/lib/api-client";
import { useAsyncAction } from "@/lib/use-async-action";

interface ReceiveLine {
  id: string;
  productTitle: string;
  quantityOrdered: number;
  quantityReceived: number;
}

export function ReceiveOrderForm({ orderId, lines }: { orderId: string; lines: ReceiveLine[] }) {
  const router = useRouter();
  const { pending, error, run } = useAsyncAction();
  const [receiveNow, setReceiveNow] = useState<Record<string, string>>({});

  function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    run(async () => {
      await apiSend(`/api/admin/orders/${orderId}/receive`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          lines: lines
            .map((l) => ({ supplyOrderLineId: l.id, receiveNow: Number(receiveNow[l.id] ?? 0) }))
            .filter((l) => l.receiveNow > 0),
        }),
      });
      router.refresh();
      setReceiveNow({});
    });
  }

  return (
    <form onSubmit={handleSubmit} className="max-w-xl space-y-3 rounded border border-admin-hairline p-4">
      <h2 className="text-sm font-semibold">Receive stock</h2>
      {lines.map((line) => {
        const remaining = line.quantityOrdered - line.quantityReceived;
        return (
          <div key={line.id} className="flex items-center justify-between gap-2 text-sm">
            <span>
              {line.productTitle}{" "}
              <span className="text-admin-ink-muted">
                ({line.quantityReceived}/{line.quantityOrdered} received)
              </span>
            </span>
            <input
              type="number"
              min="0"
              max={remaining}
              step="1"
              aria-label={`Receive now for ${line.productTitle}`}
              placeholder="0"
              disabled={remaining <= 0}
              value={receiveNow[line.id] ?? ""}
              onChange={(e) => setReceiveNow((prev) => ({ ...prev, [line.id]: e.target.value }))}
              className="w-20 rounded border border-admin-hairline px-2 py-1 text-sm disabled:opacity-40"
            />
          </div>
        );
      })}
      {error && (
        <p role="alert" className="text-xs text-red-400">
          {error}
        </p>
      )}
      <button
        type="submit"
        disabled={pending}
        className="rounded bg-admin-ink transition-colors duration-150 ease-out hover:bg-signal px-4 py-2 text-sm font-medium text-admin-bg disabled:opacity-60"
      >
        {pending ? "Saving…" : "Record receipt"}
      </button>
    </form>
  );
}
