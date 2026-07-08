// @vitest-environment node
import { describe, it, expect } from "vitest";

import { toDateTimeLocal } from "@/lib/datetime";

describe("toDateTimeLocal", () => {
  it("round-trips through Date without timezone drift", () => {
    // The edit form value must re-parse (as local, like the API) to the same
    // instant — a UTC-formatted value would shift by the tz offset.
    const d = new Date(2026, 7, 1, 20, 0); // local 2026-08-01 20:00
    expect(new Date(toDateTimeLocal(d)).getTime()).toBe(d.getTime());
  });

  it("produces a datetime-local shaped string", () => {
    expect(toDateTimeLocal(new Date(2026, 0, 5, 9, 3))).toBe("2026-01-05T09:03");
  });
});
