import { describe, it, expect } from "vitest";
import { authConfig } from "@/lib/auth.config";
import type { JWT } from "next-auth/jwt";
import type { Session } from "next-auth";

describe("authConfig callbacks", () => {
  it("jwt copies the user's locale onto the token", () => {
    const token = {} as JWT;
    const result = authConfig.callbacks.jwt({
      token,
      user: { id: "u1", locale: "EN" },
    } as Parameters<typeof authConfig.callbacks.jwt>[0]);

    expect(result.locale).toBe("EN");
  });

  it("jwt copies the locale from a client update() call onto the token", () => {
    const token = { id: "u1", locale: "NL" } as JWT;
    const result = authConfig.callbacks.jwt({
      token,
      trigger: "update",
      session: { user: { locale: "EN" } },
    } as Parameters<typeof authConfig.callbacks.jwt>[0]);

    expect(result.locale).toBe("EN");
  });

  it("ignores an invalid locale and any other field sent via update()", () => {
    const token = { id: "u1", locale: "NL" } as JWT;
    const result = authConfig.callbacks.jwt({
      token,
      trigger: "update",
      session: { user: { locale: "XX", id: "other" } },
    } as Parameters<typeof authConfig.callbacks.jwt>[0]);

    expect(result.locale).toBe("NL");
    expect(result.id).toBe("u1");
  });

  it("session copies the token's locale onto session.user.locale", () => {
    const session = { user: {} } as Session;
    const token = { id: "u1", locale: "EN" } as JWT;
    const result = authConfig.callbacks.session({
      session,
      token,
    } as Parameters<typeof authConfig.callbacks.session>[0]);

    expect(result.user.locale).toBe("EN");
  });
});
