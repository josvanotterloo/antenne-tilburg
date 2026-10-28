// @vitest-environment node
import { describe, it, expect } from "vitest";

import { getRequestId, withRequestContext } from "@/lib/log/context";

function request(headers: Record<string, string> = {}) {
  return new Request("http://localhost:3000/api/catalog", { headers });
}

describe("withRequestContext / getRequestId", () => {
  it("returns 'unknown' when called outside any request context", () => {
    expect(getRequestId()).toBe("unknown");
  });

  it("uses the caller-supplied x-request-id header when present", async () => {
    const id = await withRequestContext(request({ "x-request-id": "caller-id" }), async () =>
      getRequestId(),
    );

    expect(id).toBe("caller-id");
  });

  it("generates a request id when no header is present", async () => {
    const id = await withRequestContext(request(), async () => getRequestId());

    expect(id).toMatch(/^[0-9a-f-]{36}$/);
  });

  it("lets nested async calls inside the same scope see the same id", async () => {
    async function inner() {
      return getRequestId();
    }

    const outerId = await withRequestContext(request({ "x-request-id": "shared-id" }), async () => {
      const innerId = await inner();
      expect(innerId).toBe(getRequestId());
      return innerId;
    });

    expect(outerId).toBe("shared-id");
  });

  it("isolates concurrent request contexts from each other", async () => {
    const [a, b] = await Promise.all([
      withRequestContext(request({ "x-request-id": "id-a" }), async () => getRequestId()),
      withRequestContext(request({ "x-request-id": "id-b" }), async () => getRequestId()),
    ]);

    expect(a).toBe("id-a");
    expect(b).toBe("id-b");
  });
});
