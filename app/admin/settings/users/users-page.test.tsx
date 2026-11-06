import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";

vi.mock("next/link", () => ({
  default: ({ href, children }: { href: string; children: React.ReactNode }) => (
    <a href={href}>{children}</a>
  ),
}));
vi.mock("@/lib/db", () => ({ db: { user: { findMany: vi.fn() } } }));
vi.mock("@/lib/auth", () => ({
  auth: vi.fn().mockResolvedValue({ user: { locale: "NL" } }),
}));

import AdminUsersPage from "@/app/admin/settings/users/page";
import { db } from "@/lib/db";

beforeEach(() => vi.clearAllMocks());

describe("/admin/settings/users", () => {
  it("lists the admin accounts by email", async () => {
    vi.mocked(db.user.findMany).mockResolvedValue([
      { id: "u1", email: "shop@antenne-tilburg.nl", createdAt: new Date() },
      { id: "u2", email: "dev@antenne-tilburg.nl", createdAt: new Date() },
    ] as never);
    render(await AdminUsersPage());
    expect(screen.getByText("shop@antenne-tilburg.nl")).toBeInTheDocument();
    expect(screen.getByText("dev@antenne-tilburg.nl")).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Gebruikers" })).toBeInTheDocument();
    expect(screen.getAllByText("Beheren").length).toBeGreaterThan(0);
    // never selects passwordHash
    expect(db.user.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        select: { id: true, email: true, createdAt: true },
      }),
    );
  });

  it("renders in English when the admin's locale is EN", async () => {
    const { auth } = await import("@/lib/auth");
    vi.mocked(auth).mockResolvedValueOnce({ user: { locale: "EN" } } as never);
    vi.mocked(db.user.findMany).mockResolvedValue([
      { id: "u1", email: "shop@antenne-tilburg.nl", createdAt: new Date() },
    ] as never);
    render(await AdminUsersPage());
    expect(screen.getByRole("heading", { name: "Users" })).toBeInTheDocument();
    expect(screen.getAllByText("Manage").length).toBeGreaterThan(0);
  });
});
