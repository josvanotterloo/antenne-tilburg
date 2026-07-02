import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";

// Mock the Next.js + next-auth bits the nav depends on so it renders in jsdom.
const pathname = { current: "/admin/catalog" };
vi.mock("next/navigation", () => ({
  usePathname: () => pathname.current,
}));
vi.mock("next-auth/react", () => ({
  signOut: vi.fn(),
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

import { AdminTopNav } from "@/components/layout/AdminTopNav";

describe("AdminTopNav", () => {
  beforeEach(() => {
    pathname.current = "/admin/catalog";
  });

  it("renders the wordmark linking to /admin/catalog", () => {
    render(<AdminTopNav />);
    const wordmark = screen.getByRole("link", { name: /antenne tilburg/i });
    expect(wordmark).toHaveAttribute("href", "/admin/catalog");
  });

  it("renders the three section nav items with correct targets", () => {
    render(<AdminTopNav />);
    expect(screen.getByRole("link", { name: "Catalog" })).toHaveAttribute(
      "href",
      "/admin/catalog",
    );
    expect(screen.getByRole("link", { name: "Content" })).toHaveAttribute(
      "href",
      "/admin/content/posts",
    );
    expect(screen.getByRole("link", { name: "Settings" })).toHaveAttribute(
      "href",
      "/admin/settings/hours",
    );
  });

  it("marks the active section based on the current path", () => {
    pathname.current = "/admin/content/posts";
    render(<AdminTopNav />);
    expect(screen.getByRole("link", { name: "Content" })).toHaveAttribute(
      "aria-current",
      "page",
    );
    expect(screen.getByRole("link", { name: "Catalog" })).not.toHaveAttribute(
      "aria-current",
    );
  });

  it("renders a sign out control", () => {
    render(<AdminTopNav />);
    expect(
      screen.getByRole("button", { name: /sign out/i }),
    ).toBeInTheDocument();
  });

  it("renders nothing on the login page", () => {
    pathname.current = "/admin/login";
    const { container } = render(<AdminTopNav />);
    expect(container).toBeEmptyDOMElement();
    expect(screen.queryByRole("button", { name: /sign out/i })).toBeNull();
  });
});
