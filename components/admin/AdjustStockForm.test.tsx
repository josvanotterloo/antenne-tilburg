import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

import { AdjustStockForm } from "@/components/admin/AdjustStockForm";

beforeEach(() => vi.restoreAllMocks());

describe("AdjustStockForm", () => {
  it("is collapsed by default, showing only the trigger button", () => {
    render(<AdjustStockForm productId="p1" onAdjusted={vi.fn()} />);
    expect(screen.getByRole("button", { name: /adjust stock/i })).toBeInTheDocument();
    expect(screen.queryByLabelText(/reason/i)).toBeNull();
  });

  it("submits a delta with no reason prompt and calls onAdjusted with the new quantity", async () => {
    const user = userEvent.setup();
    const onAdjusted = vi.fn();
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({ quantity: 7, appliedQuantity: 2, clamped: false }),
      }),
    );

    render(<AdjustStockForm productId="p1" onAdjusted={onAdjusted} />);
    await user.click(screen.getByRole("button", { name: /adjust stock/i }));
    await user.type(screen.getByLabelText(/quantity delta/i), "2");
    fireEvent.click(screen.getByRole("button", { name: /save adjustment/i }));

    await waitFor(() => expect(onAdjusted).toHaveBeenCalledWith(7));
  });

  it("shows a visible error when the adjustment fails", async () => {
    const user = userEvent.setup();
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({ ok: false, json: async () => ({ error: "Delta must be a non-zero whole number" }) }),
    );

    render(<AdjustStockForm productId="p1" onAdjusted={vi.fn()} />);
    await user.click(screen.getByRole("button", { name: /adjust stock/i }));
    await user.type(screen.getByLabelText(/quantity delta/i), "1");
    fireEvent.click(screen.getByRole("button", { name: /save adjustment/i }));

    expect(await screen.findByRole("alert")).toHaveTextContent(/delta must be a non-zero whole number/i);
  });
});
