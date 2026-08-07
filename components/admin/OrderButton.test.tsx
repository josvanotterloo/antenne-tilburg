import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

import { OrderButton } from "@/components/admin/OrderButton";

beforeEach(() => {
  vi.restoreAllMocks();
});

describe("OrderButton", () => {
  it("is disabled with a 'No supplier linked' title when hasSupplier is false", () => {
    render(<OrderButton productId="p1" hasSupplier={false} initiallyOrdered={false} />);
    const button = screen.getByRole("button", { name: /order/i });
    expect(button).toBeDisabled();
    expect(button).toHaveAttribute("title", "No supplier linked");
  });

  it("renders a disabled 'Ordered' button when initiallyOrdered is true", () => {
    render(<OrderButton productId="p1" hasSupplier initiallyOrdered />);
    const button = screen.getByRole("button", { name: /ordered/i });
    expect(button).toBeDisabled();
  });

  it("quick-adds on click and flips to a disabled 'Ordered' state", async () => {
    const user = userEvent.setup();
    vi.spyOn(global, "fetch").mockResolvedValue({
      ok: true,
      json: async () => ({ id: "l1" }),
    } as Response);
    render(<OrderButton productId="p1" hasSupplier initiallyOrdered={false} />);

    await user.click(screen.getByRole("button", { name: /^order$/i }));

    expect(global.fetch).toHaveBeenCalledWith(
      "/api/admin/orders/quick-add",
      expect.objectContaining({
        method: "POST",
        body: JSON.stringify({ productId: "p1" }),
      }),
    );
    await waitFor(() => {
      expect(screen.getByRole("button", { name: /ordered/i })).toBeDisabled();
    });
  });

  it("shows an error and stays clickable when the quick-add fails", async () => {
    const user = userEvent.setup();
    vi.spyOn(global, "fetch").mockResolvedValue({
      ok: false,
      json: async () => ({ error: "Product already in open order" }),
    } as Response);
    render(<OrderButton productId="p1" hasSupplier initiallyOrdered={false} />);

    await user.click(screen.getByRole("button", { name: /^order$/i }));

    expect(await screen.findByRole("alert")).toHaveTextContent("Product already in open order");
    expect(screen.getByRole("button", { name: /^order$/i })).not.toBeDisabled();
  });
});
