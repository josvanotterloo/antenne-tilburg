// @vitest-environment node
import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@/lib/api-auth", () => ({
  requireAdmin: vi.fn().mockResolvedValue(null),
}));
vi.mock("@/lib/db", () => ({
  db: {
    newsletterSubscriber: { findMany: vi.fn(), update: vi.fn() },
  },
}));
vi.mock("@/lib/email/send", () => ({ sendEmail: vi.fn() }));

import { POST } from "@/app/api/admin/newsletter/retry-pending/route";
import { db } from "@/lib/db";
import { encryptEmail } from "@/lib/email-crypto";
import { sendEmail } from "@/lib/email/send";
import { requireAdmin } from "@/lib/api-auth";

const post = () => POST();

// Rows as stored: encrypted addresses (computed in beforeEach, after the env
// key is stubbed). Only PENDING + confirmEmailSentAt: null rows are ever
// returned here — the eligibility filtering (excluding CONFIRMED, already-sent,
// or >48h-old rows) happens in the `where` clause sent to Prisma, so it's
// asserted separately rather than by handing this mock ineligible rows.
let pending: { id: string; email: string; confirmToken: string }[];

beforeEach(() => {
  vi.clearAllMocks();
  vi.stubEnv("EMAIL_ENCRYPTION_KEY", "f".repeat(64));
  pending = [
    { id: "a", email: encryptEmail("a@x.com"), confirmToken: "tok-a" },
    { id: "b", email: encryptEmail("b@x.com"), confirmToken: "tok-b" },
  ];
  vi.mocked(requireAdmin).mockResolvedValue(null);
  vi.mocked(db.newsletterSubscriber.findMany).mockResolvedValue(pending as never);
  vi.mocked(db.newsletterSubscriber.update).mockResolvedValue({} as never);
  vi.mocked(sendEmail).mockResolvedValue(undefined);
});

describe("POST /api/admin/newsletter/retry-pending", () => {
  it("returns the 401 from requireAdmin and sends nothing", async () => {
    vi.mocked(requireAdmin).mockResolvedValue(
      new Response(null, { status: 401 }) as never,
    );
    const res = await post();
    expect(res.status).toBe(401);
    expect(sendEmail).not.toHaveBeenCalled();
  });

  it("queries only PENDING, not-yet-sent subscribers still within the 48h confirm window", async () => {
    await post();
    expect(db.newsletterSubscriber.findMany).toHaveBeenCalledWith({
      where: {
        status: "PENDING",
        confirmEmailSentAt: null,
        createdAt: { gt: expect.any(Date) },
      },
    });
    // Cutoff is ~48h ago, not e.g. "now" or "epoch".
    const call = vi.mocked(db.newsletterSubscriber.findMany).mock.calls[0]?.[0] as {
      where: { createdAt: { gt: Date } };
    };
    const cutoff = call.where.createdAt.gt;
    const hoursAgo = (Date.now() - cutoff.getTime()) / (60 * 60 * 1000);
    expect(hoursAgo).toBeGreaterThan(47.9);
    expect(hoursAgo).toBeLessThan(48.1);
  });

  it("sends a confirmation email to each eligible subscriber and marks confirmEmailSentAt", async () => {
    const res = await post();
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ tried: 2, succeeded: 2, failed: 0 });

    expect(sendEmail).toHaveBeenCalledTimes(2);
    // Stored ciphertext is decrypted to the real address for delivery.
    expect(vi.mocked(sendEmail).mock.calls[0][0].to).toBe("a@x.com");
    const htmlA = vi.mocked(sendEmail).mock.calls[0][0].html;
    expect(htmlA).toContain("/api/newsletter/confirm?token=tok-a");

    expect(db.newsletterSubscriber.update).toHaveBeenCalledWith({
      where: { id: "a" },
      data: { confirmEmailSentAt: expect.any(Date) },
    });
    expect(db.newsletterSubscriber.update).toHaveBeenCalledWith({
      where: { id: "b" },
      data: { confirmEmailSentAt: expect.any(Date) },
    });
  });

  it("counts a per-subscriber send failure as failed, not fatal, and does not mark it sent", async () => {
    vi.mocked(sendEmail)
      .mockResolvedValueOnce(undefined)
      .mockRejectedValueOnce(new Error("resend down"));
    const res = await post();
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ tried: 2, succeeded: 1, failed: 1 });
    expect(db.newsletterSubscriber.update).toHaveBeenCalledTimes(1);
    expect(db.newsletterSubscriber.update).toHaveBeenCalledWith({
      where: { id: "a" },
      data: { confirmEmailSentAt: expect.any(Date) },
    });
  });

  it("500s with a clear config error when the encryption key is missing, instead of N silent failures", async () => {
    vi.stubEnv("EMAIL_ENCRYPTION_KEY", "");
    const res = await post();
    expect(res.status).toBe(500);
    const body = (await res.json()) as { error?: string };
    expect(body.error).toMatch(/EMAIL_ENCRYPTION_KEY/);
    expect(sendEmail).not.toHaveBeenCalled();
  });

  it("logs failures by subscriber id, never the email address (PII)", async () => {
    const errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    vi.mocked(sendEmail).mockRejectedValue(new Error("resend down"));
    await post();
    const logged = errorSpy.mock.calls.flat().map(String).join(" ");
    expect(logged).toContain("a");
    expect(logged).not.toContain("a@x.com");
    expect(logged).not.toContain("b@x.com");
    errorSpy.mockRestore();
  });
});
