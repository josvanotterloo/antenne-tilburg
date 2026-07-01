import { withAuth } from "next-auth/middleware";

// Protect every /admin route except the login page itself. `withAuth` does not
// read authOptions, so the sign-in page must be set here too — otherwise it
// falls back to the default /api/auth/signin page.
export default withAuth({
  pages: { signIn: "/admin/login" },
});

export const config = {
  matcher: ["/admin", "/admin/((?!login).*)"],
};
