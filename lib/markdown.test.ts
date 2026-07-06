// @vitest-environment node
import { describe, it, expect } from "vitest";

import { insertAt, imageMarkdown } from "@/lib/markdown";

describe("insertAt", () => {
  it("inserts at the cursor when start === end", () => {
    expect(insertAt("abcd", 2, 2, "-X-")).toBe("ab-X-cd");
  });

  it("replaces the selected range when start < end", () => {
    expect(insertAt("abcd", 1, 3, "X")).toBe("aXd");
  });

  it("appends at the end", () => {
    expect(insertAt("abc", 3, 3, "!")).toBe("abc!");
  });

  it("clamps out-of-range positions", () => {
    expect(insertAt("abc", -5, 99, "X")).toBe("X");
    expect(insertAt("abc", 10, 10, "X")).toBe("abcX");
  });
});

describe("imageMarkdown", () => {
  it("builds image markdown with empty alt by default", () => {
    expect(imageMarkdown("/uploads/x.png")).toBe("![](/uploads/x.png)");
  });

  it("includes alt text when given", () => {
    expect(imageMarkdown("/uploads/x.png", "a cat")).toBe(
      "![a cat](/uploads/x.png)",
    );
  });
});
