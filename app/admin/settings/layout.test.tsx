import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";

const pathname = { current: "/admin/settings/hours" };
vi.mock("next/navigation", () => ({
  usePathname: () => pathname.current,
}));
vi.mock("next/link", () => ({
  default: ({
    href,
    children,
    ...rest
  }: {
    href: string;
    children: React.ReactNode;
  }) => (
    <a href={href} {...rest}>
      {children}
    </a>
  ),
}));
vi.mock("@/lib/auth", () => ({
  auth: vi.fn().mockResolvedValue({ user: { locale: "NL" } }),
}));

import SettingsLayout from "@/app/admin/settings/layout";

describe("SettingsLayout nav", () => {
  it("no longer links to Suppliers (moved to Catalog)", async () => {
    render(await SettingsLayout({ children: null }));
    expect(
      screen.queryByRole("link", { name: "Leveranciers" }),
    ).not.toBeInTheDocument();
  });

  it("still renders the remaining Settings links (Dutch labels)", async () => {
    render(await SettingsLayout({ children: null }));
    const expected: [string, string][] = [
      ["Openingstijden", "/admin/settings/hours"],
      ["Mededelingen", "/admin/settings/notices"],
      ["Abonnees", "/admin/settings/subscribers"],
      ["Gebruikers", "/admin/settings/users"],
    ];
    for (const [label, href] of expected) {
      expect(screen.getByRole("link", { name: label })).toHaveAttribute(
        "href",
        href,
      );
    }
    expect(screen.getAllByRole("link")).toHaveLength(expected.length);
  });

  it("renders English labels when locale is EN", async () => {
    const { auth } = await import("@/lib/auth");
    vi.mocked(auth).mockResolvedValueOnce({ user: { locale: "EN" } } as never);
    render(await SettingsLayout({ children: null }));
    expect(
      screen.getByRole("link", { name: "Opening hours" }),
    ).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Users" })).toBeInTheDocument();
  });
});
