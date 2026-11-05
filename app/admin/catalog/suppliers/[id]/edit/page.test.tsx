import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn(), refresh: vi.fn() }),
  notFound: vi.fn(() => {
    throw new Error("NEXT_NOT_FOUND");
  }),
}));
vi.mock("@/lib/db", () => ({ db: { supplier: { findUnique: vi.fn() } } }));
vi.mock("@/lib/auth", () => ({ auth: vi.fn() }));

import EditSupplierPage from "@/app/admin/catalog/suppliers/[id]/edit/page";
import { db } from "@/lib/db";
import { auth } from "@/lib/auth";

const ctx = (id: string) => ({ params: Promise.resolve({ id }) });

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(auth).mockResolvedValue({ user: { locale: "NL" } } as never);
  vi.mocked(db.supplier.findUnique).mockResolvedValue({
    id: "s1",
    name: "Kalahari Oyster Cult",
    contact: "ask Jules",
  } as never);
});

describe("/admin/catalog/suppliers/[id]/edit", () => {
  it("renders the Dutch title and the Dutch save-changes button", async () => {
    render(await EditSupplierPage(ctx("s1")));
    expect(screen.getByText("Leverancier bewerken")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Wijzigingen opslaan" })).toBeInTheDocument();
  });

  it("renders in English when the admin's locale is EN", async () => {
    vi.mocked(auth).mockResolvedValue({ user: { locale: "EN" } } as never);
    render(await EditSupplierPage(ctx("s1")));
    expect(screen.getByText("Edit supplier")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Save changes" })).toBeInTheDocument();
  });
});
