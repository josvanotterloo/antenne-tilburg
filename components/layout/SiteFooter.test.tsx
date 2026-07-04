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

import { SiteFooter } from "@/components/layout/SiteFooter";

describe("SiteFooter", () => {
  it("renders the three column headings", () => {
    render(<SiteFooter />);
    expect(
      screen.getByRole("heading", { name: /^follow$/i }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("heading", { name: /^navigate$/i }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("heading", { name: /^contact$/i }),
    ).toBeInTheDocument();
  });

  it("links to the five main pages", () => {
    render(<SiteFooter />);
    const nav: [string, string][] = [
      ["Stock", "/stock"],
      ["Blog", "/blog"],
      ["Visit", "/visit"],
      ["About", "/about"],
      ["FAQ", "/faq"],
    ];
    for (const [name, href] of nav) {
      expect(screen.getByRole("link", { name })).toHaveAttribute("href", href);
    }
  });

  it("shows the contact details incl. a tappable phone", () => {
    render(<SiteFooter />);
    expect(screen.getByText(/Noordstraat 82/)).toBeInTheDocument();
    expect(screen.getByText(/5038 EK Tilburg/)).toBeInTheDocument();
    expect(screen.getByText(/Sam-Sam vintage/)).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /542 1708/ })).toHaveAttribute(
      "href",
      "tel:+31135421708",
    );
  });

  it("embeds the reusable social links", () => {
    render(<SiteFooter />);
    expect(
      screen.getByRole("link", { name: /facebook/i }),
    ).toHaveAttribute("href", "https://www.facebook.com/antennerecordshop/");
  });

  it("has a bottom bar with the year and a Discogs link (new tab)", () => {
    render(<SiteFooter />);
    const year = new Date().getFullYear();
    expect(
      screen.getByText(new RegExp(`©\\s*${year}\\s*Antenne Recordshop`)),
    ).toBeInTheDocument();
    const discogs = screen.getByRole("link", { name: /discogs/i });
    expect(discogs).toHaveAttribute(
      "href",
      "https://www.discogs.com/seller/antennetilburg",
    );
    expect(discogs).toHaveAttribute("target", "_blank");
    expect(discogs).toHaveAttribute("rel", "noopener noreferrer");
  });
});
