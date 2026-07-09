import NextAuth from "next-auth";
import Credentials from "next-auth/providers/credentials";

import { authConfig } from "@/lib/auth.config";
import { authorizeCredentials } from "@/lib/authorize";
import { clientIp } from "@/lib/client-ip";

// Full auth config (Node runtime): the Edge-safe base plus the Credentials provider,
// which verifies email + bcrypt password against the User table via
// authorizeCredentials. JWT session strategy keeps the setup adapter-free.
export const { handlers, auth, signIn, signOut } = NextAuth({
  ...authConfig,
  providers: [
    Credentials({
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Password", type: "password" },
      },
      // The request's client IP feeds the login rate limiter (see authorize.ts).
      authorize: (credentials, request) =>
        authorizeCredentials(
          credentials as { email?: string; password?: string },
          clientIp(request.headers),
        ),
    }),
  ],
});
