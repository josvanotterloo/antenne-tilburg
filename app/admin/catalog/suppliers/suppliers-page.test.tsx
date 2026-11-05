import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";

vi.mock("next/link", () => ({
  default: ({ href, children }: { href: string; children: React.ReactNode }) => <a href={href}>{children}</a>,
}));
vi.mock("next/navigation", () => ({ useRouter: () => ({ push: vi.fn(), refresh: vi.fn() }) }));
vi.mock("@/lib/db", () => ({ db: { supplier: { findMany: vi.fn() } } }));
vi.mock("@/lib/auth", () => ({ auth: vi.fn() }));

import AdminSuppliersPage from "@/app/admin/catalog/suppliers/page";
import { db } from "@/lib/db";
import { auth } from "@/lib/auth";

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(auth).mockResolvedValue({ user: { locale: "NL" } } as never);
});

describe("/admin/catalog/suppliers", () => {
  it("lists suppliers with contact and order count, in Dutch", async () => {
    vi.mocked(db.supplier.findMany).mockResolvedValue([
      { id: "s1", name: "Kalahari Oyster Cult", contact: "ask Jules", _count: { supplyOrders: 3 } },
    ] as never);
    render(await AdminSuppliersPage());
    expect(screen.getByText("Leveranciers")).toBeInTheDocument();
    expect(screen.getByText("Kalahari Oyster Cult")).toBeInTheDocument();
    expect(screen.getByText("ask Jules")).toBeInTheDocument();
    expect(screen.getByText("3")).toBeInTheDocument();
  });

  it("shows the Dutch empty state with no suppliers", async () => {
    vi.mocked(db.supplier.findMany).mockResolvedValue([] as never);
    render(await AdminSuppliersPage());
    expect(screen.getByText("Nog geen leveranciers.")).toBeInTheDocument();
  });

  it("renders in English when the admin's locale is EN", async () => {
    vi.mocked(auth).mockResolvedValue({ user: { locale: "EN" } } as never);
    vi.mocked(db.supplier.findMany).mockResolvedValue([] as never);
    render(await AdminSuppliersPage());
    expect(screen.getByText("Suppliers")).toBeInTheDocument();
    expect(screen.getByText("No suppliers yet.")).toBeInTheDocument();
  });
});
