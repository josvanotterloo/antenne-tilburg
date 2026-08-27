import { describe, it, expect, afterEach, vi } from "vitest";
import type { ErrorEvent } from "@sentry/nextjs";

import { sentryInitOptions } from "@/lib/sentry-init-options";

afterEach(() => {
  vi.unstubAllEnvs();
});

describe("sentryInitOptions", () => {
  it("returns null when no DSN is configured", () => {
    expect(sentryInitOptions(undefined)).toBeNull();
  });

  it("returns dsn + beforeSend when a DSN is configured", () => {
    const options = sentryInitOptions("https://key@sentry.io/1");
    expect(options?.dsn).toBe("https://key@sentry.io/1");
    expect(typeof options?.beforeSend).toBe("function");
  });

  describe("beforeSend", () => {
    it("drops the event in development, without scrubbing it first", () => {
      vi.stubEnv("NODE_ENV", "development");
      const options = sentryInitOptions("https://key@sentry.io/1");
      const event = { message: "dev noise" } as ErrorEvent;

      expect(options?.beforeSend?.(event)).toBeNull();
    });

    it("still scrubs and forwards the event outside development", () => {
      vi.stubEnv("NODE_ENV", "production");
      const options = sentryInitOptions("https://key@sentry.io/1");
      const event = {
        message: "failed for jos@example.com",
      } as ErrorEvent;

      const sent = options?.beforeSend?.(event) as ErrorEvent | null;
      expect(sent).not.toBeNull();
      expect(sent?.message).toBe("failed for [redacted-email]");
    });
  });
});
