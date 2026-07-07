import type { NextAuthConfig } from "next-auth";

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
    // Gate matched routes from the middleware. The matcher already limits this to
    // protected /admin routes, so any match requires a signed-in user.
    authorized({ auth }) {
      return !!auth?.user;
    },
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
