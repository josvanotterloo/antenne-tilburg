import { NextResponse } from "next/server";

// Every Prisma error code this repo's routes actually translate to an HTTP
// response. Before this module, every route carried its own `(error as
// {code?:string}|null)?.code === "P2025"` cast-and-compare, repeated with
// small, easy-to-miss variations (8c36753, a97258e each added one more copy
// instead of fixing the pattern itself).
export type KnownPrismaErrorCode = "P2002" | "P2025" | "P2003";

const KNOWN_CODES: readonly KnownPrismaErrorCode[] = ["P2002", "P2025", "P2003"];

function isKnownCode(code: string): code is KnownPrismaErrorCode {
  return (KNOWN_CODES as readonly string[]).includes(code);
}

// The one shared safe-cast: Prisma's own types leave
// PrismaClientKnownRequestError.code as plain `string`, not a closed
// union/enum (confirmed by trying to narrow it — see the exhaustiveness
// note below), so every call site needs this same unsafe-looking cast.
// Centralizing it here means it only needs auditing in one place — for
// every *route*; lib/encrypt-legacy-subscribers.ts is a one-time backfill
// script, not a route, and is deliberately left on its own copy of this
// cast rather than migrated here.
export function prismaErrorCode(error: unknown): string | undefined {
  const code = (error as { code?: unknown } | null)?.code;
  return typeof code === "string" ? code : undefined;
}

export interface PrismaErrorResponse {
  status: number;
  body: unknown;
}

// Named, reusable responses for the common interpretation of a code —
// callers opt into exactly the ones they want via mapPrismaError's/
// prismaErrorResponse's `handlers` argument. Nothing is applied by
// default: a route that only ever checked P2002 must keep rethrowing
// P2025/P2003 exactly as it did before this module existed, not start
// silently answering codes it never considered (an earlier version of
// this module had a global default table applied to every call
// regardless of `handlers` — /code-review on this branch caught that it
// was silently widening what several routes handled: e.g. P2002/P2003
// on a product write, previously an unhandled 500 visible to Sentry via
// instrumentation.ts's onRequestError, would have started returning a
// generic 409 with no server-side signal at all).
function commonResponseFor(code: KnownPrismaErrorCode): PrismaErrorResponse {
  switch (code) {
    case "P2002":
      return { status: 409, body: { error: "Already exists" } };
    case "P2025":
      return { status: 404, body: { error: "Not found" } };
    case "P2003":
      return { status: 409, body: { error: "Still referenced by other records" } };
    default: {
      // Exhaustive only over this module's own closed KnownPrismaErrorCode
      // union, not over Prisma's own type. Checked directly against the
      // installed @prisma/client types (6.19.3): assigning
      // PrismaClientKnownRequestError.code to a `"P2002"`-literal variable
      // fails with "Type 'string' is not assignable to type '\"P2002\"'" —
      // Prisma does not export a union/enum of known error codes, so a
      // `never` check can't be exhaustive over Prisma's own type. It CAN
      // still catch a KnownPrismaErrorCode added to the union above
      // without a matching case here — an undocumented code Prisma
      // returns simply isn't "known" and isKnownCode() returns false for
      // it, same as any other unmapped error.
      const exhaustive: never = code;
      throw new Error(`lib/prisma-error.ts: unhandled known code ${exhaustive as string}`);
    }
  }
}

export const NOT_FOUND: PrismaErrorResponse = commonResponseFor("P2025");
export const ALREADY_EXISTS: PrismaErrorResponse = commonResponseFor("P2002");
export const STILL_REFERENCED: PrismaErrorResponse = commonResponseFor("P2003");

// Maps a caught error to an HTTP response iff `handlers` explicitly names
// its code — undefined for anything else (an unlisted known code, a
// different Prisma code, a non-Prisma error, or a non-error value), so the
// caller's own `if (!response) throw error;` preserves exactly the set of
// codes that route handled before migration, and lets everything else
// propagate to Next.js's framework handling and Sentry's onRequestError
// auto-capture, exactly as an unmapped error already did.
//
//   mapPrismaError({code: "P2025"}, {P2025: NOT_FOUND})
//     → {status: 404, body: {error: "Not found"}}
//   mapPrismaError({code: "P2002"}, {P2002: {status: 201, body: {ok: true}}})
//     → {status: 201, body: {ok: true}}            (an override can mean "not an error at all" — see app/api/newsletter/route.ts)
//   mapPrismaError({code: "P2025"}, {P2002: ALREADY_EXISTS})
//     → undefined       (edge case: P2025 fired but only P2002 is handled here — stays unmapped, caller rethrows)
//   mapPrismaError(new Error("connection refused"), {P2025: NOT_FOUND})
//     → undefined       (failure case: not a Prisma error at all — caller rethrows, Sentry sees it)
// Asserted in lib/prisma-error.test.ts's "mapPrismaError" describe block.
export function mapPrismaError(
  error: unknown,
  handlers: Partial<Record<KnownPrismaErrorCode, PrismaErrorResponse>>,
): PrismaErrorResponse | undefined {
  const code = prismaErrorCode(error);
  if (!code || !isKnownCode(code)) return undefined;
  return handlers[code];
}

// Convenience used by most routes: builds the Response directly, or
// undefined when unmapped (so the caller's own `if (!response) throw
// error;` stays one line).
export function prismaErrorResponse(
  error: unknown,
  handlers: Partial<Record<KnownPrismaErrorCode, PrismaErrorResponse>>,
): Response | undefined {
  const mapped = mapPrismaError(error, handlers);
  return mapped ? NextResponse.json(mapped.body, { status: mapped.status }) : undefined;
}
