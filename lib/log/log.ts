import type { LogEvent } from "@/lib/log/events";

// Pure, synchronous, console-only — no file I/O, no new dependency. On a
// self-hosted deploy, stdout is captured and rotated by the platform
// (Docker's json-file driver, journald); this function has no business
// owning persistence or retention.
export function logEvent(e: LogEvent): void {
  const line = JSON.stringify(e);
  const isFailure = e.event === "error" || ("outcome" in e && e.outcome === "failed");
  if (isFailure) {
    console.error(line);
  } else {
    console.log(line);
  }
}
