import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";

import SocialLinks from "@/components/SocialLinks";

const EXPECTED = {
  Facebook: "https://www.facebook.com/antennerecordshop/",
  Instagram: "https://www.instagram.com/antenne.recordshop/",
  SoundCloud: "https://soundcloud.com/antennerecordshoptilburg",
};

describe("SocialLinks", () => {
  it("links Facebook, Instagram and SoundCloud to the right URLs", () => {
    render(<SocialLinks />);
    for (const [name, href] of Object.entries(EXPECTED)) {
      expect(
        screen.getByRole("link", { name: new RegExp(name, "i") }),
      ).toHaveAttribute("href", href);
    }
  });

  it("opens each link safely in a new tab", () => {
    render(<SocialLinks />);
    for (const name of Object.keys(EXPECTED)) {
      const link = screen.getByRole("link", { name: new RegExp(name, "i") });
      expect(link).toHaveAttribute("target", "_blank");
      expect(link).toHaveAttribute("rel", "noopener noreferrer");
    }
  });
});
