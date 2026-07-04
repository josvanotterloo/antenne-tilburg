import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";

vi.mock("next/link", () => ({
  default: ({ href, children }: { href: string; children: React.ReactNode }) => (
    <a href={href}>{children}</a>
  ),
}));
vi.mock("@/lib/db", () => ({ db: { user: { findMany: vi.fn() } } }));

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
    // never selects passwordHash
    expect(db.user.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        select: { id: true, email: true, createdAt: true },
      }),
    );
  });
});
