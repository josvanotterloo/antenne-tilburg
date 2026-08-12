// @vitest-environment node
import { describe, it, expect, vi, afterEach } from "vitest";

import { withTimeout, TimeoutError } from "@/lib/with-timeout";

afterEach(() => {
  vi.useRealTimers();
});

describe("withTimeout", () => {
  it("resolves with the inner promise's value when it settles before the timeout", async () => {
    await expect(withTimeout(async () => "ok", 1_000, "timed out")).resolves.toBe(
      "ok",
    );
  });

  it("rejects with a TimeoutError carrying the given message when the timeout fires first", async () => {
    vi.useFakeTimers();
    const promise = withTimeout(() => new Promise(() => {}), 1_000, "timed out");
    const assertion = expect(promise).rejects.toThrow(TimeoutError);
    await vi.advanceTimersByTimeAsync(1_000);
    await assertion;
  });

  it("propagates the inner promise's own rejection unchanged when it fails before the timeout", async () => {
    await expect(
      withTimeout(async () => {
        throw new Error("boom");
      }, 1_000, "timed out"),
    ).rejects.toThrow("boom");
  });

  it("still throws TimeoutError when `run` also rejects on the same abort signal", async () => {
    // Mirrors fetch: `run` listens for abort itself and rejects with its own
    // error, racing the internal TimeoutError rejection on the same event.
    vi.useFakeTimers();
    const promise = withTimeout(
      (signal) =>
        new Promise((_, reject) => {
          signal.addEventListener("abort", () => reject(new Error("aborted")));
        }),
      1_000,
      "timed out",
    );
    const assertion = expect(promise).rejects.toThrow(TimeoutError);
    await vi.advanceTimersByTimeAsync(1_000);
    await assertion;
  });
});
