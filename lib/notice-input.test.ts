// @vitest-environment node
import { describe, it, expect } from "vitest";

import { parseNoticeInput } from "@/lib/notice-input";

describe("parseNoticeInput", () => {
  it("accepts a message with optional window", () => {
    const r = parseNoticeInput({
      message: "  Closed for holiday  ",
      active: false,
      startsAt: "2026-07-10T00:00",
      endsAt: "2026-07-12T00:00",
    });
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.data.message).toBe("Closed for holiday");
    expect(r.data.active).toBe(false);
    expect(r.data.startsAt).toBeInstanceOf(Date);
    expect(r.data.endsAt).toBeInstanceOf(Date);
  });

  it("defaults active to true and window to null", () => {
    const r = parseNoticeInput({ message: "Hi" });
    expect(r.ok && r.data.active).toBe(true);
    expect(r.ok && r.data.startsAt).toBeNull();
    expect(r.ok && r.data.endsAt).toBeNull();
  });

  it("rejects a blank message", () => {
    expect(parseNoticeInput({ message: "  " }).ok).toBe(false);
  });

  it("rejects an invalid date", () => {
    expect(parseNoticeInput({ message: "Hi", startsAt: "nope" }).ok).toBe(false);
  });

  it("rejects an end before the start", () => {
    const r = parseNoticeInput({
      message: "Hi",
      startsAt: "2026-07-12T00:00",
      endsAt: "2026-07-10T00:00",
    });
    expect(r.ok).toBe(false);
  });
});
