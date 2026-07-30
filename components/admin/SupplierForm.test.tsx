import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

const push = vi.fn();
const refresh = vi.fn();
vi.mock("next/navigation", () => ({ useRouter: () => ({ push, refresh }) }));

import { SupplierForm } from "@/components/admin/SupplierForm";

beforeEach(() => vi.clearAllMocks());

describe("SupplierForm", () => {
  it("renders name and contact fields", () => {
    render(<SupplierForm />);
    expect(screen.getByRole("textbox", { name: /name/i })).toBeInTheDocument();
    expect(screen.getByRole("textbox", { name: /contact/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /create supplier/i })).toBeInTheDocument();
  });

  it("submits and returns to the supplier list", async () => {
    const user = userEvent.setup();
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: true, json: async () => ({ ok: true }) }));

    render(<SupplierForm />);
    await user.type(screen.getByRole("textbox", { name: /name/i }), "Kalahari Oyster Cult");
    await user.click(screen.getByRole("button", { name: /create supplier/i }));

    await waitFor(() => expect(push).toHaveBeenCalledWith("/admin/settings/suppliers"));
  });

  it("edit mode PATCHes the existing supplier and shows 'Save changes'", async () => {
    const user = userEvent.setup();
    const fetchMock = vi.fn().mockResolvedValue({ ok: true, json: async () => ({ ok: true }) });
    vi.stubGlobal("fetch", fetchMock);

    render(<SupplierForm supplier={{ id: "s1", name: "X", contact: "ask Jules" }} />);
    expect(screen.getByRole("button", { name: /save changes/i })).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: /save changes/i }));

    await waitFor(() =>
      expect(fetchMock).toHaveBeenCalledWith(
        "/api/admin/suppliers/s1",
        expect.objectContaining({ method: "PATCH" }),
      ),
    );
  });
});
