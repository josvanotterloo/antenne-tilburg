import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

// Isolate authorizeCredentials from the real DB and native bcrypt.
vi.mock("@/lib/db", () => ({
  db: { user: { findUnique: vi.fn() } },
}));
vi.mock("bcrypt", () => ({
  compare: vi.fn(),
}));

import { authorizeCredentials, loginEmailLimiter, loginIpLimiter } from "@/lib/authorize";
import { db } from "@/lib/db";
import { compare } from "bcrypt";

const findUnique = vi.mocked(db.user.findUnique);
const mockCompare = vi.mocked(compare);

const USER = {
  id: "u1",
  email: "shop@antenne-tilburg.nl",
  passwordHash: "$2b$12$examplehash",
  createdAt: new Date(),
  updatedAt: new Date(),
};

describe("authorizeCredentials", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    loginEmailLimiter.reset();
    loginIpLimiter.reset();
  });

  // Guarantees console spies from a test that fails mid-assertion don't leak
  // into later tests (vi.clearAllMocks alone doesn't un-spy console.error).
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("returns the user for valid credentials", async () => {
    findUnique.mockResolvedValue(USER);
    mockCompare.mockResolvedValue(true as never);

    const result = await authorizeCredentials({
      email: USER.email,
      password: "changeme123",
    });

    expect(result).toEqual({ id: "u1", email: USER.email });
    expect(mockCompare).toHaveBeenCalledWith("changeme123", USER.passwordHash);
  });

  it("returns null when the password is wrong", async () => {
    findUnique.mockResolvedValue(USER);
    mockCompare.mockResolvedValue(false as never);

    const result = await authorizeCredentials({
      email: USER.email,
      password: "wrong",
    });

    expect(result).toBeNull();
  });

  it("still runs bcrypt compare when the user is not found (constant-time)", async () => {
    findUnique.mockResolvedValue(null);
    mockCompare.mockResolvedValue(false as never);

    const result = await authorizeCredentials({
      email: "nobody@antenne-tilburg.nl",
      password: "changeme123",
    });

    expect(result).toBeNull();
    // Compare must still run (against a dummy hash) so response timing can't be
    // used to distinguish known from unknown emails.
    expect(mockCompare).toHaveBeenCalledTimes(1);
    expect(mockCompare.mock.calls[0][1]).toMatch(/^\$2[aby]\$/);
  });

  it("returns null and logs the error when the DB fails", async () => {
    const error = new Error("connection refused");
    findUnique.mockRejectedValue(error);
    const errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});

    const result = await authorizeCredentials({
      email: USER.email,
      password: "changeme123",
    });

    expect(result).toBeNull();
    expect(errorSpy).toHaveBeenCalledWith(
      "authorize: login check failed",
      error,
    );

    errorSpy.mockRestore();
  });

  it("returns null when credentials are missing", async () => {
    expect(await authorizeCredentials(undefined)).toBeNull();
    expect(await authorizeCredentials({ email: "", password: "" })).toBeNull();
    expect(findUnique).not.toHaveBeenCalled();
  });

  describe("structured auth.login logging", () => {
    function parseEvent(call: unknown[]) {
      try {
        return typeof call[0] === "string" ? JSON.parse(call[0]) : null;
      } catch {
        return null;
      }
    }

    function captureLogs() {
      const logSpy = vi.spyOn(console, "log").mockImplementation(() => {});
      const errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
      const events = () =>
        [...logSpy.mock.calls, ...errorSpy.mock.calls]
          .map(parseEvent)
          .filter((e): e is Record<string, unknown> => e !== null);
      return { events, restore: () => { logSpy.mockRestore(); errorSpy.mockRestore(); } };
    }

    it("logs auth.login ok with the user id, never the email, on success", async () => {
      findUnique.mockResolvedValue(USER);
      mockCompare.mockResolvedValue(true as never);
      const { events, restore } = captureLogs();

      await authorizeCredentials({ email: USER.email, password: "changeme123" });

      const loginEvents = events().filter((e) => e.event === "auth.login");
      expect(loginEvents).toEqual([
        { event: "auth.login", requestId: "unknown", outcome: "ok", userId: "u1" },
      ]);
      restore();
    });

    it("logs auth.login failed with reason bad_credentials for a wrong password", async () => {
      findUnique.mockResolvedValue(USER);
      mockCompare.mockResolvedValue(false as never);
      const { events, restore } = captureLogs();

      await authorizeCredentials({ email: USER.email, password: "wrong" });

      const loginEvents = events().filter((e) => e.event === "auth.login");
      expect(loginEvents).toEqual([
        { event: "auth.login", requestId: "unknown", outcome: "failed", reason: "bad_credentials" },
      ]);
      restore();
    });

    it("logs auth.login failed with reason bad_credentials for missing input", async () => {
      const { events, restore } = captureLogs();

      await authorizeCredentials(undefined);

      const loginEvents = events().filter((e) => e.event === "auth.login");
      expect(loginEvents).toEqual([
        { event: "auth.login", requestId: "unknown", outcome: "failed", reason: "bad_credentials" },
      ]);
      restore();
    });

    it("logs a structured error event (no error message) when the DB fails", async () => {
      findUnique.mockRejectedValue(new Error("connection refused"));
      const { events, restore } = captureLogs();

      await authorizeCredentials({ email: USER.email, password: "changeme123" });

      const errorEvents = events().filter((e) => e.event === "error");
      expect(errorEvents).toEqual([
        { event: "error", requestId: "unknown", where: "lib/authorize.ts", errorKind: "Error" },
      ]);
      restore();
    });
  });

  describe("rate limiting (OWASP audit finding #2)", () => {
    const attempt = (email: string, ip = "203.0.113.7") =>
      authorizeCredentials({ email, password: "wrong" }, ip);

    beforeEach(() => {
      findUnique.mockResolvedValue(USER);
      mockCompare.mockResolvedValue(false as never);
    });

    it("blocks further attempts for an email after repeated failures, without touching the DB", async () => {
      for (let i = 0; i < 5; i++) {
        expect(await attempt(USER.email, `10.0.0.${i}`)).toBeNull();
      }
      vi.clearAllMocks();

      // Sixth attempt on the same email (fresh IP): rejected before DB/bcrypt.
      expect(await attempt(USER.email, "10.0.0.99")).toBeNull();
      expect(findUnique).not.toHaveBeenCalled();
      expect(mockCompare).not.toHaveBeenCalled();
    });

    it("blocks a single IP hammering many emails", async () => {
      for (let i = 0; i < 20; i++) {
        await attempt(`probe${i}@x.com`, "198.51.100.1");
      }
      vi.clearAllMocks();

      expect(await attempt("probe99@x.com", "198.51.100.1")).toBeNull();
      expect(findUnique).not.toHaveBeenCalled();
    });

    it("logs auth.login failed with reason rate_limited once an email is locked out", async () => {
      for (let i = 0; i < 5; i++) {
        await attempt(USER.email, `10.0.0.${i}`);
      }
      const logSpy = vi.spyOn(console, "error").mockImplementation(() => {});

      await attempt(USER.email, "10.0.0.99");

      const loginEvents = logSpy.mock.calls
        .map((call) => {
          try {
            return JSON.parse(call[0] as string);
          } catch {
            return null;
          }
        })
        .filter((e): e is Record<string, unknown> => e?.event === "auth.login");
      expect(loginEvents).toEqual([
        { event: "auth.login", requestId: "unknown", outcome: "failed", reason: "rate_limited" },
      ]);
    });

    it("still authenticates a different email from a different IP when another account is locked", async () => {
      for (let i = 0; i < 5; i++) {
        await attempt(USER.email, "10.0.0.1");
      }
      mockCompare.mockResolvedValue(true as never);

      const result = await authorizeCredentials(
        { email: "other@antenne-tilburg.nl", password: "correct" },
        "203.0.113.50",
      );
      expect(result).toEqual({ id: "u1", email: USER.email });
    });

    it("successful logins within the limit are unaffected", async () => {
      mockCompare.mockResolvedValue(true as never);
      const result = await authorizeCredentials(
        { email: USER.email, password: "right" },
        "203.0.113.7",
      );
      expect(result).toEqual({ id: "u1", email: USER.email });
    });
  });
});
