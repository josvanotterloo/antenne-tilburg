import type { NextAuthConfig } from "next-auth";
import type { AdminLocale } from "@prisma/client";

import { ADMIN_LOCALES } from "@/lib/user-input";

// Same admin-page pattern proxy.ts checks explicitly before redirecting
// (see proxy.ts — it calls next-auth/jwt's getToken() directly rather than
// relying on an `authorized` callback; empirically, wrapping `auth` with a
// custom middleware function does NOT auto-apply `authorized`'s redirect,
// confirmed by a live test that let an unauthenticated request straight
// through to /admin/catalog, so that mechanism isn't used here).
//   isProtectedAdminPath("/admin/catalog") → true
//   isProtectedAdminPath("/admin/login") → false
//   isProtectedAdminPath("/admin/login-audit") → true
//     (edge case: starts with "login" but isn't the login page — the exact
//     bug ec64f81 fixed; see lib/auth.config.test.ts's property tests)
//   isProtectedAdminPath("/api/catalog") → false
//     (no failure case exists — a plain string check, never throws; this
//     is simply "not under /admin at all")
// Asserted in lib/auth.config.test.ts's "isProtectedAdminPath" describe block.
export function isProtectedAdminPath(pathname: string): boolean {
  if (pathname === "/admin") return true;
  if (!pathname.startsWith("/admin/")) return false;
  const rest = pathname.slice("/admin/".length);
  return rest !== "login" && !rest.startsWith("login/");
}

// Edge-safe base config: no database and no db-backed providers, so the middleware
// can validate the JWT session without pulling Prisma into the Edge runtime. The
// Credentials provider (which hits the DB) is added in lib/auth.ts (Node runtime).
export const authConfig = {
  pages: { signIn: "/admin/login" },
  session: { strategy: "jwt" },
  secret: process.env.NEXTAUTH_SECRET,
  trustHost: true,
  providers: [],
  callbacks: {
    jwt({ token, user, trigger, session }) {
      if (user) {
        token.id = user.id;
        token.locale = user.locale;
      }
      if (
        trigger === "update" &&
        ADMIN_LOCALES.includes(session?.user?.locale as AdminLocale)
      ) {
        token.locale = session!.user!.locale as AdminLocale;
      }
      return token;
    },
    session({ session, token }) {
      if (session.user && token.id) {
        session.user.id = token.id as string;
        session.user.locale = token.locale as AdminLocale;
      }
      return session;
    },
  },
} satisfies NextAuthConfig;
