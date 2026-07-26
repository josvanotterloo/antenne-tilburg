// @vitest-environment node
import { loadFeature, describeFeature } from "@amiceli/vitest-cucumber";
import { vi, expect } from "vitest";

// Same in-memory stand-in shape as
// app/api/newsletter/newsletter-flow.integration.test.ts — only the
// operations this scenario needs (create, confirm-token lookup, update,
// admin listing, and the send-failure rollback's delete).
type Row = {
  id: string;
  name: string;
  email: string;
  emailHash: string;
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
          const row: Row = { id: `sub_${++seq}`, createdAt: new Date(), ...data };
          store.set(row.id, row);
          return row;
        }),
        findFirst: vi.fn(async () => null),
        findUnique: vi.fn(
          async ({ where }: { where: { confirmToken?: string } }) => {
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
        findMany: vi.fn(async () => [...store.values()]),
      },
    },
  };
});

vi.mock("@/lib/email/send", () => ({ sendEmail: vi.fn() }));

import { db } from "@/lib/db";
import { POST as signup } from "@/app/api/newsletter/route";
import { GET as confirm } from "@/app/api/newsletter/confirm/route";

const feature = await loadFeature("features/newsletter-signup.feature");

describeFeature(feature, ({ Scenario, BeforeEachScenario }) => {
  BeforeEachScenario(() => {
    store.clear();
    vi.clearAllMocks();
    vi.stubEnv("EMAIL_ENCRYPTION_KEY", "d".repeat(64));
  });

  Scenario("Successful double opt-in signup", ({ Given, When, Then }) => {
    let confirmToken: string;

    Given("a visitor submits their name and email", async () => {
      const res = await signup(
        new Request("http://localhost/api/newsletter", {
          method: "POST",
          body: JSON.stringify({ name: "Ada", email: "ada@x.com" }),
        }),
      );
      expect(res.status).toBe(201);
      confirmToken = [...store.values()][0].confirmToken;
    });

    When("they click the confirmation link in their email", async () => {
      const res = await confirm(
        new Request(
          `http://localhost/api/newsletter/confirm?token=${confirmToken}`,
        ),
      );
      expect(res.status).toBe(200);
    });

    Then("they appear as a confirmed subscriber in the admin", async () => {
      // Same query app/admin/settings/subscribers/page.tsx runs before
      // rendering — asserting on it directly avoids pulling RSC rendering
      // into a node-environment acceptance test.
      const subscribers = await db.newsletterSubscriber.findMany();
      const ada = subscribers.find((s) => s.name === "Ada");
      expect(ada?.status).toBe("CONFIRMED");
    });
  });
});
