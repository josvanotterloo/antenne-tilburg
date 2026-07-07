import { randomBytes } from "crypto";

// Opaque token for newsletter confirm / unsubscribe links. 32 random bytes as
// hex (64 chars) — unguessable and safe to put in a URL.
export function newToken(): string {
  return randomBytes(32).toString("hex");
}
