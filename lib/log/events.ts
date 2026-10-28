// Closed event taxonomy: a call site can't invent an ad hoc event name, and
// a variant's field list is the enforcement mechanism for PII-safety — none
// of these carry a raw search term, email, name, address, or request body.
// tsc --noEmit (run in CI) is the guardrail: a new field needs a type change
// here first, which is the point where it should get a second look.
export type LogEvent =
  | {
      event: "request.served";
      requestId: string;
      method: string;
      route: string;
      status: number;
      durationMs: number;
    }
  | {
      event: "catalog.search";
      requestId: string;
      outcome: "ok" | "failed";
      resultCount?: number;
      durationMs: number;
    }
  | {
      event: "auth.login";
      requestId: string;
      outcome: "ok" | "failed";
      reason?: "bad_credentials" | "rate_limited";
      userId?: string;
    }
  | {
      event: "admin.mutation";
      requestId: string;
      outcome: "ok" | "failed";
      entity: "stock" | "customer_order" | "reference_entity";
      action: string;
      entityId?: string;
      actorUserId: string;
    }
  | {
      event: "email.send";
      requestId: string;
      outcome: "ok" | "failed";
      kind: string;
      durationMs?: number;
    }
  | {
      event: "error";
      requestId: string;
      where: string;
      errorKind: string;
    };

// Sentinel for a mutation with no human actor (seeds, migrations, system
// scripts). actorUserId stays a required string everywhere it appears so
// "who did this" can never be silently absent — callers with no session
// user must pass this explicitly instead of undefined/null.
export const SYSTEM_ACTOR_ID = "system" as const;
