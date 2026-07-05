// @vitest-environment node
import { describe, it, expect } from "vitest";

import { resolveAdminSeedUsers } from "@/lib/seed-users";

const base = {
  SEED_ADMIN_SHOP_PASSWORD: "shop-secret-123",
  SEED_ADMIN_DEV_PASSWORD: "dev-secret-456",
};

describe("resolveAdminSeedUsers", () => {
  it("returns both admins with env passwords and default emails", () => {
    expect(resolveAdminSeedUsers(base)).toEqual([
      { email: "shop@antenne-tilburg.nl", password: "shop-secret-123" },
      { email: "dev@antenne-tilburg.nl", password: "dev-secret-456" },
    ]);
  });

  it("allows overriding the admin emails", () => {
    const users = resolveAdminSeedUsers({
      ...base,
      SEED_ADMIN_SHOP_EMAIL: "owner@example.com",
      SEED_ADMIN_DEV_EMAIL: "builder@example.com",
    });
    expect(users.map((u) => u.email)).toEqual([
      "owner@example.com",
      "builder@example.com",
    ]);
  });

  it("throws, naming the missing var, when a password is absent", () => {
    expect(() =>
      resolveAdminSeedUsers({ SEED_ADMIN_SHOP_PASSWORD: "shop-secret-123" }),
    ).toThrow(/SEED_ADMIN_DEV_PASSWORD/);
  });

  it("throws when a password is too short", () => {
    expect(() =>
      resolveAdminSeedUsers({ ...base, SEED_ADMIN_DEV_PASSWORD: "short" }),
    ).toThrow(/at least 8/);
  });

  it("never silently seeds a weak default when nothing is set", () => {
    expect(() => resolveAdminSeedUsers({})).toThrow();
  });
});
