import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

vi.mock("next/navigation", () => ({
  useRouter: () => ({ refresh: vi.fn(), push: vi.fn() }),
}));

import { SupplierOrderGroup } from "@/components/admin/SupplierOrderGroup";
import type { OrderLineRowData } from "@/components/admin/OrderLineRow";

const LINE: OrderLineRowData = {
  id: "l1",
  productId: "p1",
  quantityOrdered: 5,
  quantityReceived: 0,
  orderStatus: "PENDING",
  createdAt: "2026-08-03T10:00:00.000Z",
  title: "Torus",
  catalogNumber: "ZR-001",
  labelName: "Zulema",
  productTypeName: "LP",
  artistNames: "Vril",
};

beforeEach(() => vi.restoreAllMocks());

describe("SupplierOrderGroup", () => {
  it("shows the supplier name and an enabled 'Mark all as sent' button for a PENDING order", () => {
    render(
      <SupplierOrderGroup
        supplierName="Beta Distro"
        orderId="o1"
        orderStatus="PENDING"
        sentAt={null}
        lines={[LINE]}
      />,
    );
    expect(screen.getByText("Beta Distro")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /mark all as sent/i })).not.toBeDisabled();
  });

  it("disables the export PDF button with a 'Coming soon' title", () => {
    render(
      <SupplierOrderGroup
        supplierName="Beta Distro"
        orderId="o1"
        orderStatus="PENDING"
        sentAt={null}
        lines={[LINE]}
      />,
    );
    const exportButton = screen.getByRole("button", { name: /export pdf/i });
    expect(exportButton).toBeDisabled();
    expect(exportButton).toHaveAttribute("title", "Coming soon");
  });

  it("marks the order sent on click and disables the button", async () => {
    const user = userEvent.setup();
    vi.spyOn(global, "fetch").mockResolvedValue({
      ok: true,
      json: async () => ({ id: "o1", status: "PENDING", sentAt: "2026-08-06T12:00:00.000Z" }),
    } as Response);
    render(
      <SupplierOrderGroup
        supplierName="Beta Distro"
        orderId="o1"
        orderStatus="PENDING"
        sentAt={null}
        lines={[LINE]}
      />,
    );

    await user.click(screen.getByRole("button", { name: /mark all as sent/i }));

    expect(global.fetch).toHaveBeenCalledWith(
      "/api/admin/orders/o1",
      expect.objectContaining({
        method: "PATCH",
        body: JSON.stringify({ status: "SENT" }),
      }),
    );
    await waitFor(() => {
      expect(screen.getByRole("button", { name: /^sent$/i })).toBeDisabled();
    });
  });

  it("starts already disabled when sentAt is already set", () => {
    render(
      <SupplierOrderGroup
        supplierName="Beta Distro"
        orderId="o1"
        orderStatus="PARTIAL"
        sentAt="2026-08-01T09:00:00.000Z"
        lines={[LINE]}
      />,
    );
    expect(screen.getByRole("button", { name: /^sent$/i })).toBeDisabled();
  });
});
