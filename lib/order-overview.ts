import type { SupplyOrderStatus } from "@prisma/client";

import { db } from "@/lib/db";
import { weekRange } from "@/lib/catalog";

export type GroupBy = "supplier" | "date" | "flat";

export interface OpenOrderLine {
  id: string;
  quantityOrdered: number;
  quantityReceived: number;
  createdAt: Date;
  supplyOrder: {
    id: string;
    status: SupplyOrderStatus;
    sentAt: Date | null;
    supplier: { id: string; name: string };
  };
  product: {
    id: string;
    title: string;
    catalogNumber: string | null;
    label: { name: string };
    productType: { name: string };
    productArtists: { position: number; artist: { name: string } }[];
  };
}

export interface SupplierGroup {
  supplier: { id: string; name: string };
  order: { id: string; status: SupplyOrderStatus; sentAt: Date | null };
  lines: OpenOrderLine[];
}

export interface WeekGroup {
  weekStart: Date;
  lines: OpenOrderLine[];
}

export type GroupedOrders =
  | { groupBy: "supplier"; groups: SupplierGroup[] }
  | { groupBy: "date"; groups: WeekGroup[] }
  | { groupBy: "flat"; lines: OpenOrderLine[] };

// Every line whose parent order isn't yet fully received — the admin's
// "what's outstanding" view. Once an order is RECEIVED it drops out; its
// history lives in the monthly transactions ledger instead.
export async function getOpenOrderLines(groupBy: GroupBy): Promise<GroupedOrders> {
  const lines = (await db.supplyOrderLine.findMany({
    where: { supplyOrder: { status: { not: "RECEIVED" } } },
    orderBy: { createdAt: "desc" },
    include: {
      supplyOrder: { include: { supplier: true } },
      product: {
        include: {
          label: true,
          productType: true,
          productArtists: { include: { artist: true }, orderBy: { position: "asc" } },
        },
      },
    },
  })) as OpenOrderLine[];

  if (groupBy === "flat") {
    return { groupBy: "flat", lines };
  }

  if (groupBy === "supplier") {
    const bySupplier = new Map<string, SupplierGroup>();
    for (const line of lines) {
      const supplierId = line.supplyOrder.supplier.id;
      let group = bySupplier.get(supplierId);
      if (!group) {
        group = {
          supplier: line.supplyOrder.supplier,
          order: {
            id: line.supplyOrder.id,
            status: line.supplyOrder.status,
            sentAt: line.supplyOrder.sentAt,
          },
          lines: [],
        };
        bySupplier.set(supplierId, group);
      }
      group.lines.push(line);
    }
    const groups = [...bySupplier.values()].sort((a, b) =>
      a.supplier.name.localeCompare(b.supplier.name),
    );
    return { groupBy: "supplier", groups };
  }

  const byWeekStart = new Map<number, WeekGroup>();
  for (const line of lines) {
    const { start } = weekRange(0, line.createdAt);
    const key = start.getTime();
    let group = byWeekStart.get(key);
    if (!group) {
      group = { weekStart: start, lines: [] };
      byWeekStart.set(key, group);
    }
    group.lines.push(line);
  }
  const groups = [...byWeekStart.values()].sort(
    (a, b) => b.weekStart.getTime() - a.weekStart.getTime(),
  );
  return { groupBy: "date", groups };
}
