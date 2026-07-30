import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";

vi.mock("next/link", () => ({
  default: ({ href, children }: { href: string; children: React.ReactNode }) => <a href={href}>{children}</a>,
}));
vi.mock("next/navigation", () => ({ useRouter: () => ({ push: vi.fn(), refresh: vi.fn() }) }));
vi.mock("@/lib/db", () => ({ db: { supplier: { findMany: vi.fn() } } }));

import AdminSuppliersPage from "@/app/admin/settings/suppliers/page";
import { db } from "@/lib/db";

beforeEach(() => vi.clearAllMocks());

describe("/admin/settings/suppliers", () => {
  it("lists suppliers with contact and order count", async () => {
    vi.mocked(db.supplier.findMany).mockResolvedValue([
      { id: "s1", name: "Kalahari Oyster Cult", contact: "ask Jules", _count: { supplyOrders: 3 } },
    ] as never);
    render(await AdminSuppliersPage());
    expect(screen.getByText("Kalahari Oyster Cult")).toBeInTheDocument();
    expect(screen.getByText("ask Jules")).toBeInTheDocument();
    expect(screen.getByText("3")).toBeInTheDocument();
  });

  it("shows a placeholder with no suppliers", async () => {
    vi.mocked(db.supplier.findMany).mockResolvedValue([] as never);
    render(await AdminSuppliersPage());
    expect(screen.getByText(/no suppliers yet/i)).toBeInTheDocument();
  });
});
