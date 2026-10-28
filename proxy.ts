import { NextResponse, type NextRequest } from "next/server";
import { getToken } from "next-auth/jwt";

import { isProtectedAdminPath } from "@/lib/auth.config";

// Next 16 middleware. Attaches a correlation id to every matched request
// (request + response headers), and redirects an unauthenticated request for
// an admin *page* to the login page — the same two responsibilities the
// previous version split across this file (`export default auth`) and the
// `authorized` callback in lib/auth.config.ts.
//
// Checks the session directly with next-auth/jwt's getToken (Edge-safe, JWT
// decode only, no DB) instead of wrapping `auth` with a custom function.
// That wrapped form was tried first and reverted: a live test showed it does
// NOT auto-apply the `authorized` callback's redirect — an unauthenticated
// request to /admin/catalog got a 200 instead of a redirect to /admin/login.
// Checking the token explicitly here removes that ambiguity.
export default async function proxy(request: NextRequest) {
  const requestId = request.headers.get("x-request-id") ?? crypto.randomUUID();

  if (isProtectedAdminPath(request.nextUrl.pathname)) {
    const token = await getToken({ req: request, secret: process.env.NEXTAUTH_SECRET });
    if (!token) {
      const loginUrl = new URL("/admin/login", request.url);
      loginUrl.searchParams.set("callbackUrl", request.url);
      const redirect = NextResponse.redirect(loginUrl);
      redirect.headers.set("x-request-id", requestId);
      return redirect;
    }
  }

  const forwardedHeaders = new Headers(request.headers);
  forwardedHeaders.set("x-request-id", requestId);
  const response = NextResponse.next({ request: { headers: forwardedHeaders } });
  response.headers.set("x-request-id", requestId);
  return response;
}

export const config = {
  // Admin pages (login excepted, same lookahead as before) get the redirect
  // check above. "/api/:path*" is new: it carries no auth requirement (see
  // isProtectedAdminPath — it only ever matches "/admin"-prefixed paths) and
  // exists only so every API route also gets a request id. Static assets
  // (_next/*, favicon, etc.) are skipped — there's nothing to correlate there.
  matcher: [
    "/admin",
    "/admin/((?!login(?:/|$)).*)",
    "/api/:path*",
  ],
};
