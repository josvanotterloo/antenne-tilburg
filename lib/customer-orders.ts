import { randomUUID } from "crypto";
import { mkdir, readFile, rename, writeFile } from "fs/promises";
import { dirname, join } from "path";

import { getRequestId } from "@/lib/log/context";
import { logEvent } from "@/lib/log/log";

// Operational data, not source code — gitignored (see .gitignore), created on
// first read/write. No DB model for this: it's free-form staff notes, not a
// managed entity.
export const CUSTOMER_ORDERS_PATH = join(
  process.cwd(),
  "data",
  "customer-orders.md",
);

// Generous headroom over any realistic want-list of notes, matching the
// size-cap convention every other admin write route in this codebase
// follows (lib/upload-input.ts's MAX_UPLOAD_BYTES, lib/newsletter-input.ts's
// MAX_NAME/MAX_EMAIL) — an admin session posting an unbounded string
// shouldn't be able to fill disk or degrade the box.
export const MAX_CUSTOMER_ORDERS_BYTES = 500 * 1024; // 500 KB

export const DEFAULT_CUSTOMER_ORDERS_CONTENT = `## Customer Orders
<!-- Add customer orders below. Format:
## Customer Name — contact
- [ ] Artist - Title (Label) — IN STOCK / BACKORDER — notes
- [x] Artist - Title (Label) — fulfilled note
-->
`;

export async function readCustomerOrders(): Promise<string> {
  try {
    return await readFile(CUSTOMER_ORDERS_PATH, "utf-8");
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code === "ENOENT") {
      return DEFAULT_CUSTOMER_ORDERS_CONTENT;
    }
    throw err;
  }
}

// actorUserId is required, never optional — see SYSTEM_ACTOR_ID in
// lib/log/events.ts for a caller with no session user.
export async function writeCustomerOrders(
  content: string,
  actorUserId: string,
): Promise<void> {
  const dir = dirname(CUSTOMER_ORDERS_PATH);
  try {
    await mkdir(dir, { recursive: true });
    // Write to a sibling temp file then rename over the target — rename is
    // atomic on the same filesystem, so a crash mid-write can never leave
    // data/customer-orders.md truncated/corrupted. This file is the sole copy
    // of the data (gitignored, no DB row), so that guarantee matters here.
    const tmpPath = join(dir, `.customer-orders.${randomUUID()}.tmp`);
    await writeFile(tmpPath, content, "utf-8");
    await rename(tmpPath, CUSTOMER_ORDERS_PATH);
  } catch (error) {
    logEvent({
      event: "admin.mutation",
      requestId: getRequestId(),
      outcome: "failed",
      entity: "customer_order",
      action: "update",
      actorUserId,
    });
    throw error;
  }
  logEvent({
    event: "admin.mutation",
    requestId: getRequestId(),
    outcome: "ok",
    entity: "customer_order",
    action: "update",
    actorUserId,
  });
}
