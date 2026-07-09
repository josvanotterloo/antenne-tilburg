import { describe, it, expect } from "vitest";

import { clientIp } from "@/lib/client-ip";

const headers = (xff?: string) =>
  new Headers(xff !== undefined ? { "x-forwarded-for": xff } : {});

describe("clientIp", () => {
  it("returns the rightmost x-forwarded-for entry (the hop our proxy appended)", () => {
    // Leftmost entries are client-supplied and spoofable; only the rightmost
    // value was added by the trusted reverse proxy.
    expect(clientIp(headers("1.1.1.1, 2.2.2.2, 9.9.9.9"))).toBe("9.9.9.9");
  });

  it("is not fooled by a spoofed header prepended by the client", () => {
    expect(clientIp(headers("spoofed-value, 203.0.113.7"))).toBe("203.0.113.7");
  });

  it("returns a single entry as-is, trimmed", () => {
    expect(clientIp(headers("  203.0.113.7  "))).toBe("203.0.113.7");
  });

  it("falls back to 'unknown' when the header is absent or empty", () => {
    expect(clientIp(headers())).toBe("unknown");
    expect(clientIp(headers(""))).toBe("unknown");
    expect(clientIp(headers("  ,  "))).toBe("unknown");
  });
});
