// @vitest-environment node
import { afterEach, describe, it, expect, vi } from "vitest";

import { apiSend } from "@/lib/api-client";

afterEach(() => vi.unstubAllGlobals());

const stubFetch = (impl: () => Promise<Response> | Response) =>
  vi.stubGlobal("fetch", vi.fn(impl));

const jsonResponse = (status: number, body: unknown) =>
  new Response(body === undefined ? null : JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json" },
  });

describe("apiSend", () => {
  it("returns the parsed JSON on a 2xx response", async () => {
    stubFetch(() => jsonResponse(200, { id: "x", name: "House" }));
    await expect(apiSend("/api/x")).resolves.toEqual({ id: "x", name: "House" });
  });

  it("resolves (undefined) for an empty 2xx body", async () => {
    stubFetch(() => new Response(null, { status: 204 }));
    await expect(apiSend("/api/x", { method: "DELETE" })).resolves.toBeUndefined();
  });

  it("throws the server's {error} message on a non-ok response", async () => {
    stubFetch(() => jsonResponse(409, { error: "That name already exists" }));
    await expect(apiSend("/api/x", { method: "POST" })).rejects.toThrow(
      "That name already exists",
    );
  });

  it("throws a generic message on a non-ok response with no/blank body", async () => {
    stubFetch(() => new Response(null, { status: 500 }));
    await expect(apiSend("/api/x")).rejects.toThrow(/something went wrong/i);
  });

  it("throws a connection message when fetch itself rejects (network down)", async () => {
    stubFetch(() => {
      throw new TypeError("Failed to fetch");
    });
    await expect(apiSend("/api/x")).rejects.toThrow(/reach the server/i);
  });

  it("passes method/headers/body through to fetch", async () => {
    const fetchMock = vi.fn(() => jsonResponse(201, { ok: true }));
    vi.stubGlobal("fetch", fetchMock);
    await apiSend("/api/x", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ a: 1 }),
    });
    expect(fetchMock).toHaveBeenCalledWith(
      "/api/x",
      expect.objectContaining({ method: "POST" }),
    );
  });
});
