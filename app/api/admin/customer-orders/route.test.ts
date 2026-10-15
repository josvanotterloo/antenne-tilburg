// @vitest-environment node
import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@/lib/api-auth", () => ({ requireAdmin: vi.fn() }));
vi.mock("@/lib/customer-orders", async () => {
  const actual = await vi.importActual<typeof import("@/lib/customer-orders")>(
    "@/lib/customer-orders",
  );
  return {
    ...actual,
    readCustomerOrders: vi.fn(),
    writeCustomerOrders: vi.fn(),
  };
});

import { GET, POST } from "@/app/api/admin/customer-orders/route";
import { requireAdmin } from "@/lib/api-auth";
import {
  readCustomerOrders,
  writeCustomerOrders,
  MAX_CUSTOMER_ORDERS_BYTES,
} from "@/lib/customer-orders";
import { NextResponse } from "next/server";

const mockRequireAdmin = vi.mocked(requireAdmin);
const mockReadCustomerOrders = vi.mocked(readCustomerOrders);
const mockWriteCustomerOrders = vi.mocked(writeCustomerOrders);

function post(body: unknown) {
  return POST(
    new Request("http://localhost/api/admin/customer-orders", {
      method: "POST",
      body: typeof body === "string" ? body : JSON.stringify(body),
    }),
  );
}

beforeEach(() => {
  vi.clearAllMocks();
  mockRequireAdmin.mockResolvedValue(null);
  mockWriteCustomerOrders.mockResolvedValue(undefined);
});

describe("GET /api/admin/customer-orders", () => {
  it("returns the current content", async () => {
    mockReadCustomerOrders.mockResolvedValue("## Customer Orders\n- [ ] Vril");

    const res = await GET();

    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({
      content: "## Customer Orders\n- [ ] Vril",
    });
  });

  it("401s when not an admin, without reading the file", async () => {
    mockRequireAdmin.mockResolvedValue(
      NextResponse.json({ error: "Unauthorized" }, { status: 401 }),
    );

    const res = await GET();

    expect(res.status).toBe(401);
    expect(mockReadCustomerOrders).not.toHaveBeenCalled();
  });
});

describe("POST /api/admin/customer-orders", () => {
  it("writes the content and returns ok", async () => {
    const res = await post({ content: "## updated notes" });

    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ ok: true });
    expect(mockWriteCustomerOrders).toHaveBeenCalledWith("## updated notes");
  });

  it("400s when content is not a string, without writing", async () => {
    const res = await post({ content: 123 });

    expect(res.status).toBe(400);
    expect(mockWriteCustomerOrders).not.toHaveBeenCalled();
  });

  it("400s when content is missing entirely, without writing", async () => {
    const res = await post({});

    expect(res.status).toBe(400);
    expect(mockWriteCustomerOrders).not.toHaveBeenCalled();
  });

  it("400s when content exceeds the 500KB cap, without writing", async () => {
    const tooBig = "a".repeat(MAX_CUSTOMER_ORDERS_BYTES + 1);

    const res = await post({ content: tooBig });

    expect(res.status).toBe(400);
    expect(mockWriteCustomerOrders).not.toHaveBeenCalled();
  });

  it("accepts content exactly at the 500KB cap", async () => {
    const atCap = "a".repeat(MAX_CUSTOMER_ORDERS_BYTES);

    const res = await post({ content: atCap });

    expect(res.status).toBe(200);
    expect(mockWriteCustomerOrders).toHaveBeenCalledWith(atCap);
  });

  it("400s gracefully on unparseable JSON, without crashing or writing", async () => {
    const res = await post("{not valid json");

    expect(res.status).toBe(400);
    expect(mockWriteCustomerOrders).not.toHaveBeenCalled();
  });

  it("401s when not an admin, without writing anything", async () => {
    mockRequireAdmin.mockResolvedValue(
      NextResponse.json({ error: "Unauthorized" }, { status: 401 }),
    );

    const res = await post({ content: "sneaky write" });

    expect(res.status).toBe(401);
    expect(mockWriteCustomerOrders).not.toHaveBeenCalled();
  });
});
