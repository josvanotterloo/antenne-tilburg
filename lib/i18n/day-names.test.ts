import { describe, it, expect } from "vitest";
import { dayName } from "./day-names";

describe("dayName", () => {
  it("matches lib/opening-hours.ts's DAY_NAMES indexing (0=Sunday..6=Saturday) in English", () => {
    expect(dayName(0, "EN")).toBe("Sunday");
    expect(dayName(1, "EN")).toBe("Monday");
    expect(dayName(6, "EN")).toBe("Saturday");
  });

  it("returns Dutch weekday names at the same index", () => {
    expect(dayName(0, "NL")).toBe("Zondag");
    expect(dayName(1, "NL")).toBe("Maandag");
    expect(dayName(6, "NL")).toBe("Zaterdag");
  });
});
