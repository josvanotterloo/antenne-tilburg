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
      sendEmail({ to: "a@b.com", subject: "Hi", html: "<p>hi</p>", kind: "confirmation" }),
    ).resolves.toBeUndefined();
  });

  it("throws a descriptive error when Resend doesn't respond within 10s", async () => {
    vi.useFakeTimers();
    sendMock.mockReturnValue(new Promise(() => {}));

    const promise = sendEmail({
      to: "a@b.com",
      subject: "Hi",
      html: "<p>hi</p>",
      kind: "confirmation",
    });
    const assertion = expect(promise).rejects.toThrow("Resend API timeout after 10s");
    await vi.advanceTimersByTimeAsync(10_000);
    await assertion;
  });

  describe("email.send logging", () => {
    function captureLogs() {
      const logSpy = vi.spyOn(console, "log").mockImplementation(() => {});
      const errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
      return { logSpy, errorSpy };
    }

    it("logs email.send ok with the kind on a successful send", async () => {
      sendMock.mockResolvedValue({ data: { id: "email-1" }, error: null });
      const { logSpy, errorSpy } = captureLogs();

      await sendEmail({ to: "a@b.com", subject: "Hi", html: "<p>hi</p>", kind: "confirmation" });

      expect(errorSpy).not.toHaveBeenCalled();
      const event = JSON.parse(logSpy.mock.calls[0][0]);
      expect(event).toMatchObject({ event: "email.send", outcome: "ok", kind: "confirmation" });
      expect(typeof event.durationMs).toBe("number");
      vi.restoreAllMocks();
    });

    it("logs email.send failed, never the recipient, when Resend returns an error", async () => {
      sendMock.mockResolvedValue({ data: null, error: { message: "bounced" } });
      const { errorSpy } = captureLogs();

      await expect(
        sendEmail({ to: "a@b.com", subject: "Hi", html: "<p>hi</p>", kind: "newsletter" }),
      ).rejects.toThrow("Resend send failed");

      const event = JSON.parse(errorSpy.mock.calls[0][0]);
      expect(event).toMatchObject({ event: "email.send", outcome: "failed", kind: "newsletter" });
      expect(JSON.stringify(event)).not.toContain("a@b.com");
      vi.restoreAllMocks();
    });

    it("logs email.send failed when the config itself is missing", async () => {
      process.env.RESEND_API_KEY = "";
      const { errorSpy } = captureLogs();

      await expect(
        sendEmail({ to: "a@b.com", subject: "Hi", html: "<p>hi</p>", kind: "confirmation" }),
      ).rejects.toThrow("must be set");

      const event = JSON.parse(errorSpy.mock.calls[0][0]);
      expect(event).toMatchObject({ event: "email.send", outcome: "failed", kind: "confirmation" });
      vi.restoreAllMocks();
    });
  });
});
