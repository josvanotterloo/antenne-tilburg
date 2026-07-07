import { describe, it, expect } from "vitest";

import { newToken } from "@/lib/token";

describe("newToken", () => {
  it("returns a 64-character hex string", () => {
    const token = newToken();
    expect(token).toMatch(/^[0-9a-f]{64}$/);
  });

  it("returns a different value on each call", () => {
    expect(newToken()).not.toBe(newToken());
  });
});
