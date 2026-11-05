import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";

vi.mock("next/navigation", () => ({ useRouter: () => ({ push: vi.fn(), refresh: vi.fn() }) }));
vi.mock("@/lib/auth", () => ({ auth: vi.fn() }));

import NewSupplierPage from "@/app/admin/catalog/suppliers/new/page";
import { auth } from "@/lib/auth";

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(auth).mockResolvedValue({ user: { locale: "NL" } } as never);
});

describe("/admin/catalog/suppliers/new", () => {
  it("renders the Dutch title and passes the admin's locale to the form", async () => {
    render(await NewSupplierPage());
    expect(screen.getByText("Nieuwe leverancier")).toBeInTheDocument();
    expect(screen.getByRole("textbox", { name: "Naam" })).toBeInTheDocument();
  });

  it("renders the English title when the admin's locale is EN", async () => {
    vi.mocked(auth).mockResolvedValue({ user: { locale: "EN" } } as never);
    render(await NewSupplierPage());
    expect(screen.getByText("New supplier")).toBeInTheDocument();
  });
});
