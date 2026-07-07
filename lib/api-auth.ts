import { NextResponse } from "next/server";

import { auth } from "@/lib/auth";

// Guard for /api/admin/* handlers. `proxy.ts` protects admin *pages*, but
// not API routes, so every admin API handler must call this first. Returns a
// 401 JSON response to short-circuit with, or null when the caller may proceed.
export async function requireAdmin(): Promise<NextResponse | null> {
  const session = await auth();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  return null;
}
