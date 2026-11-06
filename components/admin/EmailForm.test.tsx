import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";

const refresh = vi.fn();
vi.mock("next/navigation", () => ({
  useRouter: () => ({ refresh }),
}));

import { EmailForm } from "@/components/admin/EmailForm";

beforeEach(() => {
  vi.restoreAllMocks();
  refresh.mockClear();
});

describe("EmailForm", () => {
  it("renders Dutch chrome and saves the new email", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({ id: "u1", email: "new@b.c" }),
      }),
    );
    render(<EmailForm userId="u1" email="old@b.c" locale="NL" />);

    expect(screen.getByRole("heading", { name: "E-mail" })).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "E-mail wijzigen" }));

    expect(await screen.findByText("E-mail bijgewerkt.")).toBeInTheDocument();
    expect(refresh).toHaveBeenCalled();
  });

  it("renders English chrome when locale is EN", () => {
    render(<EmailForm userId="u1" email="old@b.c" locale="EN" />);
    expect(screen.getByRole("heading", { name: "Email" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Change email" })).toBeInTheDocument();
  });

  it("translates a known API error for display", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: false,
        json: async () => ({ error: "That email is already in use" }),
      }),
    );
    render(<EmailForm userId="u1" email="old@b.c" locale="NL" />);
    fireEvent.click(screen.getByRole("button", { name: "E-mail wijzigen" }));

    await waitFor(() =>
      expect(screen.getByRole("alert")).toHaveTextContent(
        "Dat e-mailadres is al in gebruik",
      ),
    );
  });
});
