import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

const push = vi.fn();
const refresh = vi.fn();
vi.mock("next/navigation", () => ({ useRouter: () => ({ push, refresh }) }));

import { SupplierForm } from "@/components/admin/SupplierForm";

beforeEach(() => vi.clearAllMocks());

describe("SupplierForm", () => {
  it("renders Dutch field labels and the Dutch create button by default", () => {
    render(<SupplierForm locale="NL" />);
    expect(screen.getByRole("textbox", { name: "Naam" })).toBeInTheDocument();
    expect(screen.getByRole("textbox", { name: "Contact (optioneel)" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Leverancier aanmaken" })).toBeInTheDocument();
  });

  it("renders English field labels and button when locale is EN", () => {
    render(<SupplierForm locale="EN" />);
    expect(screen.getByRole("textbox", { name: "Name" })).toBeInTheDocument();
    expect(screen.getByRole("textbox", { name: "Contact (optional)" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Create supplier" })).toBeInTheDocument();
  });

  it("submits and returns to the supplier list", async () => {
    const user = userEvent.setup();
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: true, json: async () => ({ ok: true }) }));

    render(<SupplierForm locale="NL" />);
    await user.type(screen.getByRole("textbox", { name: "Naam" }), "Kalahari Oyster Cult");
    await user.click(screen.getByRole("button", { name: "Leverancier aanmaken" }));

    await waitFor(() => expect(push).toHaveBeenCalledWith("/admin/catalog/suppliers"));
  });

  it("edit mode PATCHes the existing supplier and shows the Dutch 'save changes' label", async () => {
    const user = userEvent.setup();
    const fetchMock = vi.fn().mockResolvedValue({ ok: true, json: async () => ({ ok: true }) });
    vi.stubGlobal("fetch", fetchMock);

    render(<SupplierForm locale="NL" supplier={{ id: "s1", name: "X", contact: "ask Jules" }} />);
    expect(screen.getByRole("button", { name: "Wijzigingen opslaan" })).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Wijzigingen opslaan" }));

    await waitFor(() =>
      expect(fetchMock).toHaveBeenCalledWith(
        "/api/admin/suppliers/s1",
        expect.objectContaining({ method: "PATCH" }),
      ),
    );
  });
});
