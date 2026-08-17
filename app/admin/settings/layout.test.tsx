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

import SettingsLayout from "@/app/admin/settings/layout";

describe("SettingsLayout nav", () => {
  it("no longer links to Suppliers (moved to Catalog)", () => {
    render(<SettingsLayout>{null}</SettingsLayout>);
    expect(
      screen.queryByRole("link", { name: "Suppliers" }),
    ).not.toBeInTheDocument();
  });

  it("still renders the remaining Settings links", () => {
    render(<SettingsLayout>{null}</SettingsLayout>);
    const expected: [string, string][] = [
      ["Opening hours", "/admin/settings/hours"],
      ["Notices", "/admin/settings/notices"],
      ["Subscribers", "/admin/settings/subscribers"],
      ["Users", "/admin/settings/users"],
    ];
    for (const [label, href] of expected) {
      expect(screen.getByRole("link", { name: label })).toHaveAttribute(
        "href",
        href,
      );
    }
    expect(screen.getAllByRole("link")).toHaveLength(expected.length);
  });
});
