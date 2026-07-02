import { compare } from "bcrypt";

import { db } from "@/lib/db";

// Verifies email + bcrypt password against the User table. Returns the user's
// id/email on success, or null on missing input, unknown user, wrong password,
// or a DB error (logged). Extracted from lib/auth.ts so it can be unit-tested
// without pulling in next-auth.
export async function authorizeCredentials(
  credentials: { email?: string; password?: string } | undefined,
) {
  if (!credentials?.email || !credentials.password) {
    return null;
  }

  try {
    const user = await db.user.findUnique({
      where: { email: credentials.email },
    });
    if (!user) {
      return null;
    }

    const valid = await compare(credentials.password, user.passwordHash);
    if (!valid) {
      return null;
    }

    return { id: user.id, email: user.email };
  } catch (error) {
    // DB unreachable / query failure: log for operators and fail closed as
    // invalid credentials instead of surfacing a 500.
    console.error("authorize: login check failed", error);
    return null;
  }
}
