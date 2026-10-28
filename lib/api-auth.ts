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

// Same guard, for the handful of admin routes that also need the session
// user's id to pass as actorUserId into an admin.mutation log event. A
// separate function rather than changing requireAdmin()'s signature — that
// would ripple through all 30+ call sites that don't need the id.
export async function requireAdminUserId(): Promise<
  { denied: NextResponse } | { denied?: undefined; userId: string }
> {
  const session = await auth();
  if (!session?.user?.id) {
    return { denied: NextResponse.json({ error: "Unauthorized" }, { status: 401 }) };
  }
  return { userId: session.user.id };
}
