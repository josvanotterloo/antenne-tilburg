import { describe, it, expect } from "vitest";

import { sellOne } from "@/lib/stock";

describe("sellOne", () => {
  it("decrements and stays in stock when units remain", () => {
    expect(sellOne(3)).toEqual({ quantity: 2, inStock: true });
  });

  it("goes out of stock when the last unit is sold", () => {
    expect(sellOne(1)).toEqual({ quantity: 0, inStock: false });
  });

  it("is a no-op at 0 (never goes negative)", () => {
    expect(sellOne(0)).toEqual({ quantity: 0, inStock: false });
  });
});
