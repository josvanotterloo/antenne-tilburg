// @vitest-environment node
import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@/lib/auth", () => ({ auth: vi.fn() }));

import { requireAdmin, requireAdminUserId } from "@/lib/api-auth";
import { auth } from "@/lib/auth";

const mockAuth = vi.mocked(auth);

describe("requireAdmin", () => {
  beforeEach(() => vi.clearAllMocks());

  it("returns a 401 response when there is no session", async () => {
    mockAuth.mockResolvedValue(null as never);
    const res = await requireAdmin();
    expect(res).not.toBeNull();
    expect(res?.status).toBe(401);
  });

  it("returns null when a session exists", async () => {
    mockAuth.mockResolvedValue({
      user: { id: "u1", email: "a@b.c" },
      expires: "",
    } as never);
    const res = await requireAdmin();
    expect(res).toBeNull();
  });
});

describe("requireAdminUserId", () => {
  beforeEach(() => vi.clearAllMocks());

  it("returns a 401 response when there is no session", async () => {
    mockAuth.mockResolvedValue(null as never);
    const result = await requireAdminUserId();
    expect(result.denied?.status).toBe(401);
  });

  it("returns the session user's id when a session exists", async () => {
    mockAuth.mockResolvedValue({
      user: { id: "u1", email: "a@b.c" },
      expires: "",
    } as never);
    const result = await requireAdminUserId();
    expect(result.denied).toBeUndefined();
    expect("userId" in result && result.userId).toBe("u1");
  });
});
