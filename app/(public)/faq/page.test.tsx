import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";

import FaqPage from "@/app/(public)/faq/page";

const has = (re: RegExp) => screen.getAllByText(re).length > 0;

describe("/faq page", () => {
  it("renders the FAQ heading", () => {
    render(<FaqPage />);
    expect(
      screen.getByRole("heading", { level: 1, name: /faq|frequently/i }),
    ).toBeInTheDocument();
  });

  it("covers the core questions from the plan", () => {
    render(<FaqPage />);
    expect(has(/vinyl and tape/i)).toBe(true);
    expect(has(/second-hand/i)).toBe(true);
    expect(has(/Discogs/)).toBe(true);
    expect(has(/pickup|pick up/i)).toBe(true);
  });

  it("emits FAQPage structured data for SEO", () => {
    const { container } = render(<FaqPage />);
    const ld = container.querySelector(
      'script[type="application/ld+json"]',
    );
    expect(ld).not.toBeNull();
    expect(ld?.textContent ?? "").toContain("FAQPage");
    expect(ld?.textContent ?? "").toContain("Discogs");
  });
});
