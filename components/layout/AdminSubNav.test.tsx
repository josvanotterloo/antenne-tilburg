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
  { href: "/admin/catalog", label: "Catalog" },
  { href: "/admin/catalog/reference", label: "Reference data" },
  { href: "/admin/catalog/orders", label: "Orders" },
];

describe("AdminSubNav", () => {
  it("marks only Catalog active at /admin/catalog", () => {
    pathname.current = "/admin/catalog";
    render(<AdminSubNav items={ITEMS} />);
    expect(screen.getByRole("link", { name: "Catalog" })).toHaveAttribute(
      "aria-current",
      "page",
    );
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

  it("still matches a nested sub-path by prefix (existing behavior preserved)", () => {
    pathname.current = "/admin/catalog/reference/labels";
    render(<AdminSubNav items={ITEMS} />);
    expect(
      screen.getByRole("link", { name: "Reference data" }),
    ).toHaveAttribute("aria-current", "page");
  });

  it("falls back to the root item on an unlisted sub-path (e.g. product edit page)", () => {
    pathname.current = "/admin/catalog/p123/edit";
    render(<AdminSubNav items={ITEMS} />);
    const current = screen.getAllByRole("link").filter(
      (link) => link.getAttribute("aria-current") === "page",
    );
    expect(current).toHaveLength(1);
    expect(current[0]).toHaveTextContent("Catalog");
  });
});
