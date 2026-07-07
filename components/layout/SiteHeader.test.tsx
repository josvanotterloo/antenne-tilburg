import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";

vi.mock("next/link", () => ({
  default: ({
    href,
    children,
  }: {
    href: string;
    children: React.ReactNode;
  }) => <a href={href}>{children}</a>,
}));

vi.mock("next/navigation", () => ({
  usePathname: () => "/",
}));

import { SiteHeader } from "@/components/layout/SiteHeader";

describe("SiteHeader", () => {
  it("renders the Antenne logo image in the header", () => {
    render(<SiteHeader />);
    const logo = screen.getByRole("img", { name: /antenne/i });
    expect(logo).toHaveAttribute("src", "/logo.png");
  });
});
