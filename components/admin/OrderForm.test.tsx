import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

const push = vi.fn();
const refresh = vi.fn();
vi.mock("next/navigation", () => ({ useRouter: () => ({ push, refresh }) }));

import { OrderForm } from "@/components/admin/OrderForm";

beforeEach(() => vi.clearAllMocks());

describe("OrderForm", () => {
  it("renders supplier, dates, notes and one starter line", () => {
    render(<OrderForm />);
    expect(screen.getByRole("combobox", { name: /supplier/i })).toBeInTheDocument();
    expect(screen.getByLabelText(/ordered at/i)).toBeInTheDocument();
    expect(screen.getByRole("combobox", { name: /product 1/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /create order/i })).toBeInTheDocument();
  });

  it("adds and removes lines", async () => {
    const user = userEvent.setup();
    render(<OrderForm />);
    await user.click(screen.getByRole("button", { name: /add line/i }));
    expect(screen.getByRole("combobox", { name: /product 2/i })).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: /remove line 2/i }));
    expect(screen.queryByRole("combobox", { name: /product 2/i })).toBeNull();
  });

  it("the sole remaining line can't be removed", () => {
    render(<OrderForm />);
    expect(screen.getByRole("button", { name: /remove line 1/i })).toBeDisabled();
  });

  it("edit mode PATCHes the existing order and shows 'Save changes'", async () => {
    const user = userEvent.setup();
    const fetchMock = vi.fn().mockResolvedValue({ ok: true, json: async () => ({ ok: true }) });
    vi.stubGlobal("fetch", fetchMock);

    render(
      <OrderForm
        order={{
          id: "o1",
          supplier: { id: "s1", name: "Kalahari Oyster Cult" },
          reference: "PO-1",
          notes: null,
          orderedAt: "2026-07-29T10:00",
          lines: [{ product: { id: "p1", name: "Vril — Torus" }, quantityOrdered: 5 }],
        }}
      />,
    );
    expect(screen.getByRole("button", { name: /save changes/i })).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: /save changes/i }));

    await waitFor(() =>
      expect(fetchMock).toHaveBeenCalledWith(
        "/api/admin/orders/o1",
        expect.objectContaining({ method: "PATCH" }),
      ),
    );
    const body = JSON.parse((fetchMock.mock.calls[0][1] as RequestInit).body as string);
    expect(body.lines).toEqual([{ productId: "p1", quantityOrdered: 5 }]);
  });
});
