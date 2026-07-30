import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

const refresh = vi.fn();
vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh }) }));

import { ReceiveOrderForm } from "@/components/admin/ReceiveOrderForm";

const LINES = [
  { id: "l1", productTitle: "Vril — Torus", quantityOrdered: 5, quantityReceived: 2 },
];

beforeEach(() => vi.clearAllMocks());

describe("ReceiveOrderForm", () => {
  it("disables the input for a fully-received line", () => {
    render(
      <ReceiveOrderForm
        orderId="o1"
        lines={[{ id: "l2", productTitle: "X", quantityOrdered: 3, quantityReceived: 3 }]}
      />,
    );
    expect(screen.getByLabelText(/receive now for x/i)).toBeDisabled();
  });

  it("submits only lines with a receiveNow > 0 and refreshes on success", async () => {
    const user = userEvent.setup();
    const fetchMock = vi.fn().mockResolvedValue({ ok: true, json: async () => ({ ok: true }) });
    vi.stubGlobal("fetch", fetchMock);

    render(<ReceiveOrderForm orderId="o1" lines={LINES} />);
    await user.type(screen.getByLabelText(/receive now for vril — torus/i), "3");
    fireEvent.click(screen.getByRole("button", { name: /record receipt/i }));

    await waitFor(() => expect(refresh).toHaveBeenCalled());
    const body = JSON.parse((fetchMock.mock.calls[0][1] as RequestInit).body as string);
    expect(body).toEqual({ lines: [{ supplyOrderLineId: "l1", receiveNow: 3 }] });
  });

  it("shows a visible error when the receive fails", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({ ok: false, json: async () => ({ error: "Cannot receive more than ordered" }) }),
    );
    render(<ReceiveOrderForm orderId="o1" lines={LINES} />);
    fireEvent.click(screen.getByRole("button", { name: /record receipt/i }));
    expect(await screen.findByRole("alert")).toHaveTextContent(/cannot receive more/i);
  });
});
