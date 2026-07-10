import NextAuth from "next-auth";

import { authConfig } from "@/lib/auth.config";

// Next 16 middleware. Uses the Edge-safe auth config (no DB) so Prisma isn't pulled
// into the Edge runtime; the `authorized` callback redirects unauthenticated users
// to the login page (pages.signIn). The matcher protects every /admin route except
// the login page itself.
const { auth } = NextAuth(authConfig);

export default auth;

export const config = {
  // Protect every /admin route except the login page itself. The lookahead
  // excludes only exactly "/admin/login" (and its subpaths), not any route that
  // merely starts with "login" — e.g. a future /admin/login-audit stays gated.
  matcher: ["/admin", "/admin/((?!login(?:/|$)).*)"],
};
