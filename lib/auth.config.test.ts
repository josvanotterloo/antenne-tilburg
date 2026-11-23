import { describe, it, expect } from "vitest";
import fc from "fast-check";
import { authConfig, isProtectedAdminPath } from "@/lib/auth.config";
import type { JWT } from "next-auth/jwt";
import type { Session } from "next-auth";

describe("authConfig callbacks", () => {
  it("jwt copies the user's locale onto the token", () => {
    const token = {} as JWT;
    const result = authConfig.callbacks.jwt({
      token,
      user: { id: "u1", locale: "EN" },
    } as Parameters<typeof authConfig.callbacks.jwt>[0]);

    expect(result.locale).toBe("EN");
  });

  it("jwt copies the locale from a client update() call onto the token", () => {
    const token = { id: "u1", locale: "NL" } as JWT;
    const result = authConfig.callbacks.jwt({
      token,
      trigger: "update",
      session: { user: { locale: "EN" } },
    } as Parameters<typeof authConfig.callbacks.jwt>[0]);

    expect(result.locale).toBe("EN");
  });

  it("ignores an invalid locale and any other field sent via update()", () => {
    const token = { id: "u1", locale: "NL" } as JWT;
    const result = authConfig.callbacks.jwt({
      token,
      trigger: "update",
      session: { user: { locale: "XX", id: "other" } },
    } as Parameters<typeof authConfig.callbacks.jwt>[0]);

    expect(result.locale).toBe("NL");
    expect(result.id).toBe("u1");
  });

  it("session copies the token's locale onto session.user.locale", () => {
    const session = { user: {} } as Session;
    const token = { id: "u1", locale: "EN" } as JWT;
    const result = authConfig.callbacks.session({
      session,
      token,
    } as Parameters<typeof authConfig.callbacks.session>[0]);

    expect(result.user.locale).toBe("EN");
  });
});

describe("isProtectedAdminPath", () => {
  it.each([
    ["/admin", true],
    ["/admin/catalog", true],
    ["/admin/catalog/123", true],
    ["/admin/login", false],
    ["/admin/login/", false],
    ["/admin/login/forgot-password", false],
    // The ec64f81 bug: a path that merely starts with the substring "login"
    // but isn't the login page itself must stay protected.
    ["/admin/login-audit", true],
    ["/admin/loginx", true],
    // Case matters — "login" is matched literally, not case-insensitively.
    ["/admin/LOGIN", true],
    ["/admin/Login", true],
    // Not under /admin at all.
    ["/api/catalog", false],
    ["/api/admin/products", false],
    ["/", false],
    ["/adminx", false],
    ["/Admin", false],
  ])("isProtectedAdminPath(%j) === %j", (pathname, expected) => {
    expect(isProtectedAdminPath(pathname)).toBe(expected);
  });
});

describe("property", () => {
  // These three arbitraries encode the function's documented contract
  // directly (not a reimplementation of its logic) — see the two
  // invariants below. "Odd shapes" (trailing/double slashes, percent-
  // encoding, case variants, query strings, dot segments) are mixed in
  // deliberately: isProtectedAdminPath does no URL decoding or
  // normalization itself (that already happened upstream, in
  // NextURL.pathname, before proxy.ts ever sees the string), so every one
  // of these must still resolve exactly the way a plain, uninterpreted
  // string comparison would.

  // Anything that is NOT the exact login page or a login subpath — the
  // whole "/admin/*" surface this function must protect.
  const oddAdminRestNotLogin = fc
    .oneof(
      fc.constantFrom(
        "login-audit",
        "loginx",
        "LOGIN",
        "Login",
        "login ",
        " login",
        "login//",
        "login/../catalog",
        "catalog/",
        "catalog//",
        "catalog/123/",
        "%6Cogin",
        "login%2F..%2Fcatalog",
        "catalog?x=1",
        "catalog#frag",
        "./catalog",
        "../catalog",
        "..",
        ".",
        "",
      ),
      fc.string(),
    )
    .filter((rest) => rest !== "login" && !rest.startsWith("login/"));

  // The exact login page and every login subpath, with the same odd shapes.
  const loginRest = fc.oneof(
    fc.constant("login"),
    fc.string().map((suffix) => `login/${suffix}`),
  );

  // Paths that aren't under /admin at all — /api/* in particular, since a
  // prior proxy.ts revision gated it accidentally (2205509's commit
  // message: extending the matcher to /api/:path* while still using the
  // NextAuth `authorized` callback's blanket check "would have made ...
  // every API route" require login).
  const nonAdminPath = fc
    .oneof(
      fc.constantFrom(
        "/api/catalog",
        "/api/admin/products",
        "/",
        "/login",
        "/Admin",
        "/admin2",
        "/adminx",
        "/ADMIN",
        "/api/admin/../admin/catalog",
      ),
      fc.string(),
    )
    .filter((path) => path !== "/admin" && !path.startsWith("/admin/"));

  it("every /admin/* path except /admin/login and /admin/login/* is protected", () => {
    fc.assert(
      fc.property(oddAdminRestNotLogin, (rest) => {
        expect(isProtectedAdminPath(`/admin/${rest}`)).toBe(true);
      }),
    );
  });

  it("/admin/login and every /admin/login/* subpath is never protected", () => {
    fc.assert(
      fc.property(loginRest, (rest) => {
        expect(isProtectedAdminPath(`/admin/${rest}`)).toBe(false);
      }),
    );
  });

  it("no path outside /admin is ever swept in as protected (/api/* included)", () => {
    fc.assert(
      fc.property(nonAdminPath, (path) => {
        expect(isProtectedAdminPath(path)).toBe(false);
      }),
    );
  });

  describe("regression: these invariants catch the historical bug they were written for", () => {
    // Reconstructed from proxy.ts as it stood at ec64f81's parent commit
    // (`git show ec64f81^:proxy.ts`): matcher
    // `["/admin", "/admin/((?!login).*)"]`, gating every matched path via
    // NextAuth's bare `authorized` callback — isProtectedAdminPath didn't
    // exist yet, so this inlines the equivalent predicate the matcher
    // itself implemented. Bug (fixed by ec64f81): the lookahead excluded
    // ANY rest starting with the substring "login", not just the exact
    // login page, so e.g. "/admin/login-audit" was wrongly left
    // unprotected.
    function isProtectedAdminPathAtEc64f81Parent(pathname: string): boolean {
      if (pathname === "/admin") return true;
      if (!pathname.startsWith("/admin/")) return false;
      const rest = pathname.slice("/admin/".length);
      return !rest.startsWith("login");
    }

    it("the first invariant fails against the pre-ec64f81 login-prefix bug", () => {
      expect(() => {
        fc.assert(
          fc.property(oddAdminRestNotLogin, (rest) => {
            expect(isProtectedAdminPathAtEc64f81Parent(`/admin/${rest}`)).toBe(true);
          }),
        );
      }).toThrow();
    });

    // isProtectedAdminPath itself didn't exist before 2205509 — that commit
    // introduces it for the first time, already byte-identical to today's
    // version (confirmed via `git show 2205509:lib/auth.config.ts`; no
    // commit since has changed it). There is no separate historical
    // buggy *path-matching* state at 2205509 for this test to catch. The
    // real bug that session surfaced (documented in tasks/lessons.md
    // 2026-10-28b: wrapping `auth()` in a custom middleware function
    // silently skipped the `authorized` callback's redirect, returning
    // 200 instead of redirecting an unauthenticated request) is a
    // NextAuth/Next.js framework-wiring bug, not a pathname-matching one
    // — it was never committed in that broken form, and no string-only
    // property test over isProtectedAdminPath's input space could detect
    // it either way, since the bug was in whether the framework *calls*
    // the right check at all, not in the check's own logic. proxy.test.ts
    // covers that class of bug with a mocked-getToken integration test
    // instead.
    it("isProtectedAdminPath at 2205509 already satisfies both invariants (sanity check)", () => {
      function isProtectedAdminPathAt2205509(pathname: string): boolean {
        if (pathname === "/admin") return true;
        if (!pathname.startsWith("/admin/")) return false;
        const rest = pathname.slice("/admin/".length);
        return rest !== "login" && !rest.startsWith("login/");
      }

      fc.assert(
        fc.property(oddAdminRestNotLogin, (rest) => {
          expect(isProtectedAdminPathAt2205509(`/admin/${rest}`)).toBe(true);
        }),
      );
      fc.assert(
        fc.property(loginRest, (rest) => {
          expect(isProtectedAdminPathAt2205509(`/admin/${rest}`)).toBe(false);
        }),
      );
    });
  });
});
