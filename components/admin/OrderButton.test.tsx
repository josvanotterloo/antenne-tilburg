import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

import { OrderButton } from "@/components/admin/OrderButton";

beforeEach(() => {
  vi.restoreAllMocks();
});

describe("OrderButton", () => {
  it("is disabled with a 'Geen leverancier gekoppeld' title when hasSupplier is false", () => {
    render(
      <OrderButton productId="p1" hasSupplier={false} initiallyOrdered={false} locale="NL" />,
    );
    const button = screen.getByRole("button", { name: /bestellen/i });
    expect(button).toBeDisabled();
    expect(button).toHaveAttribute("title", "Geen leverancier gekoppeld");
  });

  it("renders a disabled 'Besteld' button when initiallyOrdered is true", () => {
    render(<OrderButton productId="p1" hasSupplier initiallyOrdered locale="NL" />);
    const button = screen.getByRole("button", { name: /besteld/i });
    expect(button).toBeDisabled();
  });

  it("quick-adds on click and flips to a disabled 'Besteld' state", async () => {
    const user = userEvent.setup();
    vi.spyOn(global, "fetch").mockResolvedValue({
      ok: true,
      json: async () => ({ id: "l1" }),
    } as Response);
    render(<OrderButton productId="p1" hasSupplier initiallyOrdered={false} locale="NL" />);

    await user.click(screen.getByRole("button", { name: /^bestellen$/i }));

    expect(global.fetch).toHaveBeenCalledWith(
      "/api/admin/orders/quick-add",
      expect.objectContaining({
        method: "POST",
        body: JSON.stringify({ productId: "p1" }),
      }),
    );
    await waitFor(() => {
      expect(screen.getByRole("button", { name: /besteld/i })).toBeDisabled();
    });
  });

  it("shows an error and stays clickable when the quick-add fails", async () => {
    const user = userEvent.setup();
    vi.spyOn(global, "fetch").mockResolvedValue({
      ok: false,
      json: async () => ({ error: "Product already in open order" }),
    } as Response);
    render(<OrderButton productId="p1" hasSupplier initiallyOrdered={false} locale="NL" />);

    await user.click(screen.getByRole("button", { name: /^bestellen$/i }));

    expect(await screen.findByRole("alert")).toHaveTextContent("Product already in open order");
    expect(screen.getByRole("button", { name: /^bestellen$/i })).not.toBeDisabled();
  });

  it("renders the English labels when locale is EN", () => {
    render(<OrderButton productId="p1" hasSupplier={false} initiallyOrdered={false} locale="EN" />);
    const button = screen.getByRole("button", { name: /^order$/i });
    expect(button).toHaveAttribute("title", "No supplier linked");
  });
});
