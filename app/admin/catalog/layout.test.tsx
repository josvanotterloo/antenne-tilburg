import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";

const pathname = { current: "/admin/catalog" };
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

import CatalogLayout from "@/app/admin/catalog/layout";

describe("CatalogLayout nav", () => {
  it("renders a direct link for every Catalog section (Dutch labels)", async () => {
    render(await CatalogLayout({ children: null }));
    const expected: [string, string][] = [
      ["Producten", "/admin/catalog"],
      ["Bestellingen", "/admin/catalog/orders"],
      ["Labels", "/admin/catalog/labels"],
      ["Artiesten", "/admin/catalog/artists"],
      ["Genres", "/admin/catalog/genres"],
      ["Formaten", "/admin/catalog/product-types"],
      ["Leveranciers", "/admin/catalog/suppliers"],
    ];
    for (const [label, href] of expected) {
      expect(screen.getByRole("link", { name: label })).toHaveAttribute(
        "href",
        href,
      );
    }
    expect(screen.getAllByRole("link")).toHaveLength(expected.length);
  });

  it("no longer has a standalone 'Reference data' or old 'Catalog'-labelled link", async () => {
    render(await CatalogLayout({ children: null }));
    expect(
      screen.queryByRole("link", { name: "Reference data" }),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole("link", { name: "Catalogus" }),
    ).not.toBeInTheDocument();
  });

  it("renders English labels when locale is EN", async () => {
    const { auth } = await import("@/lib/auth");
    vi.mocked(auth).mockResolvedValueOnce({ user: { locale: "EN" } } as never);
    render(await CatalogLayout({ children: null }));
    expect(screen.getByRole("link", { name: "Products" })).toBeInTheDocument();
    expect(
      screen.getByRole("link", { name: "Product Types" }),
    ).toBeInTheDocument();
  });
});
