import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

import { logEvent } from "@/lib/log/log";
import type { LogEvent } from "@/lib/log/events";

describe("logEvent", () => {
  let logSpy: ReturnType<typeof vi.spyOn>;
  let errorSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    logSpy = vi.spyOn(console, "log").mockImplementation(() => {});
    errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
  });

  afterEach(() => {
    logSpy.mockRestore();
    errorSpy.mockRestore();
  });

  it("writes an ok-outcome event to console.log as one parseable JSON line", () => {
    const event: LogEvent = {
      event: "catalog.search",
      requestId: "r1",
      outcome: "ok",
      resultCount: 3,
      durationMs: 12,
    };

    logEvent(event);

    expect(errorSpy).not.toHaveBeenCalled();
    expect(logSpy).toHaveBeenCalledTimes(1);
    expect(JSON.parse(logSpy.mock.calls[0][0])).toEqual(event);
  });

  it("writes a failed-outcome event to console.error instead of console.log", () => {
    const event: LogEvent = {
      event: "auth.login",
      requestId: "r2",
      outcome: "failed",
      reason: "bad_credentials",
    };

    logEvent(event);

    expect(logSpy).not.toHaveBeenCalled();
    expect(errorSpy).toHaveBeenCalledTimes(1);
    expect(JSON.parse(errorSpy.mock.calls[0][0])).toEqual(event);
  });

  it("writes an error event to console.error even though it has no outcome field", () => {
    const event: LogEvent = {
      event: "error",
      requestId: "r3",
      where: "lib/email/send.ts",
      errorKind: "TypeError",
    };

    logEvent(event);

    expect(logSpy).not.toHaveBeenCalled();
    expect(errorSpy).toHaveBeenCalledTimes(1);
    expect(JSON.parse(errorSpy.mock.calls[0][0])).toEqual(event);
  });
});
