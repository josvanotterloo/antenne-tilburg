# External-call timeouts

Two external calls could hang indefinitely: the Resend API (email send) and
the local DYMO Connect print service. Both now time out via a shared
`withTimeout` helper (`lib/with-timeout.ts`).

## `lib/with-timeout.ts`

```ts
withTimeout(run: (signal: AbortSignal) => Promise<T>, ms: number, message: string): Promise<T>
```

Races `run` against a timer; rejects with `TimeoutError(message)` if the timer
fires first. `run` receives an `AbortSignal` it may use to cancel its own
work, but isn't required to — some SDKs (Resend) don't accept one, in which
case this only stops the *caller* from hanging, not the underlying operation.

If `run` itself rejects in response to the same abort event (e.g. `fetch`
does), that rejection can otherwise race the helper's own `TimeoutError` with
no guaranteed winner — the helper normalizes on `controller.signal.aborted`
after any rejection rather than trusting which promise settled first. See
`lib/with-timeout.test.ts`'s "still throws TimeoutError when `run` also
rejects on the same abort signal" test.

## Call sites

- `lib/email/send.ts` — 10s timeout, throws `TimeoutError("Resend API timeout
  after 10s")`.
- `app/api/admin/label/[productId]/route.ts` (DYMO print, `DYMO_MODE=print`)
  — 5s timeout, returns `504` with `"DYMO Connect did not respond within 5s —
  is DYMO Connect Desktop running?"`. The existing `502` "Could not reach
  Dymo Connect" response is unchanged for non-timeout failures.

## Known limitation: neither external operation can actually be cancelled

Resend's SDK doesn't accept an `AbortSignal` (checked
`node_modules/resend/dist/index.d.mts` — `PostOptions` only has
`query`/`headers`), and DYMO Connect Desktop may have already started
processing a print job before our `fetch` gives up. A "timeout" here means
"this caller stopped waiting," not "the operation was cancelled" — it may
still complete afterward.

- **`app/api/newsletter/route.ts`** — on a `TimeoutError` specifically, the
  subscriber row is **kept** (not deleted) and the route reports success,
  because deleting it and asking the user to retry could orphan a
  confirmation link if the original send lands late. Real send failures
  (non-timeout) still delete the row and 500, unchanged.
- **`app/api/admin/newsletter/send/route.ts`** (bulk send) — a timed-out send
  is counted in the `failed` total even if it lands later. This is a
  reporting inaccuracy only (no data is deleted), left as-is: not worth the
  added complexity for a number an admin sees once per send.
- **DYMO print** — a timeout may still result in a physical label printing;
  the admin sees a `504` and decides whether to retry. No automatic
  destructive action is taken, so this is left as a manual judgment call for
  whoever's at the printer.
