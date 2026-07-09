// @vitest-environment node
import { describe, it, expect, vi, beforeEach } from "vitest";
import { Prisma } from "@prisma/client";

vi.mock("@/lib/db", () => ({
  db: {
    newsletterSubscriber: { create: vi.fn(), delete: vi.fn(), findFirst: vi.fn() },
  },
}));
vi.mock("@/lib/email/send", () => ({ sendEmail: vi.fn() }));

import { POST } from "@/app/api/newsletter/route";
import { db } from "@/lib/db";
import { decryptEmail, emailHash } from "@/lib/email-crypto";
import { sendEmail } from "@/lib/email/send";
import { newsletterSignupLimiter } from "@/lib/rate-limit";

// Any valid 32-byte key — the route encrypts before storing.
const TEST_KEY = "c".repeat(64);

const post = (body: unknown) =>
  POST(
    new Request("http://localhost/api/newsletter", {
      method: "POST",
      body: JSON.stringify(body),
    }),
  );

beforeEach(() => {
  vi.clearAllMocks();
  vi.stubEnv("EMAIL_ENCRYPTION_KEY", TEST_KEY);
  newsletterSignupLimiter.reset();
  vi.mocked(db.newsletterSubscriber.create).mockResolvedValue({
    id: "sub_1",
  } as never);
  vi.mocked(db.newsletterSubscriber.findFirst).mockResolvedValue(null as never);
  vi.mocked(db.newsletterSubscriber.delete).mockResolvedValue({} as never);
  vi.mocked(sendEmail).mockResolvedValue(undefined);
});

describe("POST /api/newsletter (double opt-in)", () => {
  it("400s on invalid input and neither writes nor emails", async () => {
    const res = await post({ name: "", email: "nope" });
    expect(res.status).toBe(400);
    expect(db.newsletterSubscriber.create).not.toHaveBeenCalled();
    expect(sendEmail).not.toHaveBeenCalled();
  });

  it("creates a PENDING subscriber with encrypted email + hash and emails a confirm link", async () => {
    const res = await post({ name: "  Jos ", email: "JOS@X.com" });
    expect(res.status).toBe(201);

    expect(db.newsletterSubscriber.create).toHaveBeenCalledWith({
      data: {
        name: "Jos",
        // Stored value is AES-256-GCM ciphertext, never the plaintext address.
        email: expect.stringMatching(/^v1:/),
        // Deterministic keyed hash backs the unique duplicate check.
        emailHash: emailHash("jos@x.com"),
        status: "PENDING",
        confirmToken: expect.stringMatching(/^[0-9a-f]{64}$/),
      },
    });
    const stored = vi.mocked(db.newsletterSubscriber.create).mock.calls[0][0]
      .data as { email: string };
    expect(stored.email).not.toContain("jos@x.com");
    expect(decryptEmail(stored.email)).toBe("jos@x.com");

    // The confirmation email still goes to the real (plaintext) address.
    expect(sendEmail).toHaveBeenCalledTimes(1);
    const arg = vi.mocked(sendEmail).mock.calls[0][0];
    expect(arg.to).toBe("jos@x.com");
    expect(arg.html).toContain("/api/newsletter/confirm?token=");
  });

  it("treats a duplicate email as a silent success (201, no enumeration), without emailing", async () => {
    vi.mocked(db.newsletterSubscriber.create).mockRejectedValue(
      new Prisma.PrismaClientKnownRequestError("dup", {
        code: "P2002",
        clientVersion: "x",
      }) as never,
    );
    const res = await post({ name: "Jos", email: "jos@x.com" });
    // Same response as a fresh signup — must not reveal the address is known.
    expect(res.status).toBe(201);
    expect(await res.json()).toEqual({ ok: true });
    expect(sendEmail).not.toHaveBeenCalled();
  });

  it("treats an unmigrated legacy plaintext row as a duplicate (silent 201, no create, no email)", async () => {
    // Legacy rows have emailHash = NULL, which a unique index never matches —
    // the route must check for them explicitly or re-signups create duplicates.
    vi.mocked(db.newsletterSubscriber.findFirst).mockResolvedValue({
      id: "legacy_1",
    } as never);
    const res = await post({ name: "Jos", email: "jos@x.com" });
    expect(res.status).toBe(201);
    expect(await res.json()).toEqual({ ok: true });
    expect(db.newsletterSubscriber.create).not.toHaveBeenCalled();
    expect(sendEmail).not.toHaveBeenCalled();
  });

  it("rolls back the row and 500s if the confirmation email fails", async () => {
    vi.mocked(sendEmail).mockRejectedValue(new Error("resend down"));
    const res = await post({ name: "Jos", email: "jos@x.com" });
    expect(res.status).toBe(500);
    expect(db.newsletterSubscriber.delete).toHaveBeenCalledWith({
      where: { id: "sub_1" },
    });
  });

  it("rate-limits repeated signups from the same IP (429)", async () => {
    const fromIp = (email: string) =>
      POST(
        new Request("http://localhost/api/newsletter", {
          method: "POST",
          headers: { "x-forwarded-for": "9.9.9.9" },
          body: JSON.stringify({ name: "X", email }),
        }),
      );
    // Five allowed within the window...
    for (let i = 0; i < 5; i++) {
      expect((await fromIp(`u${i}@x.com`)).status).toBe(201);
    }
    // ...the sixth is throttled and never touches the DB or the mailer.
    const blocked = await fromIp("u5@x.com");
    expect(blocked.status).toBe(429);
  });

  it("cannot be bypassed by spoofing leftmost x-forwarded-for entries", async () => {
    // The client controls the leftmost entries; only the rightmost was
    // appended by our proxy. Varying the spoofed prefix must not reset the
    // limiter for the real client IP.
    const spoofed = (i: number) =>
      POST(
        new Request("http://localhost/api/newsletter", {
          method: "POST",
          headers: { "x-forwarded-for": `10.0.0.${i}, 203.0.113.7` },
          body: JSON.stringify({ name: "X", email: `s${i}@x.com` }),
        }),
      );
    for (let i = 0; i < 5; i++) {
      expect((await spoofed(i)).status).toBe(201);
    }
    const blocked = await spoofed(5);
    expect(blocked.status).toBe(429);
  });
});
