import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn(), refresh: vi.fn() }),
}));
vi.mock("@/lib/db", () => ({
  db: { newsletterSubscriber: { findMany: vi.fn() } },
}));

import AdminSubscribersPage from "@/app/admin/settings/subscribers/page";
import { db } from "@/lib/db";

beforeEach(() => vi.clearAllMocks());

describe("/admin/settings/subscribers", () => {
  it("lists subscribers with an export link", async () => {
    vi.mocked(db.newsletterSubscriber.findMany).mockResolvedValue([
      { id: "s1", name: "Ada", email: "ada@x.com", createdAt: new Date() },
    ] as never);
    render(await AdminSubscribersPage());
    expect(screen.getByText("Ada")).toBeInTheDocument();
    expect(screen.getByText("ada@x.com")).toBeInTheDocument();
    const link = screen.getByText("Export CSV");
    expect(link).toHaveAttribute("href", "/api/admin/subscribers/export");
  });

  it("hides the export link and shows an empty state with no subscribers", async () => {
    vi.mocked(db.newsletterSubscriber.findMany).mockResolvedValue([] as never);
    render(await AdminSubscribersPage());
    expect(screen.getByText(/No subscribers yet/)).toBeInTheDocument();
    expect(screen.queryByText("Export CSV")).toBeNull();
  });
});
