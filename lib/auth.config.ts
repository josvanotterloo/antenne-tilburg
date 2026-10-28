import type { NextAuthConfig } from "next-auth";

// Same admin-page pattern proxy.ts checks explicitly before redirecting
// (see proxy.ts — it calls next-auth/jwt's getToken() directly rather than
// relying on an `authorized` callback; empirically, wrapping `auth` with a
// custom middleware function does NOT auto-apply `authorized`'s redirect,
// confirmed by a live test that let an unauthenticated request straight
// through to /admin/catalog, so that mechanism isn't used here).
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
    jwt({ token, user }) {
      if (user) token.id = user.id;
      return token;
    },
    session({ session, token }) {
      if (session.user && token.id) {
        session.user.id = token.id as string;
      }
      return session;
    },
  },
} satisfies NextAuthConfig;
