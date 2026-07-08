import { describe, it, expect, vi, beforeEach } from "vitest";

// Isolate authorizeCredentials from the real DB and native bcrypt.
vi.mock("@/lib/db", () => ({
  db: { user: { findUnique: vi.fn() } },
}));
vi.mock("bcrypt", () => ({
  compare: vi.fn(),
}));

import { authorizeCredentials } from "@/lib/authorize";
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
});
