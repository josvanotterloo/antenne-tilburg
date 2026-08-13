// How long a signup confirmation link (and the retry queue's eligibility
// window) stays valid. Shared by three call sites that must all agree on
// the same number: app/api/newsletter/confirm/route.ts (rejects an expired
// token), app/api/admin/newsletter/retry-pending/route.ts (no point
// retrying a send whose link would already be expired on arrival), and
// app/admin/settings/subscribers/page.tsx (don't offer to retry a row the
// retry endpoint would just skip).
export const CONFIRM_WINDOW_MS = 48 * 60 * 60 * 1000;

// Would the retry endpoint actually attempt this subscriber? Kept as a plain
// function (not inlined in the page component) so the impure Date.now() call
// isn't inside a component body — React's purity lint flags that.
export function isRetryEligible(subscriber: {
  status: string;
  confirmEmailSentAt: Date | null;
  createdAt: Date;
}): boolean {
  return (
    subscriber.status === "PENDING" &&
    subscriber.confirmEmailSentAt === null &&
    new Date(subscriber.createdAt).getTime() > Date.now() - CONFIRM_WINDOW_MS
  );
}
