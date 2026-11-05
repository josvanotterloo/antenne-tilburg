import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";

vi.mock("next-auth/react", () => ({
  signIn: vi.fn(),
}));
vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn(), refresh: vi.fn() }),
}));

import AdminLoginPage from "@/app/admin/login/page";

describe("AdminLoginPage", () => {
  it("renders in Dutch regardless of session state", () => {
    render(<AdminLoginPage />);

    expect(screen.getByText("Log in om door te gaan.")).toBeInTheDocument();
    expect(screen.getByLabelText("E-mail")).toBeInTheDocument();
    expect(screen.getByLabelText("Wachtwoord")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Inloggen" })).toBeInTheDocument();
  });

  it("renders no language switcher", () => {
    render(<AdminLoginPage />);

    expect(screen.queryByRole("button", { name: "NL" })).toBeNull();
    expect(screen.queryByRole("button", { name: "EN" })).toBeNull();
  });
});
