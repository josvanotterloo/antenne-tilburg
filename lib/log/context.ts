import { AsyncLocalStorage } from "node:async_hooks";

const als = new AsyncLocalStorage<{ requestId: string }>();

// Lets any lib/ function reach the current request's correlation id without
// threading it through every call signature in between. Only safe because
// this module is Node-side (route handlers), never imported by proxy.ts
// (Edge runtime, no node:async_hooks).
export function getRequestId(): string {
  return als.getStore()?.requestId ?? "unknown";
}

export async function withRequestContext<T>(
  request: Request,
  handler: () => Promise<T>,
): Promise<T> {
  const requestId = request.headers.get("x-request-id") ?? crypto.randomUUID();
  return als.run({ requestId }, handler);
}
