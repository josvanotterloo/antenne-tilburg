// @vitest-environment node
import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";

vi.mock("next-auth/jwt", () => ({
  getToken: vi.fn(),
}));

import { getToken } from "next-auth/jwt";
import proxy from "./proxy";

const mockGetToken = vi.mocked(getToken);

function request(pathname: string, headers: Record<string, string> = {}) {
  return new NextRequest(new URL(`http://localhost:3000${pathname}`), {
    headers,
  });
}

describe("proxy", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("redirects an unauthenticated request for an admin page to login", async () => {
    mockGetToken.mockResolvedValue(null);

    const response = await proxy(request("/admin/catalog"));

    expect(response.status).toBe(307);
    const location = new URL(response.headers.get("location")!);
    expect(location.pathname).toBe("/admin/login");
    expect(location.searchParams.get("callbackUrl")).toContain("/admin/catalog");
  });

  it("redirects an unauthenticated request for bare /admin to login", async () => {
    mockGetToken.mockResolvedValue(null);

    const response = await proxy(request("/admin"));

    expect(response.status).toBe(307);
    expect(new URL(response.headers.get("location")!).pathname).toBe("/admin/login");
  });

  it("lets an authenticated request through to an admin page", async () => {
    mockGetToken.mockResolvedValue({ id: "user-1" } as never);

    const response = await proxy(request("/admin/catalog"));

    expect(response.status).toBe(200);
    expect(response.headers.get("location")).toBeNull();
  });

  it("never checks a token for a non-admin path", async () => {
    const response = await proxy(request("/api/catalog"));

    expect(mockGetToken).not.toHaveBeenCalled();
    expect(response.status).toBe(200);
  });

  it("generates a request id and sets it on the response when none was sent", async () => {
    const response = await proxy(request("/api/catalog"));

    expect(response.headers.get("x-request-id")).toMatch(
      /^[0-9a-f-]{36}$/,
    );
  });

  it("passes through a caller-supplied request id instead of generating a new one", async () => {
    const response = await proxy(
      request("/api/catalog", { "x-request-id": "caller-id-123" }),
    );

    expect(response.headers.get("x-request-id")).toBe("caller-id-123");
  });

  it("sets the request id on the redirect response too", async () => {
    mockGetToken.mockResolvedValue(null);

    const response = await proxy(
      request("/admin/catalog", { "x-request-id": "caller-id-123" }),
    );

    expect(response.headers.get("x-request-id")).toBe("caller-id-123");
  });
});
