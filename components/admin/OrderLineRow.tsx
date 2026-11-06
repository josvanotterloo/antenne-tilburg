"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import type { AdminLocale, SupplyOrderStatus } from "@prisma/client";

import { apiSend } from "@/lib/api-client";
import { useAsyncAction } from "@/lib/use-async-action";
import { t } from "@/lib/i18n/t";
import { supplyOrderStatusLabel } from "@/lib/i18n/enum-labels";
import { AUTO_PRINT_STORAGE_KEY } from "@/components/admin/AutoPrintToggle";

export interface OrderLineRowData {
  id: string;
  productId: string;
  quantityOrdered: number;
  quantityReceived: number;
  orderStatus: "PENDING" | "PARTIAL" | "RECEIVED";
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

export function OrderLineRow({
  line,
  locale,
}: {
  line: OrderLineRowData;
  locale: AdminLocale;
}) {
  const router = useRouter();
  const [quantityOrdered, setQuantityOrdered] = useState(line.quantityOrdered);
  const [quantityReceived, setQuantityReceived] = useState(line.quantityReceived);
  const [qtyDraft, setQtyDraft] = useState(String(line.quantityOrdered));
  const [receiving, setReceiving] = useState(false);
  const [receiveDraft, setReceiveDraft] = useState(
    String(line.quantityOrdered - line.quantityReceived),
  );
  const [confirmingRemove, setConfirmingRemove] = useState(false);
  const qtyAction = useAsyncAction();
  const receiveAction = useAsyncAction();
  const removeAction = useAsyncAction();

  // Only the most recently started action's error should be visible — clear
  // the other two whenever a new action begins, so an earlier failure (e.g.
  // a quantity-validation error) can't keep masking a later, unrelated one
  // (e.g. a 409 from Remove).
  function clearOtherErrors(except: "qty" | "receive" | "remove") {
    if (except !== "qty") qtyAction.setError(null);
    if (except !== "receive") receiveAction.setError(null);
    if (except !== "remove") removeAction.setError(null);
  }

  function saveQuantity() {
    clearOtherErrors("qty");
    const next = Number.parseInt(qtyDraft, 10);
    if (!Number.isInteger(next) || next <= 0 || next < quantityReceived) {
      qtyAction.setError(
        `${t("orders.qtyErrorMin", locale)} ${Math.max(1, quantityReceived)}`,
      );
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
    clearOtherErrors("receive");
    const amount = Number.parseInt(receiveDraft, 10);
    if (!Number.isInteger(amount) || amount <= 0) {
      receiveAction.setError(t("orders.qtyErrorPositive", locale));
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
      // Refetches the server-rendered overview so an order that just became
      // fully received (and dropped off the open-orders list) disappears
      // without a manual reload.
      router.refresh();
    });
  }

  function confirmRemove() {
    clearOtherErrors("remove");
    removeAction.run(async () => {
      await apiSend(`/api/admin/orders/lines/${line.id}`, { method: "DELETE" });
      // OrderLineRow doesn't own the lines array (OrderLinesTable does) —
      // refetch the server-rendered overview so the removed line's row is
      // gone, same pattern as confirmReceive above.
      router.refresh();
    });
  }

  const status = lineStatus({ quantityOrdered, quantityReceived });
  const remaining = quantityOrdered - quantityReceived;
  // Only one action can be safely in flight at a time (see the comment on
  // clearOtherErrors above) — an admin triggering two of these before either
  // resolves could otherwise leave two errors set simultaneously, with
  // nothing to say which one is current. Disabling every trigger while any
  // one action is pending prevents that at the source instead of trying to
  // reconcile it after the fact.
  const anyPending = qtyAction.pending || receiveAction.pending || removeAction.pending;

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
          aria-label={`${t("orders.qtyOrderedFor", locale)} ${line.title}`}
          disabled={anyPending || status === "received"}
          className="w-16 rounded border border-admin-hairline px-2 py-1 text-sm tabular-nums"
        />
      </td>
      <td className="px-3 py-2 text-admin-ink-muted">
        {new Date(line.createdAt).toLocaleDateString()}
      </td>
      <td className="px-3 py-2">
        <span
          className={`whitespace-nowrap rounded px-1.5 py-0.5 text-xs ${
            status === "received"
              ? "bg-green-500/15 text-green-400"
              : status === "partial"
                ? "bg-amber-500/15 text-amber-400"
                : "bg-admin-raised text-admin-ink-muted"
          }`}
        >
          {supplyOrderStatusLabel(status.toUpperCase() as SupplyOrderStatus, locale)}
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
              aria-label={`${t("orders.qtyReceivedFor", locale)} ${line.title}`}
              className="w-14 rounded border border-admin-hairline px-2 py-1 text-sm tabular-nums"
            />
            <button
              type="button"
              onClick={confirmReceive}
              disabled={anyPending}
              className="rounded border border-admin-hairline px-2 py-1 text-xs hover:bg-admin-raised"
            >
              {receiveAction.pending ? "…" : t("common.confirm", locale)}
            </button>
            <button
              type="button"
              onClick={() => setReceiving(false)}
              className="text-xs text-admin-ink-muted hover:underline"
            >
              {t("common.cancel", locale)}
            </button>
          </span>
        ) : (
          <button
            type="button"
            onClick={() => {
              setReceiveDraft(String(remaining));
              setReceiving(true);
            }}
            disabled={anyPending}
            className="rounded border border-admin-hairline px-2 py-1 text-xs hover:bg-admin-raised"
          >
            {t("orders.markReceived", locale)}
          </button>
        )}
        {/* Undo for a mis-clicked quick-add. Gated client-side on both
            quantityReceived === 0 and the parent order still being PENDING,
            to avoid a guaranteed-409 round trip once a sibling line has been
            partially received. The server's DELETE guard (same two checks)
            stays authoritative — this is purely a UX shortcut. */}
        {quantityReceived === 0 &&
          line.orderStatus === "PENDING" &&
          (confirmingRemove ? (
            <span className="ml-2 inline-flex items-center gap-1">
              <button
                type="button"
                onClick={confirmRemove}
                disabled={anyPending}
                className="text-xs text-red-400 hover:underline disabled:opacity-50"
              >
                {removeAction.pending ? "…" : t("common.confirm", locale)}
              </button>
              <button
                type="button"
                onClick={() => setConfirmingRemove(false)}
                className="text-xs text-admin-ink-muted hover:underline"
              >
                {t("common.cancel", locale)}
              </button>
            </span>
          ) : (
            <button
              type="button"
              onClick={() => setConfirmingRemove(true)}
              disabled={anyPending}
              className="ml-2 text-xs text-red-400 hover:underline disabled:opacity-50"
            >
              {t("common.remove", locale)}
            </button>
          ))}
        {(qtyAction.error || receiveAction.error || removeAction.error) && (
          <p role="alert" className="mt-1 text-xs text-red-400">
            {qtyAction.error ?? receiveAction.error ?? removeAction.error}
          </p>
        )}
      </td>
    </tr>
  );
}
