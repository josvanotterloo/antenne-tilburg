import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";

import { PostBody } from "@/components/PostBody";

// No test coverage existed for this component before CO1. GFM (task lists,
// autolink) is new; bold/italic/heading/image/link coverage below is a new
// baseline, not a regression guard for something that was already tested.
describe("PostBody", () => {
  it("renders a GFM task list as real checkboxes, checked state preserved", () => {
    render(<PostBody body={"- [x] Done\n- [ ] Not done"} />);

    const boxes = screen.getAllByRole("checkbox");
    expect(boxes).toHaveLength(2);
    expect(boxes[0]).toBeChecked();
    expect(boxes[1]).not.toBeChecked();
  });

  it("autolinks a bare URL", () => {
    render(<PostBody body="Listen at https://soundcloud.com/antennerecordshoptilburg" />);

    expect(
      screen.getByRole("link", {
        name: /https:\/\/soundcloud\.com\/antennerecordshoptilburg/,
      }),
    ).toHaveAttribute(
      "href",
      "https://soundcloud.com/antennerecordshoptilburg",
    );
  });

  it("still renders an explicit [label](url) link normally", () => {
    render(<PostBody body="See [the shop](https://example.com/shop)" />);

    expect(screen.getByRole("link", { name: "the shop" })).toHaveAttribute(
      "href",
      "https://example.com/shop",
    );
  });

  it("renders bold and italic text", () => {
    render(<PostBody body="a **loud** and *dusty* tape" />);

    expect(screen.getByText("loud").tagName).toBe("STRONG");
    expect(screen.getByText("dusty").tagName).toBe("EM");
  });

  it("renders headings", () => {
    render(<PostBody body={"## Big\n### Small"} />);

    expect(screen.getByRole("heading", { level: 2, name: "Big" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { level: 3, name: "Small" })).toBeInTheDocument();
  });

  it("renders an image with its alt text", () => {
    render(<PostBody body="![a record sleeve](https://cdn.test/a.png)" />);

    expect(screen.getByAltText("a record sleeve")).toHaveAttribute(
      "src",
      "https://cdn.test/a.png",
    );
  });
});
