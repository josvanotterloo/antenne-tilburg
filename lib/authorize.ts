import { compare } from "bcrypt";

import { db } from "@/lib/db";

// A valid cost-12 bcrypt hash (of a random string). Used only to spend the same
// hashing time when the email is unknown, so login response timing can't be used
// to enumerate which addresses are registered.
const DUMMY_HASH = "$2b$12$2tdb.7SDiFZxXixeXumaC.NVOIwP3ImuRDbO4xaZn8o7zvy1HuCI6";

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

    // Always run the bcrypt compare — against the real hash if the user exists,
    // otherwise against a dummy hash — so both paths take the same time.
    const valid = await compare(
      credentials.password,
      user?.passwordHash ?? DUMMY_HASH,
    );
    if (!user || !valid) {
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
