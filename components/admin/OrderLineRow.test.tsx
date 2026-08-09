import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

const refresh = vi.fn();
vi.mock("next/navigation", () => ({
  useRouter: () => ({ refresh, push: vi.fn() }),
}));

import { OrderLineRow, type OrderLineRowData } from "@/components/admin/OrderLineRow";
import { AUTO_PRINT_STORAGE_KEY } from "@/components/admin/AutoPrintToggle";

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

function renderRow(line: OrderLineRowData = LINE) {
  return render(
    <table>
      <tbody>
        <OrderLineRow line={line} />
      </tbody>
    </table>,
  );
}

beforeEach(() => {
  vi.restoreAllMocks();
  localStorage.clear();
  refresh.mockClear();
});

describe("OrderLineRow", () => {
  it("shows pending status and a 'Mark received' action for an unreceived line", () => {
    renderRow();
    expect(screen.getByText(/pending/i)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /mark received/i })).toBeInTheDocument();
  });

  it("shows partial status for a partly-received line", () => {
    renderRow({ ...LINE, quantityReceived: 2 });
    expect(screen.getByText(/partial/i)).toBeInTheDocument();
  });

  it("does not show a 'Mark received' button for a fully received line", () => {
    renderRow({ ...LINE, quantityReceived: 5 });
    expect(screen.queryByRole("button", { name: /mark received/i })).not.toBeInTheDocument();
  });

  it("saves an edited quantity on blur", async () => {
    const user = userEvent.setup();
    vi.spyOn(global, "fetch").mockResolvedValue({
      ok: true,
      json: async () => ({ id: "l1", quantityOrdered: 8 }),
    } as Response);
    renderRow();
    const input = screen.getByLabelText(/quantity ordered for torus/i);
    await user.clear(input);
    await user.type(input, "8");
    await user.tab();
    await waitFor(() => {
      expect(global.fetch).toHaveBeenCalledWith(
        "/api/admin/orders/lines/l1",
        expect.objectContaining({
          method: "PATCH",
          body: JSON.stringify({ quantityOrdered: 8 }),
        }),
      );
    });
  });

  it("shows an inline error and does not call the API when editing quantity to zero", async () => {
    const user = userEvent.setup();
    const fetchSpy = vi.spyOn(global, "fetch");
    renderRow();
    const input = screen.getByLabelText(/quantity ordered for torus/i);
    await user.clear(input);
    await user.type(input, "0");
    await user.tab();

    expect(await screen.findByRole("alert")).toBeInTheDocument();
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it("calls router.refresh() after a successful receive", async () => {
    const user = userEvent.setup();
    vi.spyOn(global, "fetch").mockResolvedValue({ ok: true, json: async () => ({}) } as Response);
    renderRow();

    await user.click(screen.getByRole("button", { name: /mark received/i }));
    await user.click(screen.getByRole("button", { name: /confirm/i }));

    await waitFor(() => {
      expect(refresh).toHaveBeenCalled();
    });
  });

  it("marking received defaults the qty input to the remaining amount and confirms", async () => {
    const user = userEvent.setup();
    vi.spyOn(global, "fetch").mockResolvedValue({
      ok: true,
      json: async () => ({}),
    } as Response);
    renderRow({ ...LINE, quantityOrdered: 5, quantityReceived: 2 });

    await user.click(screen.getByRole("button", { name: /mark received/i }));
    expect(screen.getByLabelText(/quantity received for torus/i)).toHaveValue(3);

    await user.click(screen.getByRole("button", { name: /confirm/i }));
    await waitFor(() => {
      expect(global.fetch).toHaveBeenCalledWith(
        "/api/admin/orders/lines/l1/receive",
        expect.objectContaining({
          method: "PATCH",
          body: JSON.stringify({ quantityReceived: 3 }),
        }),
      );
    });
  });

  it("opens the label print URL after a successful receive when auto-print is on", async () => {
    localStorage.setItem(AUTO_PRINT_STORAGE_KEY, "true");
    const user = userEvent.setup();
    vi.spyOn(global, "fetch").mockResolvedValue({ ok: true, json: async () => ({}) } as Response);
    const openSpy = vi.spyOn(window, "open").mockImplementation(() => null);
    renderRow();

    await user.click(screen.getByRole("button", { name: /mark received/i }));
    await user.click(screen.getByRole("button", { name: /confirm/i }));

    await waitFor(() => {
      expect(openSpy).toHaveBeenCalledWith("/api/admin/label/p1", "_blank", "noopener,noreferrer");
    });
  });

  it("does not open a print URL when auto-print is off", async () => {
    const user = userEvent.setup();
    vi.spyOn(global, "fetch").mockResolvedValue({ ok: true, json: async () => ({}) } as Response);
    const openSpy = vi.spyOn(window, "open").mockImplementation(() => null);
    renderRow();

    await user.click(screen.getByRole("button", { name: /mark received/i }));
    await user.click(screen.getByRole("button", { name: /confirm/i }));

    await waitFor(() => {
      expect(global.fetch).toHaveBeenCalledWith(
        "/api/admin/orders/lines/l1/receive",
        expect.anything(),
      );
    });
    expect(openSpy).not.toHaveBeenCalled();
  });

  it("removes a line via the two-click confirm flow and refreshes", async () => {
    const user = userEvent.setup();
    vi.spyOn(global, "fetch").mockResolvedValue({
      ok: true,
      json: async () => ({ ok: true }),
    } as Response);
    renderRow();

    expect(screen.queryByRole("button", { name: /^confirm$/i })).not.toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: /remove/i }));
    expect(screen.getByRole("button", { name: /cancel/i })).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: /^confirm$/i }));

    await waitFor(() => {
      expect(global.fetch).toHaveBeenCalledWith(
        "/api/admin/orders/lines/l1",
        expect.objectContaining({ method: "DELETE" }),
      );
    });
    await waitFor(() => {
      expect(refresh).toHaveBeenCalled();
    });
  });

  it("does not render a Remove button once any quantity has been received", () => {
    renderRow({ ...LINE, quantityReceived: 2 });
    expect(screen.queryByRole("button", { name: /remove/i })).not.toBeInTheDocument();
  });

  it("does not render a Remove button when the parent order is no longer PENDING, even with quantityReceived 0", () => {
    renderRow({ ...LINE, quantityReceived: 0, orderStatus: "PARTIAL" });
    expect(screen.queryByRole("button", { name: /remove/i })).not.toBeInTheDocument();
  });

  it("disables the quantity input and Remove button while a receive is still in flight", async () => {
    const user = userEvent.setup();
    let resolveFetch!: (value: Response) => void;
    vi.spyOn(global, "fetch").mockReturnValue(
      new Promise<Response>((resolve) => {
        resolveFetch = resolve;
      }),
    );
    renderRow();

    await user.click(screen.getByRole("button", { name: /mark received/i }));
    await user.click(screen.getByRole("button", { name: /^confirm$/i }));

    await waitFor(() => {
      expect(screen.getByLabelText(/quantity ordered for torus/i)).toBeDisabled();
    });
    expect(screen.getByRole("button", { name: /remove/i })).toBeDisabled();

    // Let the in-flight receive resolve so it doesn't leak into other tests
    // (this line receives its full remaining quantity, so the quantity
    // input stays disabled afterwards for the unrelated "received" reason —
    // assert on the receiving UI closing instead, to flush the pending
    // state change cleanly without conflating the two disabled reasons).
    resolveFetch({ ok: true, json: async () => ({}) } as Response);
    await waitFor(() => {
      expect(screen.queryByRole("button", { name: /^confirm$/i })).not.toBeInTheDocument();
    });
  });

  it("shows an inline error and keeps the row when the server rejects the remove", async () => {
    const user = userEvent.setup();
    vi.spyOn(global, "fetch").mockResolvedValue({
      ok: false,
      json: async () => ({ error: "Cannot remove a line once the order is partially or fully received." }),
    } as Response);
    renderRow();

    await user.click(screen.getByRole("button", { name: /remove/i }));
    await user.click(screen.getByRole("button", { name: /^confirm$/i }));

    expect(
      await screen.findByText(/cannot remove a line once the order is partially or fully received/i),
    ).toBeInTheDocument();
    expect(screen.getByText("Torus")).toBeInTheDocument();
  });

  it("shows the remove error, not a stale quantity error, when remove fails after an earlier quantity-validation error", async () => {
    const user = userEvent.setup();
    renderRow();

    // First, trigger a client-side quantity-validation error (no fetch involved).
    const qtyInput = screen.getByLabelText(/quantity ordered for torus/i);
    await user.clear(qtyInput);
    await user.type(qtyInput, "0");
    await user.tab();
    expect(
      await screen.findByText(/quantity must be a whole number/i),
    ).toBeInTheDocument();

    // Then trigger a remove that fails with a different, later error.
    vi.spyOn(global, "fetch").mockResolvedValue({
      ok: false,
      json: async () => ({ error: "Cannot remove a line once it has received quantity." }),
    } as Response);
    await user.click(screen.getByRole("button", { name: /remove/i }));
    await user.click(screen.getByRole("button", { name: /^confirm$/i }));

    expect(
      await screen.findByText(/cannot remove a line once it has received quantity/i),
    ).toBeInTheDocument();
    expect(screen.queryByText(/quantity must be a whole number/i)).not.toBeInTheDocument();
  });
});
