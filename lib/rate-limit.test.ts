import { describe, it, expect } from "vitest";

import { createRateLimiter } from "@/lib/rate-limit";

describe("createRateLimiter", () => {
  it("allows up to `limit` hits per key within the window, then blocks", () => {
    const rl = createRateLimiter({ limit: 3, windowMs: 1000 });
    expect(rl.check("ip", 0)).toBe(true);
    expect(rl.check("ip", 100)).toBe(true);
    expect(rl.check("ip", 200)).toBe(true);
    expect(rl.check("ip", 300)).toBe(false); // 4th within the window
  });

  it("tracks keys independently", () => {
    const rl = createRateLimiter({ limit: 1, windowMs: 1000 });
    expect(rl.check("a", 0)).toBe(true);
    expect(rl.check("b", 0)).toBe(true); // different key, own bucket
    expect(rl.check("a", 0)).toBe(false);
  });

  it("frees capacity once hits age out of the window", () => {
    const rl = createRateLimiter({ limit: 1, windowMs: 1000 });
    expect(rl.check("ip", 0)).toBe(true);
    expect(rl.check("ip", 500)).toBe(false);
    expect(rl.check("ip", 1000)).toBe(true); // the t=0 hit is now outside the window
  });

  it("reset() clears all buckets", () => {
    const rl = createRateLimiter({ limit: 1, windowMs: 1000 });
    expect(rl.check("ip", 0)).toBe(true);
    expect(rl.check("ip", 0)).toBe(false);
    rl.reset();
    expect(rl.check("ip", 0)).toBe(true);
  });
});
