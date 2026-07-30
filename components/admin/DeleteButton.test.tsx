import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";

const refresh = vi.fn();
const push = vi.fn();
vi.mock("next/navigation", () => ({
  useRouter: () => ({ refresh, push }),
}));

import { DeleteButton } from "@/components/admin/DeleteButton";

beforeEach(() => {
  vi.restoreAllMocks();
  refresh.mockClear();
  push.mockClear();
});

const confirmDelete = () => {
  fireEvent.click(screen.getByRole("button", { name: /^delete$/i }));
  fireEvent.click(screen.getByRole("button", { name: /^confirm$/i }));
};

describe("DeleteButton", () => {
  it("deletes and refreshes on success", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({ ok: true, json: async () => ({}) }),
    );
    render(<DeleteButton endpoint="/api/admin/notices/n1" />);
    confirmDelete();
    await vi.waitFor(() => expect(refresh).toHaveBeenCalled());
  });

  it("shows a visible error (and does not refresh) when the delete fails", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: false,
        json: async () => ({ error: "In use by 3 products" }),
      }),
    );
    render(<DeleteButton endpoint="/api/admin/labels/l1" />);
    confirmDelete();

    expect(await screen.findByRole("alert")).toHaveTextContent(
      /in use by 3 products/i,
    );
    expect(refresh).not.toHaveBeenCalled();
  });

  it("surfaces a connection error when the network is down", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockRejectedValue(new TypeError("Failed to fetch")),
    );
    render(<DeleteButton endpoint="/api/admin/notices/n1" />);
    confirmDelete();

    expect(await screen.findByRole("alert")).toHaveTextContent(
      /reach the server/i,
    );
  });

  it("pushes to redirectTo (and does not refresh) when set and the delete succeeds", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({ ok: true, json: async () => ({}) }),
    );
    render(
      <DeleteButton
        endpoint="/api/admin/orders/o1"
        redirectTo="/admin/catalog/orders"
      />,
    );
    confirmDelete();

    await vi.waitFor(() =>
      expect(push).toHaveBeenCalledWith("/admin/catalog/orders"),
    );
    expect(refresh).not.toHaveBeenCalled();
  });

  it("refreshes (and does not push) when redirectTo is not set", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({ ok: true, json: async () => ({}) }),
    );
    render(<DeleteButton endpoint="/api/admin/notices/n1" />);
    confirmDelete();

    await vi.waitFor(() => expect(refresh).toHaveBeenCalled());
    expect(push).not.toHaveBeenCalled();
  });
});
