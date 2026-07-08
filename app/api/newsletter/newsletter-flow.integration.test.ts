// @vitest-environment node
//
// Integration test for the full newsletter lifecycle. Runs the real route
// handlers, token generation, confirm/expiry logic and email rendering against an
// in-memory stand-in for the DB. Only Resend (the sendEmail wrapper) and the admin
// guard are stubbed, so no real emails are sent.
import { describe, it, expect, vi, beforeEach } from "vitest";
import { Prisma } from "@prisma/client";

type Row = {
  id: string;
  name: string;
  email: string;
  status: string;
  confirmToken: string;
  createdAt: Date;
};

const { store } = vi.hoisted(() => ({ store: new Map<string, Row>() }));

vi.mock("@/lib/db", () => {
  let seq = 0;
  return {
    db: {
      newsletterSubscriber: {
        create: vi.fn(async ({ data }: { data: Omit<Row, "id" | "createdAt"> }) => {
          for (const s of store.values()) {
            if (s.email === data.email) {
              throw new Prisma.PrismaClientKnownRequestError("dup", {
                code: "P2002",
                clientVersion: "test",
              });
            }
          }
          const row: Row = { id: `sub_${++seq}`, createdAt: new Date(), ...data };
          store.set(row.id, row);
          return row;
        }),
        findUnique: vi.fn(
          async ({ where }: { where: { id?: string; confirmToken?: string } }) => {
            if (where.id) return store.get(where.id) ?? null;
            for (const s of store.values()) {
              if (s.confirmToken === where.confirmToken) return s;
            }
            return null;
          },
        ),
        update: vi.fn(
          async ({ where, data }: { where: { id: string }; data: Partial<Row> }) => {
            const row = store.get(where.id)!;
            Object.assign(row, data);
            return row;
          },
        ),
        delete: vi.fn(async ({ where }: { where: { id: string } }) => {
          const row = store.get(where.id)!;
          store.delete(where.id);
          return row;
        }),
        findMany: vi.fn(async (args?: { where?: { status?: string } }) => {
          let rows = [...store.values()];
          if (args?.where?.status) {
            rows = rows.filter((r) => r.status === args.where!.status);
          }
          return rows;
        }),
      },
    },
  };
});

vi.mock("@/lib/email/send", () => ({ sendEmail: vi.fn() }));
vi.mock("@/lib/api-auth", () => ({
  requireAdmin: vi.fn().mockResolvedValue(null),
}));

import { POST as signup } from "@/app/api/newsletter/route";
import { GET as confirm } from "@/app/api/newsletter/confirm/route";
import { POST as sendNewsletter } from "@/app/api/admin/newsletter/send/route";
import { GET as unsubscribe } from "@/app/api/newsletter/unsubscribe/route";
import { sendEmail } from "@/lib/email/send";

const signupReq = (body: unknown) =>
  signup(
    new Request("http://localhost/api/newsletter", {
      method: "POST",
      body: JSON.stringify(body),
    }),
  );
const confirmReq = (token: string) =>
  confirm(new Request(`http://localhost/api/newsletter/confirm?token=${token}`));
const sendReq = (body: unknown) =>
  sendNewsletter(
    new Request("http://localhost/api/admin/newsletter/send", {
      method: "POST",
      body: JSON.stringify(body),
    }),
  );
const unsubReq = (token: string) =>
  unsubscribe(
    new Request(`http://localhost/api/newsletter/unsubscribe?token=${token}`),
  );

const only = () => [...store.values()][0];

beforeEach(() => {
  store.clear();
  vi.clearAllMocks();
  vi.mocked(sendEmail).mockResolvedValue(undefined);
});

describe("newsletter flow (integration)", () => {
  it("signup → confirm → send → unsubscribe", async () => {
    // 1. Signup → 201, PENDING subscriber with a confirmToken, confirmation emailed.
    const res1 = await signupReq({ name: "Ada", email: "ada@x.com" });
    expect(res1.status).toBe(201);
    const sub = only();
    expect(sub.status).toBe("PENDING");
    expect(sub.confirmToken).toMatch(/^[0-9a-f]{64}$/);
    expect(sendEmail).toHaveBeenCalledTimes(1); // confirmation email
    expect(vi.mocked(sendEmail).mock.calls[0][0].html).toContain(
      `/api/newsletter/confirm?token=${sub.confirmToken}`,
    );

    // 2. Confirm → 200, status becomes CONFIRMED.
    const res2 = await confirmReq(sub.confirmToken);
    expect(res2.status).toBe(200);
    expect(store.get(sub.id)!.status).toBe("CONFIRMED");

    // 3. Send → 200, sent=1, Resend stub called with correct to/subject/html.
    vi.mocked(sendEmail).mockClear();
    const res3 = await sendReq({ subject: "New arrivals", body: "Fresh **wax**" });
    expect(res3.status).toBe(200);
    expect(await res3.json()).toMatchObject({ ok: true, sent: 1, failed: 0 });
    expect(sendEmail).toHaveBeenCalledTimes(1);
    const emailArg = vi.mocked(sendEmail).mock.calls[0][0];
    expect(emailArg.to).toBe("ada@x.com");
    expect(emailArg.subject).toBe("New arrivals");
    expect(emailArg.html).toContain("<strong"); // markdown rendered

    // 4. Unsubscribe link in the sent email carries the subscriber's token.
    expect(emailArg.html).toContain(
      `/api/newsletter/unsubscribe?token=${sub.confirmToken}`,
    );

    // 5. Unsubscribe → 200, subscriber deleted.
    const res5 = await unsubReq(sub.confirmToken);
    expect(res5.status).toBe(200);
    expect(store.get(sub.id)).toBeUndefined();
  });

  it("duplicate signup returns 201 without creating a second subscriber (no enumeration)", async () => {
    await signupReq({ name: "Ada", email: "ada@x.com" });
    expect(store.size).toBe(1);

    const res = await signupReq({ name: "Impostor", email: "ada@x.com" });
    expect(res.status).toBe(201);
    expect(store.size).toBe(1);
  });

  it("confirm with an expired token (createdAt > 48h) returns 400", async () => {
    await signupReq({ name: "Ada", email: "ada@x.com" });
    const sub = only();
    sub.createdAt = new Date(Date.now() - 49 * 60 * 60 * 1000);

    const res = await confirmReq(sub.confirmToken);
    expect(res.status).toBe(400);
    expect(store.get(sub.id)!.status).toBe("PENDING");
  });

  it("confirm with an invalid token returns 404", async () => {
    const res = await confirmReq("deadbeef");
    expect(res.status).toBe(404);
  });
});
