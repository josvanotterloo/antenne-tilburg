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

import { AdminSubNav } from "@/components/layout/AdminSubNav";

const ITEMS = [
  { href: "/admin/catalog", label: "Catalog", exact: true },
  { href: "/admin/catalog/reference", label: "Reference data" },
  { href: "/admin/catalog/orders", label: "Orders" },
];

describe("AdminSubNav", () => {
  it("marks an exact item active only on its exact path, not on a sub-path", () => {
    pathname.current = "/admin/catalog";
    const { rerender } = render(<AdminSubNav items={ITEMS} />);
    expect(screen.getByRole("link", { name: "Catalog" })).toHaveAttribute(
      "aria-current",
      "page",
    );

    pathname.current = "/admin/catalog/orders";
    rerender(<AdminSubNav items={ITEMS} />);
    expect(
      screen.getByRole("link", { name: "Catalog" }),
    ).not.toHaveAttribute("aria-current");
  });

  it("marks exactly one item active at /admin/catalog/orders, and it's Orders", () => {
    pathname.current = "/admin/catalog/orders";
    render(<AdminSubNav items={ITEMS} />);
    const current = screen.getAllByRole("link").filter(
      (link) => link.getAttribute("aria-current") === "page",
    );
    expect(current).toHaveLength(1);
    expect(current[0]).toHaveTextContent("Orders");
  });

  it("still matches a non-exact item by prefix (existing behavior preserved)", () => {
    pathname.current = "/admin/catalog/reference/labels";
    render(<AdminSubNav items={ITEMS} />);
    expect(
      screen.getByRole("link", { name: "Reference data" }),
    ).toHaveAttribute("aria-current", "page");
  });
});
