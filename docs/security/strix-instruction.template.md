# Strix engagement instruction — antenne-tilburg.nl (pre-launch)

## Authorization

This is an authorized test. The application, source code and database are owned by
the person running this scan. Testing is limited strictly to the targets listed
below. Do not test, enumerate or touch any other host, domain or third-party
service.

## Target

- Source: the repository checked out at the working directory (Next.js 16,
  TypeScript, Prisma 6.19, PostgreSQL, NextAuth v5).
- Running app: `http://<HOST>:3000` — a local development instance.

This is a record shop site for vinyl and tape. Public visitors browse a New
Arrivals table, read blog posts, view opening hours and notices, and subscribe to
a newsletter. Staff sign in to an admin area to manage products, labels, artists,
genres, product types, suppliers, orders, blog posts, notices, opening hours,
newsletter and users. Staff also manage customer orders. Online purchasing is not
built; whether any public path exposes order data is for you to establish.

## Environment

The database is a disposable seeded instance. Destructive writes are acceptable.
Prefer creating your own records over destroying seed data, so that findings stay
reproducible for a second run, but do not avoid a test purely because it mutates
state.

## Rules of engagement

- **Do not trigger outbound email.** The app sends transactional and newsletter
  mail through Resend. Do not send a newsletter campaign, do not trigger bulk
  sends, and do not use real email addresses. Use `@example.com` addresses only.
  If you find a way to trigger an unauthenticated or unauthorized send, report it
  as a finding and stop — do not execute it at volume.
- **Do not attack third-party services.** Sentry, Resend, GitHub, Cloudflare and
  any CDN or package registry are out of scope even where the app talks to them.
- No denial of service, no volumetric or stress testing, no resource exhaustion.
- Do not exfiltrate data outside the sandbox.
- Do not modify files in the repository. Report fixes as recommendations; the
  human will implement them.

## Credentials

There is no role tiering: all accounts are equal-privilege admins, and there are no
customer accounts.

- Admin: `<ADMIN_EMAIL>` / `<ADMIN_PASSWORD>`

The primary comparison is therefore **authenticated admin vs. anonymous**. Test
every surface unauthenticated. A large part of the risk here is a route that is
assumed to be protected but is not.

## Priority areas

Ordered by expected risk. Spend effort in this order.

### 1. Authorization on admin route handlers

Highest priority. A static source audit found that admin mutations live in
`app/api/admin/**/route.ts` (33 files), each calling `requireAdmin()` inside the
handler directly or via the shared factories in `lib/reference-crud.ts`, and that
the repository contains no `"use server"` actions. That audit read source and
mocked tests only; it has never been confirmed against a running server. Your job
here is live confirmation: send real unauthenticated requests, with every HTTP
method each handler exports, and record the actual status code and body.

Also check for any `"use server"` function the audit may have missed, and any
route handler outside `app/api/admin/` that mutates admin-owned data.

Cover every admin resource: products, labels, artists, genres, product types,
suppliers, orders, blog posts, notices, opening hours, newsletter and users.
Enumerate endpoints from the source rather than by crawling; an anonymous crawl
will never see them in rendered HTML.

### 2. Unauthenticated access to order data

There are no customer accounts, so there is no session-based privilege escalation
to test. The risk moves instead to any path that exposes order data by *knowing a
value* rather than by holding a session: an order confirmation page, a lookup by
reference or id, a token in an email link, an API route returning order details.

First establish from the source whether any such path exists. If one does, attempt
to reach other orders by enumerating or manipulating the identifier, and report
whether identifiers are sequential or guessable. If none exists, say so
explicitly, and state what you checked.

### 3. Mass assignment

Look for Prisma `create` and `update` calls that spread request or form data into
the query. Attempt to set fields the form does not expose — role or admin flags on
user records, price or stock on products, published state or author on blog posts,
status on orders.

### 4. Stored XSS in content

Blog posts, notices, product descriptions and any field rendered with
`dangerouslySetInnerHTML` or a markdown renderer. Note that a large volume of
content was migrated from a legacy MySQL database; that content never passed
through the current input path, so test rendering of stored values as well as
newly submitted ones.

### 5. Newsletter subscribe and unsubscribe

- Subscriber email addresses are stored encrypted. Check whether any endpoint,
  error message or admin export leaks plaintext.
- Unsubscribe token handling: are tokens guessable, reusable across subscribers,
  or missing a binding to the subscriber they belong to?
- Email enumeration: does the subscribe endpoint respond differently for an
  address that is already subscribed?

### 6. File upload

Uploaded images are written to `public/uploads/`. Test path traversal in the
filename, content-type confusion, upload of non-image content, and whether an
uploaded file can be served in a way that executes.

### 7. Authentication and session

NextAuth v5 configuration: session cookie flags, CSRF protection on credential
submission, session fixation, whether sessions are invalidated on password change
or role change, and password reset flow if present.

### 8. Rate limiting

Login, newsletter subscribe, order placement, and any endpoint that sends mail or
writes to the database unauthenticated.

### 9. Information disclosure

Stack traces and Prisma error text reaching the client, source maps in production
builds, secrets in client bundles (anything that should not be `NEXT_PUBLIC_`),
verbose 500 responses, and admin-only data present in a page payload but merely
hidden in the UI.

## Reporting

For each finding, give:

- The exact HTTP request or action invocation that reproduces it, as a copyable
  PoC.
- The file and function in the source where the missing or incorrect check lives.
- Severity with reasoning specific to this application. A missing role check on
  product editing is not the same as one on user management.
- A remediation recommendation, but do not apply it.

Explicitly state which of the nine areas above you tested and which you could not
reach, and why. A short honest list of untested surface is more useful than
implied coverage.
