import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";

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

import { StockNav } from "@/components/stock/StockNav";

const LINKS: Array<[string | RegExp, string]> = [
  [/all stock/i, "/stock"],
  [/this week/i, "/stock/this-week"],
  [/last week/i, "/stock/last-week"],
  [/back in stock/i, "/stock/back-in-stock"],
];

describe("StockNav", () => {
  it("renders all four section links", () => {
    render(<StockNav active="all" />);
    for (const [name, href] of LINKS) {
      expect(screen.getByRole("link", { name })).toHaveAttribute("href", href);
    }
  });

  it.each([
    ["all", /all stock/i],
    ["this-week", /this week/i],
    ["last-week", /last week/i],
    ["back-in-stock", /back in stock/i],
  ] as const)("marks %s as the current page", (active, name) => {
    render(<StockNav active={active} />);
    expect(screen.getByRole("link", { name })).toHaveAttribute(
      "aria-current",
      "page",
    );
    // Exactly one link is current.
    const current = screen
      .getAllByRole("link")
      .filter((a) => a.getAttribute("aria-current") === "page");
    expect(current).toHaveLength(1);
  });

  it("renders the search slot when provided", () => {
    render(
      <StockNav active="all">
        <input type="search" aria-label="Search stock" />
      </StockNav>,
    );
    expect(screen.getByRole("searchbox")).toBeInTheDocument();
  });

  it("falls back to a default search form that submits ?q= to /stock", () => {
    render(<StockNav active="this-week" />);

    const input = screen.getByRole("searchbox");
    expect(input).toHaveAttribute("name", "q");
    expect(input.closest("form")).toHaveAttribute("action", "/stock");
    expect(
      screen.getByRole("button", { name: /search/i }),
    ).toBeInTheDocument();
  });
});
