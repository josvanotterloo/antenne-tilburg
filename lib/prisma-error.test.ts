import { describe, it, expect } from "vitest";
import {
  ALREADY_EXISTS,
  NOT_FOUND,
  STILL_REFERENCED,
  mapPrismaError,
  prismaErrorCode,
  prismaErrorResponse,
} from "./prisma-error";

describe("prismaErrorCode", () => {
  it("extracts the code from a Prisma-shaped error", () => {
    expect(prismaErrorCode({ code: "P2025" })).toBe("P2025");
  });

  it("returns undefined for a plain Error with no code", () => {
    expect(prismaErrorCode(new Error("boom"))).toBeUndefined();
  });

  it("returns undefined for null, undefined, and non-object values", () => {
    expect(prismaErrorCode(null)).toBeUndefined();
    expect(prismaErrorCode(undefined)).toBeUndefined();
    expect(prismaErrorCode("boom")).toBeUndefined();
  });

  it("returns undefined when code is present but not a string", () => {
    expect(prismaErrorCode({ code: 2025 })).toBeUndefined();
  });
});

// One test per mapped code (the three this repo actually hits — confirmed
// by grepping every "P2\d{3}" literal in app/ and lib/: only P2002, P2025,
// P2003 appear anywhere). Each named constant is itself the "default"
// interpretation of its code; mapPrismaError never applies these on its
// own — see the describe block below for why.
describe("mapPrismaError", () => {
  it("P2002, handled → 409 via ALREADY_EXISTS", () => {
    expect(mapPrismaError({ code: "P2002" }, { P2002: ALREADY_EXISTS })).toEqual({
      status: 409,
      body: { error: "Already exists" },
    });
  });

  it("P2025, handled → 404 via NOT_FOUND", () => {
    expect(mapPrismaError({ code: "P2025" }, { P2025: NOT_FOUND })).toEqual({
      status: 404,
      body: { error: "Not found" },
    });
  });

  it("P2003, handled → 409 via STILL_REFERENCED", () => {
    expect(mapPrismaError({ code: "P2003" }, { P2003: STILL_REFERENCED })).toEqual({
      status: 409,
      body: { error: "Still referenced by other records" },
    });
  });

  it("a per-call response can replace a named constant entirely", () => {
    expect(
      mapPrismaError(
        { code: "P2025" },
        { P2025: { status: 400, body: { error: "Selected relation no longer exists" } } },
      ),
    ).toEqual({ status: 400, body: { error: "Selected relation no longer exists" } });
  });

  it("a per-call response can map a code to a non-error shape (newsletter signup's P2002 → 201)", () => {
    expect(
      mapPrismaError({ code: "P2002" }, { P2002: { status: 201, body: { ok: true } } }),
    ).toEqual({ status: 201, body: { ok: true } });
  });

  it("a known code NOT listed in handlers is left unmapped — the caller must rethrow it", () => {
    // This is the whole point of requiring `handlers` explicitly: a route
    // that only ever checked P2002 must keep rethrowing P2025, not start
    // silently answering a code it never considered. An earlier version
    // of this module applied a global default table to every code
    // regardless of `handlers` — caught by /code-review on the branch
    // that introduced this module: it was silently widening what several
    // routes handled (e.g. a P2002/P2003 on a product write, previously
    // an unhandled 500 visible to Sentry, would have started returning a
    // generic 409 with no server-side signal at all).
    expect(mapPrismaError({ code: "P2025" }, { P2002: ALREADY_EXISTS })).toBeUndefined();
  });

  it("returns undefined for a Prisma code this repo doesn't handle at all", () => {
    expect(
      mapPrismaError(
        { code: "P2014" },
        { P2002: ALREADY_EXISTS, P2025: NOT_FOUND, P2003: STILL_REFERENCED },
      ),
    ).toBeUndefined();
  });

  it("returns undefined for a non-Prisma error — caller must rethrow it", () => {
    expect(
      mapPrismaError(new Error("connection refused"), {
        P2002: ALREADY_EXISTS,
        P2025: NOT_FOUND,
        P2003: STILL_REFERENCED,
      }),
    ).toBeUndefined();
  });
});

describe("prismaErrorResponse", () => {
  it("builds the Response directly for a handled code", async () => {
    const response = prismaErrorResponse({ code: "P2025" }, { P2025: NOT_FOUND });
    expect(response).toBeDefined();
    expect(response!.status).toBe(404);
    expect(await response!.json()).toEqual({ error: "Not found" });
  });

  it("returns undefined for an unhandled error, so the caller rethrows", () => {
    expect(prismaErrorResponse(new Error("boom"), { P2025: NOT_FOUND })).toBeUndefined();
  });
});

describe("regression: explicit handlers catch the historical bugs they were written for", () => {
  // Reconstructed from `git show 8c36753^:app/api/admin/products/[id]/route.ts`
  // and `git show 8c36753^:lib/reference-crud.ts`: before this commit,
  // DELETE /api/admin/products/[id] called `db.product.delete` with NO
  // try/catch at all, and lib/reference-crud.ts's POST/PATCH called
  // `delegate.create`/`delegate.update` with no catch either — a P2025 or
  // P2002 from either one propagated as an unhandled exception (an
  // unhandled 500 in Next.js's own handling), not the 404/409 these routes
  // return today.
  it("a P2025 handler gives DELETE .../products/[id] its 404 for the gap 8c36753 fixed", () => {
    expect(mapPrismaError({ code: "P2025" }, { P2025: NOT_FOUND })?.status).toBe(404);
  });

  it("a P2002 handler gives reference POST/PATCH their 409 for the gap 8c36753 fixed", () => {
    expect(mapPrismaError({ code: "P2002" }, { P2002: ALREADY_EXISTS })?.status).toBe(409);
  });

  // Reconstructed from `git show a97258e^:app/api/admin/products/[id]/route.ts`:
  // before this commit, PATCH /api/admin/products/[id] called
  // `db.product.update` with no try/catch either — same unhandled-500
  // shape, this time for a concurrently-deleted product or a relation that
  // no longer exists on update.
  it("a P2025 handler gives PATCH .../products/[id] its 404 for the gap a97258e fixed", () => {
    expect(mapPrismaError({ code: "P2025" }, { P2025: NOT_FOUND })?.status).toBe(404);
  });

  // dff0130 does NOT demonstrate a gap this mapper closes. Its diff
  // (`git show dff0130 -- app/api/admin/products/route.ts`) shows the bug
  // was `applyStockTransaction`'s `{ok:false}` result being thrown as a
  // bare `Error`, which the route's existing P2025-only catch didn't
  // recognize and rethrew as a 500 — not a Prisma error at all, so no
  // Prisma-error-code mapper, however complete, could have caught it. The
  // actual fix was a dedicated `StockWriteFailed` error class checked
  // with `instanceof` before falling through to the Prisma mapping; that
  // check is unrelated to this module and is left exactly as it was.
});
