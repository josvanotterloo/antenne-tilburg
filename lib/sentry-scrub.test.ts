import { describe, it, expect } from "vitest";
import type { ErrorEvent } from "@sentry/nextjs";

import { scrubEmails } from "@/lib/sentry-scrub";

describe("scrubEmails", () => {
  it("redacts an email address found in an exception message", () => {
    const event = {
      exception: {
        values: [{ type: "Error", value: "failed for jos@example.com" }],
      },
    } as ErrorEvent;

    const scrubbed = scrubEmails(event);

    expect(JSON.stringify(scrubbed)).not.toContain("jos@example.com");
    expect(scrubbed?.exception?.values?.[0].value).toBe(
      "failed for [redacted-email]",
    );
  });

  it("redacts multiple email addresses across different fields", () => {
    const event = {
      message: "subscriber a@b.com failed, cc admin@shop.nl",
      breadcrumbs: [{ message: "sent to c@d.com" }],
    } as ErrorEvent;

    const scrubbed = scrubEmails(event);

    const serialized = JSON.stringify(scrubbed);
    expect(serialized).not.toContain("a@b.com");
    expect(serialized).not.toContain("admin@shop.nl");
    expect(serialized).not.toContain("c@d.com");
    expect(serialized).toContain("[redacted-email]");
  });

  it("leaves an event with no email-shaped content unchanged", () => {
    const event = { message: "database connection failed" } as ErrorEvent;

    const scrubbed = scrubEmails(event);

    expect(scrubbed).toEqual(event);
  });

  it("drops the event rather than risk sending unscrubbed PII if serialization fails", () => {
    // A BigInt makes JSON.stringify throw — exercises the fail-safe path.
    const event = {
      message: "boom",
      extra: { count: 1n },
    } as unknown as ErrorEvent;

    expect(scrubEmails(event)).toBeNull();
  });
});
