import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";

import { PasswordForm } from "@/components/admin/PasswordForm";

beforeEach(() => {
  vi.restoreAllMocks();
});

function fillAndSubmit() {
  fireEvent.change(screen.getByLabelText(/huidig wachtwoord|current password/i), {
    target: { value: "changeme123" },
  });
  fireEvent.change(screen.getByLabelText(/nieuw wachtwoord|new password/i), {
    target: { value: "newpassword1" },
  });
  fireEvent.click(
    screen.getByRole("button", { name: /wachtwoord wijzigen|change password/i }),
  );
}

describe("PasswordForm", () => {
  it("renders Dutch chrome and saves a new password", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({ ok: true, json: async () => ({ ok: true }) }),
    );
    render(<PasswordForm userId="u1" locale="NL" />);

    expect(screen.getByRole("heading", { name: "Wachtwoord" })).toBeInTheDocument();
    fillAndSubmit();

    expect(await screen.findByText("Wachtwoord gewijzigd.")).toBeInTheDocument();
  });

  it("renders English chrome when locale is EN", () => {
    render(<PasswordForm userId="u1" locale="EN" />);
    expect(screen.getByRole("heading", { name: "Password" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Change password" })).toBeInTheDocument();
  });

  it("translates the current-password-incorrect API error for display", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: false,
        json: async () => ({ error: "Current password is incorrect" }),
      }),
    );
    render(<PasswordForm userId="u1" locale="NL" />);
    fillAndSubmit();

    await waitFor(() =>
      expect(screen.getByRole("alert")).toHaveTextContent(
        "Huidig wachtwoord is onjuist",
      ),
    );
  });

  it("translates the dynamic too-short-password API error for display", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: false,
        json: async () => ({
          error: "New password must be at least 8 characters",
        }),
      }),
    );
    render(<PasswordForm userId="u1" locale="NL" />);
    fillAndSubmit();

    await waitFor(() =>
      expect(screen.getByRole("alert")).toHaveTextContent(
        "Nieuw wachtwoord moet minimaal 8 tekens lang zijn",
      ),
    );
  });
});
