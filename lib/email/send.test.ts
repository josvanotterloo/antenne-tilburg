// @vitest-environment node
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

const { sendMock } = vi.hoisted(() => ({ sendMock: vi.fn() }));

vi.mock("resend", () => {
  class MockResend {
    emails = { send: sendMock };
  }
  return { Resend: MockResend };
});

import { sendEmail } from "@/lib/email/send";

const ORIGINAL_ENV = { ...process.env };

beforeEach(() => {
  sendMock.mockReset();
  process.env = { ...ORIGINAL_ENV };
  process.env.RESEND_API_KEY = "test-key";
  process.env.NEWSLETTER_FROM = "noreply@example.com";
});

afterEach(() => {
  process.env = { ...ORIGINAL_ENV };
  vi.useRealTimers();
});

describe("sendEmail", () => {
  it("resolves when Resend responds before the timeout", async () => {
    sendMock.mockResolvedValue({ data: { id: "email-1" }, error: null });

    await expect(
      sendEmail({ to: "a@b.com", subject: "Hi", html: "<p>hi</p>" }),
    ).resolves.toBeUndefined();
  });

  it("throws a descriptive error when Resend doesn't respond within 10s", async () => {
    vi.useFakeTimers();
    sendMock.mockReturnValue(new Promise(() => {}));

    const promise = sendEmail({ to: "a@b.com", subject: "Hi", html: "<p>hi</p>" });
    const assertion = expect(promise).rejects.toThrow("Resend API timeout after 10s");
    await vi.advanceTimersByTimeAsync(10_000);
    await assertion;
  });
});
