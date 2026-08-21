// app/api/admin/label/[productId]/route.test.ts
// @vitest-environment node
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

vi.mock("@/lib/api-auth", () => ({
  requireAdmin: vi.fn().mockResolvedValue(null),
}));
vi.mock("@/lib/db", () => ({
  db: { product: { findUnique: vi.fn() } },
}));

import { db } from "@/lib/db";
import { requireAdmin } from "@/lib/api-auth";
import { GET } from "@/app/api/admin/label/[productId]/route";

const mockRequireAdmin = vi.mocked(requireAdmin);

const PRODUCT = {
  id: "p1",
  title: "Torus",
  catalogNumber: "ZR-001",
  price: "24.99",
  condition: "NEW",
  productArtists: [
    { position: 0, artistId: "a1", artist: { id: "a1", name: "Vril" } },
  ],
  label: { id: "l1", name: "Zulema Records" },
  productGenres: [
    { position: 0, genreId: "g1", genre: { id: "g1", name: "Techno" } },
  ],
  productType: { id: "t1", name: "LP" },
};

const call = (id: string) =>
  GET(new Request(`http://x/api/admin/label/${id}`), {
    params: Promise.resolve({ productId: id }),
  });

const ORIGINAL_ENV = { ...process.env };

beforeEach(() => {
  vi.clearAllMocks();
  mockRequireAdmin.mockResolvedValue(null);
  process.env = { ...ORIGINAL_ENV };
  delete process.env.DYMO_MODE;
  delete process.env.DYMO_PRINTER_NAME;
});

afterEach(() => {
  process.env = { ...ORIGINAL_ENV };
  vi.unstubAllGlobals();
  vi.useRealTimers();
});

describe("GET /api/admin/label/[productId]", () => {
  it("returns 401 from requireAdmin when unauthenticated", async () => {
    mockRequireAdmin.mockResolvedValue(new Response(null, { status: 401 }) as never);
    const res = await call("p1");
    expect(res.status).toBe(401);
  });

  it("returns 404 for an unknown product", async () => {
    vi.mocked(db.product.findUnique).mockResolvedValue(null as never);
    const res = await call("missing");
    expect(res.status).toBe(404);
  });

  it("returns 422 with the missing field list for an incomplete product", async () => {
    vi.mocked(db.product.findUnique).mockResolvedValue({
      ...PRODUCT,
      productArtists: [],
    } as never);
    const res = await call("p1");
    expect(res.status).toBe(422);
    const body = await res.json();
    expect(body.fields).toContain("Artist");
  });

  it("returns text/xml with an inline disposition by default (no DYMO_MODE set)", async () => {
    vi.mocked(db.product.findUnique).mockResolvedValue(PRODUCT as never);
    const res = await call("p1");
    expect(res.status).toBe(200);
    expect(res.headers.get("content-type")).toMatch(/xml/);
    expect(res.headers.get("content-disposition")).toBe("inline");
    const body = await res.text();
    expect(body).toContain("<DieCutLabel");
  });

  it("returns text/xml explicitly in preview mode", async () => {
    process.env.DYMO_MODE = "preview";
    vi.mocked(db.product.findUnique).mockResolvedValue(PRODUCT as never);
    const res = await call("p1");
    expect(res.headers.get("content-type")).toMatch(/xml/);
  });

  it("posts to the local Dymo service in print mode and returns ok", async () => {
    process.env.DYMO_MODE = "print";
    process.env.DYMO_PRINTER_NAME = "DYMO LabelWriter 450";
    vi.mocked(db.product.findUnique).mockResolvedValue(PRODUCT as never);

    const fetchMock = vi.fn().mockResolvedValue(new Response("ok", { status: 200 }));
    vi.stubGlobal("fetch", fetchMock);

    const res = await call("p1");

    expect(fetchMock).toHaveBeenCalledWith(
      "http://localhost:41951/DYMO/DLS/Printing/PrintLabel",
      expect.objectContaining({ method: "POST" }),
    );
    const [, options] = fetchMock.mock.calls[0];
    const sentBody = options.body as URLSearchParams;
    expect(sentBody.get("printerName")).toBe("DYMO LabelWriter 450");
    expect(sentBody.get("labelXml")).toContain("<DieCutLabel");
    expect(res.status).toBe(200);
  });

  it("returns 500 with a clear message when DYMO_MODE=print and DYMO_PRINTER_NAME is unset", async () => {
    process.env.DYMO_MODE = "print";
    vi.mocked(db.product.findUnique).mockResolvedValue(PRODUCT as never);

    const res = await call("p1");

    expect(res.status).toBe(500);
    const body = await res.json();
    expect(body.error).toMatch(/DYMO_PRINTER_NAME/);
  });

  it("returns a clear error when Dymo Connect is unreachable in print mode", async () => {
    process.env.DYMO_MODE = "print";
    process.env.DYMO_PRINTER_NAME = "DYMO LabelWriter 450";
    vi.mocked(db.product.findUnique).mockResolvedValue(PRODUCT as never);

    const fetchMock = vi.fn().mockRejectedValue(new Error("ECONNREFUSED"));
    vi.stubGlobal("fetch", fetchMock);

    const res = await call("p1");

    expect(res.status).toBe(502);
    const body = await res.json();
    expect(body.error).toMatch(/Dymo Connect/i);
  });

  it("returns 502 with response detail when Dymo Connect responds with a non-2xx status", async () => {
    process.env.DYMO_MODE = "print";
    process.env.DYMO_PRINTER_NAME = "DYMO LabelWriter 450";
    vi.mocked(db.product.findUnique).mockResolvedValue(PRODUCT as never);

    const fetchMock = vi
      .fn()
      .mockResolvedValue(new Response("bad printer name", { status: 500 }));
    vi.stubGlobal("fetch", fetchMock);

    const res = await call("p1");

    expect(res.status).toBe(502);
    const body = await res.json();
    expect(body.error).toBe("Dymo Connect print failed");
    expect(body.detail).toContain("bad printer name");
  });

  it("returns 504 when Dymo Connect does not respond within 5s", async () => {
    process.env.DYMO_MODE = "print";
    process.env.DYMO_PRINTER_NAME = "DYMO LabelWriter 450";
    vi.mocked(db.product.findUnique).mockResolvedValue(PRODUCT as never);

    vi.useFakeTimers();
    const fetchMock = vi.fn(
      (_url: string, options: { signal: AbortSignal }) =>
        new Promise<Response>((_, reject) => {
          options.signal.addEventListener("abort", () =>
            reject(new DOMException("The operation was aborted", "AbortError")),
          );
        }),
    );
    vi.stubGlobal("fetch", fetchMock);

    const resPromise = call("p1");
    const assertion = expect(resPromise).resolves.toMatchObject({ status: 504 });
    await vi.advanceTimersByTimeAsync(5_000);
    await assertion;

    const res = await resPromise;
    const body = await res.json();
    expect(body.error).toBe(
      "DYMO Connect did not respond within 5s — is DYMO Connect Desktop running?",
    );
  });
});
