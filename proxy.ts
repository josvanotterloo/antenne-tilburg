import NextAuth from "next-auth";

import { authConfig } from "@/lib/auth.config";

// Next 16 middleware. Uses the Edge-safe auth config (no DB) so Prisma isn't pulled
// into the Edge runtime; the `authorized` callback redirects unauthenticated users
// to the login page (pages.signIn). The matcher protects every /admin route except
// the login page itself.
const { auth } = NextAuth(authConfig);

export default auth;

export const config = {
  matcher: ["/admin", "/admin/((?!login).*)"],
};
