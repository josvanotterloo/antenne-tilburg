// @vitest-environment node
import { describe, it, expect } from "vitest";
import { existsSync, readFileSync } from "fs";
import { resolve } from "path";

// Guard: the events feature was removed entirely (notices cover one-off
// announcements). Fails if any event route, component, model, or nav entry returns.
const root = process.cwd();
const p = (rel: string) => resolve(root, rel);

describe("events are fully removed", () => {
  it.each([
    "app/admin/content/events",
    "app/admin/events",
    "app/api/admin/events",
    "components/admin/EventForm.tsx",
    "lib/event-input.ts",
    "lib/event-input.test.ts",
  ])("has no %s", (rel) => {
    expect(existsSync(p(rel))).toBe(false);
  });

  it("has no Event model or EventStatus enum in the schema", () => {
    const schema = readFileSync(p("prisma/schema.prisma"), "utf8");
    expect(schema).not.toMatch(/model Event\b/);
    expect(schema).not.toMatch(/enum EventStatus\b/);
  });

  it("has no Events entry in the admin Content nav", () => {
    const layout = readFileSync(p("app/admin/content/layout.tsx"), "utf8");
    expect(layout).not.toContain("/admin/content/events");
    expect(layout).not.toMatch(/Events/);
  });
});
