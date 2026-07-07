// @vitest-environment node
import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@/lib/api-auth", () => ({
  requireAdmin: vi.fn().mockResolvedValue(null),
}));
vi.mock("@/lib/db", () => ({
  db: { newsletterSubscriber: { findMany: vi.fn() } },
}));
vi.mock("@/lib/email/send", () => ({ sendEmail: vi.fn() }));

import { POST } from "@/app/api/admin/newsletter/send/route";
import { db } from "@/lib/db";
import { sendEmail } from "@/lib/email/send";
import { requireAdmin } from "@/lib/api-auth";

const post = (body: unknown) =>
  POST(
    new Request("http://localhost/api/admin/newsletter/send", {
      method: "POST",
      body: JSON.stringify(body),
    }),
  );

const confirmed = [
  { id: "a", email: "a@x.com", confirmToken: "tok-a" },
  { id: "b", email: "b@x.com", confirmToken: "tok-b" },
];

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(requireAdmin).mockResolvedValue(null);
  vi.mocked(db.newsletterSubscriber.findMany).mockResolvedValue(confirmed as never);
  vi.mocked(sendEmail).mockResolvedValue(undefined);
});

const valid = { subject: "New arrivals", body: "Fresh **wax**" };

describe("POST /api/admin/newsletter/send", () => {
  it("returns the 401 from requireAdmin and sends nothing", async () => {
    vi.mocked(requireAdmin).mockResolvedValue(
      new Response(null, { status: 401 }) as never,
    );
    const res = await post(valid);
    expect(res.status).toBe(401);
    expect(sendEmail).not.toHaveBeenCalled();
  });

  it("400s an invalid subject/body", async () => {
    const res = await post({ subject: "", body: "" });
    expect(res.status).toBe(400);
    expect(sendEmail).not.toHaveBeenCalled();
  });

  it("sends only to CONFIRMED subscribers and reports the count", async () => {
    const res = await post(valid);
    expect(res.status).toBe(200);
    expect(await res.json()).toMatchObject({ ok: true, sent: 2, failed: 0 });

    expect(db.newsletterSubscriber.findMany).toHaveBeenCalledWith({
      where: { status: "CONFIRMED" },
    });
    expect(sendEmail).toHaveBeenCalledTimes(2);
    // Each recipient gets their own unsubscribe token in the email.
    const htmlA = vi.mocked(sendEmail).mock.calls[0][0].html;
    expect(htmlA).toContain("token=tok-a");
  });

  it("counts a per-recipient send failure as failed, not fatal", async () => {
    vi.mocked(sendEmail)
      .mockResolvedValueOnce(undefined)
      .mockRejectedValueOnce(new Error("resend down"));
    const res = await post(valid);
    expect(res.status).toBe(200);
    expect(await res.json()).toMatchObject({ ok: true, sent: 1, failed: 1 });
  });
});
