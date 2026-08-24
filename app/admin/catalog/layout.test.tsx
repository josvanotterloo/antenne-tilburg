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

import CatalogLayout from "@/app/admin/catalog/layout";

describe("CatalogLayout nav", () => {
  it("renders a direct link for every Catalog section", () => {
    render(<CatalogLayout>{null}</CatalogLayout>);
    const expected: [string, string][] = [
      ["Products", "/admin/catalog"],
      ["Orders", "/admin/catalog/orders"],
      ["Labels", "/admin/catalog/labels"],
      ["Artists", "/admin/catalog/artists"],
      ["Genres", "/admin/catalog/genres"],
      ["Product Types", "/admin/catalog/product-types"],
      ["Suppliers", "/admin/catalog/suppliers"],
    ];
    for (const [label, href] of expected) {
      expect(screen.getByRole("link", { name: label })).toHaveAttribute(
        "href",
        href,
      );
    }
    expect(screen.getAllByRole("link")).toHaveLength(expected.length);
  });

  it("no longer has a standalone 'Reference data' or old 'Catalog'-labelled link", () => {
    render(<CatalogLayout>{null}</CatalogLayout>);
    expect(
      screen.queryByRole("link", { name: "Reference data" }),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole("link", { name: "Catalog" }),
    ).not.toBeInTheDocument();
  });
});
