// @vitest-environment node
import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("next-auth", () => ({ getServerSession: vi.fn() }));
vi.mock("@/lib/auth", () => ({ authOptions: {} }));

import { requireAdmin } from "@/lib/api-auth";
import { getServerSession } from "next-auth";

const mockSession = vi.mocked(getServerSession);

describe("requireAdmin", () => {
  beforeEach(() => vi.clearAllMocks());

  it("returns a 401 response when there is no session", async () => {
    mockSession.mockResolvedValue(null);
    const res = await requireAdmin();
    expect(res).not.toBeNull();
    expect(res?.status).toBe(401);
  });

  it("returns null when a session exists", async () => {
    mockSession.mockResolvedValue({
      user: { id: "u1", email: "a@b.c" },
      expires: "",
    });
    const res = await requireAdmin();
    expect(res).toBeNull();
  });
});
