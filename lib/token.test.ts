import { describe, it, expect } from "vitest";
import fc from "fast-check";

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

describe("property", () => {
  it("newToken() always returns a 64-character hex string", () => {
    // newToken() takes no input — fc.integer() just drives the default
    // 100 repetitions so the assertion runs 100 times, per the spec.
    fc.assert(
      fc.property(fc.integer(), () => {
        expect(newToken()).toMatch(/^[0-9a-f]{64}$/);
      }),
    );
  });

  it("two consecutive calls never return the same value (100 runs)", () => {
    fc.assert(
      fc.property(fc.integer(), () => {
        expect(newToken()).not.toBe(newToken());
      }),
    );
  });
});
