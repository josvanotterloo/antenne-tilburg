// app/api/admin/orders/sent-survives-partial-receive.test.ts
//
// Regression test for the bug this task fixes: when "sent" was itself a
// SupplyOrderStatus value, the per-line receive route always overwrote
// `status` (to PARTIAL/RECEIVED), which silently cleared SENT. Now that
// "sent" lives in its own `sentAt` column, receiving must not touch it.
// This drives both routes against one shared fake SupplyOrder record to
// prove that end to end, rather than relying on each route's isolated
// unit tests to imply it.
// @vitest-environment node
import { describe, it, expect, vi, beforeEach, type Mock } from "vitest";

vi.mock("@/lib/api-auth", () => ({ requireAdmin: vi.fn().mockResolvedValue(null) }));
vi.mock("@/lib/stock", () => ({ applyStockTransaction: vi.fn() }));
vi.mock("@/lib/db", () => ({
  db: {
    supplyOrder: { findUnique: vi.fn(), update: vi.fn() },
    supplyOrderLine: { findUnique: vi.fn() },
    $transaction: vi.fn(),
  },
}));

import { db } from "@/lib/db";
import { applyStockTransaction } from "@/lib/stock";
import { PATCH as markSent } from "@/app/api/admin/orders/[id]/route";
import { PATCH as receiveLine } from "@/app/api/admin/orders/lines/[id]/receive/route";

const orderDb = db.supplyOrder as unknown as { findUnique: Mock; update: Mock };
const lineDb = db.supplyOrderLine as unknown as { findUnique: Mock };
const mockTransaction = db.$transaction as unknown as Mock;
const mockApply = applyStockTransaction as unknown as Mock;

const ctx = (id: string) => ({ params: Promise.resolve({ id }) });
const patchReq = (body: unknown) =>
  new Request("http://t/x", {
    method: "PATCH",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });

type FakeOrder = { id: string; status: string; sentAt: Date | null };
type FakeLine = {
  id: string;
  productId: string;
  supplyOrderId: string;
  quantityOrdered: number;
  quantityReceived: number;
};

// One shared, mutable pair of records simulating the row both routes act
// on — a real DB would obviously back this, but the point of this test is
// the interaction between the two routes' writes, not persistence itself.
let order: FakeOrder;
let line: FakeLine;

const tx = {
  supplyOrderLine: {
    update: vi.fn(({ data }: { data: { quantityReceived: { increment: number } } }) => {
      line = { ...line, quantityReceived: line.quantityReceived + data.quantityReceived.increment };
      return Promise.resolve(line);
    }),
    findMany: vi.fn(() => Promise.resolve([line])),
  },
  supplyOrder: {
    update: vi.fn(({ data }: { data: Partial<FakeOrder> }) => {
      order = { ...order, ...data };
      return Promise.resolve(order);
    }),
  },
};

beforeEach(() => {
  vi.clearAllMocks();
  order = { id: "o1", status: "PENDING", sentAt: null };
  line = { id: "l1", productId: "p1", supplyOrderId: "o1", quantityOrdered: 5, quantityReceived: 0 };

  orderDb.findUnique.mockImplementation(() => Promise.resolve(order));
  orderDb.update.mockImplementation(({ data }: { data: Partial<FakeOrder> }) => {
    order = { ...order, ...data };
    return Promise.resolve(order);
  });
  lineDb.findUnique.mockImplementation(() => Promise.resolve(line));
  mockTransaction.mockImplementation((fn: (tx: unknown) => unknown) => fn(tx));
  mockApply.mockResolvedValue({ ok: true, transaction: {}, quantity: 1, appliedQuantity: 3 });
});

describe("marking an order sent survives a later partial receive", () => {
  it("keeps the original sentAt unchanged after receiving one of its lines", async () => {
    const sentRes = await markSent(patchReq({ status: "SENT" }), ctx("o1"));
    expect(sentRes.status).toBe(200);
    const sentAtAfterMark = order.sentAt;
    expect(sentAtAfterMark).not.toBeNull();

    const receiveRes = await receiveLine(patchReq({ quantityReceived: 3 }), ctx("l1"));
    expect(receiveRes.status).toBe(200);

    // The receive route only ever moves the order to PARTIAL/RECEIVED — it
    // must never touch sentAt.
    expect(order.status).toBe("PARTIAL");
    expect(order.sentAt).not.toBeNull();
    expect(order.sentAt).toEqual(sentAtAfterMark);
  });
});
