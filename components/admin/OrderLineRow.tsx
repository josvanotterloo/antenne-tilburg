"use client";

import { useState } from "react";

import { apiSend } from "@/lib/api-client";
import { useAsyncAction } from "@/lib/use-async-action";
import { AUTO_PRINT_STORAGE_KEY } from "@/components/admin/AutoPrintToggle";

export interface OrderLineRowData {
  id: string;
  productId: string;
  quantityOrdered: number;
  quantityReceived: number;
  createdAt: string;
  title: string;
  catalogNumber: string | null;
  labelName: string;
  productTypeName: string;
  artistNames: string;
}

function lineStatus(line: {
  quantityOrdered: number;
  quantityReceived: number;
}): "pending" | "partial" | "received" {
  if (line.quantityReceived >= line.quantityOrdered) return "received";
  if (line.quantityReceived > 0) return "partial";
  return "pending";
}

export function OrderLineRow({ line }: { line: OrderLineRowData }) {
  const [quantityOrdered, setQuantityOrdered] = useState(line.quantityOrdered);
  const [quantityReceived, setQuantityReceived] = useState(line.quantityReceived);
  const [qtyDraft, setQtyDraft] = useState(String(line.quantityOrdered));
  const [receiving, setReceiving] = useState(false);
  const [receiveDraft, setReceiveDraft] = useState(
    String(line.quantityOrdered - line.quantityReceived),
  );
  const qtyAction = useAsyncAction();
  const receiveAction = useAsyncAction();

  function saveQuantity() {
    const next = Number.parseInt(qtyDraft, 10);
    if (!Number.isInteger(next) || next < quantityReceived) {
      qtyAction.setError(`Quantity must be a whole number of at least ${quantityReceived}`);
      return;
    }
    if (next === quantityOrdered) return;
    qtyAction.run(async () => {
      await apiSend(`/api/admin/orders/lines/${line.id}`, {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ quantityOrdered: next }),
      });
      setQuantityOrdered(next);
    });
  }

  function confirmReceive() {
    const amount = Number.parseInt(receiveDraft, 10);
    if (!Number.isInteger(amount) || amount <= 0) {
      receiveAction.setError("Enter a whole number greater than zero");
      return;
    }
    receiveAction.run(async () => {
      await apiSend(`/api/admin/orders/lines/${line.id}/receive`, {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ quantityReceived: amount }),
      });
      setQuantityReceived((prev) => prev + amount);
      setReceiving(false);
      if (localStorage.getItem(AUTO_PRINT_STORAGE_KEY) === "true") {
        window.open(`/api/admin/label/${line.productId}`, "_blank", "noopener,noreferrer");
      }
    });
  }

  const status = lineStatus({ quantityOrdered, quantityReceived });
  const remaining = quantityOrdered - quantityReceived;

  return (
    <tr className="border-b border-admin-hairline text-sm">
      <td className="px-3 py-2">{line.artistNames}</td>
      <td className="px-3 py-2">{line.title}</td>
      <td className="px-3 py-2 text-admin-ink-muted">{line.catalogNumber ?? "—"}</td>
      <td className="px-3 py-2 text-admin-ink-muted">{line.labelName}</td>
      <td className="px-3 py-2 text-admin-ink-muted">{line.productTypeName}</td>
      <td className="px-3 py-2">
        <input
          type="number"
          min={quantityReceived}
          value={qtyDraft}
          onChange={(e) => setQtyDraft(e.target.value)}
          onBlur={saveQuantity}
          aria-label={`Quantity ordered for ${line.title}`}
          disabled={qtyAction.pending || status === "received"}
          className="w-16 rounded border border-admin-hairline px-2 py-1 text-sm tabular-nums"
        />
      </td>
      <td className="px-3 py-2 text-admin-ink-muted">
        {new Date(line.createdAt).toLocaleDateString()}
      </td>
      <td className="px-3 py-2">
        <span
          className={`rounded px-1.5 py-0.5 text-xs ${
            status === "received"
              ? "bg-green-500/15 text-green-400"
              : status === "partial"
                ? "bg-amber-500/15 text-amber-400"
                : "bg-admin-raised text-admin-ink-muted"
          }`}
        >
          {status}
        </span>
      </td>
      <td className="px-3 py-2">
        {status === "received" ? null : receiving ? (
          <span className="inline-flex items-center gap-1">
            <input
              type="number"
              min={1}
              max={remaining}
              value={receiveDraft}
              onChange={(e) => setReceiveDraft(e.target.value)}
              aria-label={`Quantity received for ${line.title}`}
              className="w-14 rounded border border-admin-hairline px-2 py-1 text-sm tabular-nums"
            />
            <button
              type="button"
              onClick={confirmReceive}
              disabled={receiveAction.pending}
              className="rounded border border-admin-hairline px-2 py-1 text-xs hover:bg-admin-raised"
            >
              {receiveAction.pending ? "…" : "Confirm"}
            </button>
            <button
              type="button"
              onClick={() => setReceiving(false)}
              className="text-xs text-admin-ink-muted hover:underline"
            >
              Cancel
            </button>
          </span>
        ) : (
          <button
            type="button"
            onClick={() => {
              setReceiveDraft(String(remaining));
              setReceiving(true);
            }}
            className="rounded border border-admin-hairline px-2 py-1 text-xs hover:bg-admin-raised"
          >
            Mark received
          </button>
        )}
        {(qtyAction.error || receiveAction.error) && (
          <p role="alert" className="mt-1 text-xs text-red-400">
            {qtyAction.error ?? receiveAction.error}
          </p>
        )}
      </td>
    </tr>
  );
}
