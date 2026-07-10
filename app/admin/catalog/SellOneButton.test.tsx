import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";

const refresh = vi.fn();
vi.mock("next/navigation", () => ({
  useRouter: () => ({ refresh, push: vi.fn() }),
}));

import { SellOneButton } from "@/app/admin/catalog/SellOneButton";

beforeEach(() => {
  vi.restoreAllMocks();
  refresh.mockClear();
});

describe("SellOneButton", () => {
  it("is disabled at zero quantity", () => {
    render(<SellOneButton id="p1" quantity={0} />);
    expect(screen.getByRole("button")).toBeDisabled();
  });

  it("sells one and refreshes on success", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({ ok: true, json: async () => ({ quantity: 1 }) }),
    );
    render(<SellOneButton id="p1" quantity={2} />);
    fireEvent.click(screen.getByRole("button", { name: /sell one/i }));
    await vi.waitFor(() => expect(refresh).toHaveBeenCalled());
  });

  it("shows a visible error (and does not refresh) when the sale fails", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: false,
        json: async () => ({ error: "Not found" }),
      }),
    );
    render(<SellOneButton id="p1" quantity={2} />);
    fireEvent.click(screen.getByRole("button", { name: /sell one/i }));

    expect(await screen.findByRole("alert")).toBeInTheDocument();
    expect(refresh).not.toHaveBeenCalled();
  });
});
