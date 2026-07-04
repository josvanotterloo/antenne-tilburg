import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";

import AboutPage from "@/app/(public)/about/page";

const has = (re: RegExp) => screen.getAllByText(re).length > 0;

describe("/about page", () => {
  it("renders the About heading", () => {
    render(<AboutPage />);
    expect(
      screen.getByRole("heading", { level: 1, name: /about/i }),
    ).toBeInTheDocument();
  });

  it("covers who runs the shop and its focus", () => {
    render(<AboutPage />);
    expect(has(/DJ DMDN/)).toBe(true);
    expect(has(/electronic/i)).toBe(true);
    expect(has(/Sam-Sam/)).toBe(true);
  });

  it("explains the second-hand section", () => {
    render(<AboutPage />);
    expect(has(/second-hand/i)).toBe(true);
  });

  it("explains the independent Discogs stock and pickup", () => {
    render(<AboutPage />);
    expect(has(/Discogs/)).toBe(true);
    expect(has(/pickup|pick up/i)).toBe(true);
  });
});
