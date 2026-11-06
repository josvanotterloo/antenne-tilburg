import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";

vi.mock("next/link", () => ({
  default: ({ href, children }: { href: string; children: React.ReactNode }) => (
    <a href={href}>{children}</a>
  ),
}));
vi.mock("next/navigation", () => ({
  useRouter: () => ({ refresh: vi.fn() }),
  notFound: vi.fn(() => {
    throw new Error("NEXT_NOT_FOUND");
  }),
}));
vi.mock("@/lib/db", () => ({ db: { user: { findUnique: vi.fn() } } }));
vi.mock("@/lib/auth", () => ({
  auth: vi.fn().mockResolvedValue({ user: { locale: "NL" } }),
}));

import ManageUserPage from "@/app/admin/settings/users/[id]/page";
import { db } from "@/lib/db";

beforeEach(() => vi.clearAllMocks());

const ctx = (id: string) => ({ params: Promise.resolve({ id }) });

describe("/admin/settings/users/[id]", () => {
  it("renders Dutch chrome with the forms for that user", async () => {
    vi.mocked(db.user.findUnique).mockResolvedValue({
      id: "u1",
      email: "shop@antenne-tilburg.nl",
    } as never);
    render(await ManageUserPage(ctx("u1")));
    expect(screen.getByText("← Gebruikers")).toBeInTheDocument();
    expect(
      screen.getByRole("heading", { name: "Beheer shop@antenne-tilburg.nl" }),
    ).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "E-mail" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Wachtwoord" })).toBeInTheDocument();
  });

  it("renders in English when the admin's locale is EN", async () => {
    const { auth } = await import("@/lib/auth");
    vi.mocked(auth).mockResolvedValueOnce({ user: { locale: "EN" } } as never);
    vi.mocked(db.user.findUnique).mockResolvedValue({
      id: "u1",
      email: "shop@antenne-tilburg.nl",
    } as never);
    render(await ManageUserPage(ctx("u1")));
    expect(screen.getByText("← Users")).toBeInTheDocument();
    expect(
      screen.getByRole("heading", { name: "Manage shop@antenne-tilburg.nl" }),
    ).toBeInTheDocument();
  });
});
