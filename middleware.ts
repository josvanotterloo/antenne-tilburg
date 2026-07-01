export { default } from "next-auth/middleware";

// Protect every /admin route except the login page itself. next-auth redirects
// unauthenticated requests to the `signIn` page configured in lib/auth.ts.
export const config = {
  matcher: ["/admin", "/admin/((?!login).*)"],
};
