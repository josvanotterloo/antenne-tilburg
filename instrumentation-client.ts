import * as Sentry from "@sentry/nextjs";

import { sentryInitOptions } from "@/lib/sentry-init-options";

// Client bundles can only read NEXT_PUBLIC_* env vars. next.config.mjs forwards
// SENTRY_DSN to NEXT_PUBLIC_SENTRY_DSN at build time so .env only needs one var
// — but see the comment there: this only works for build-once/deploy-once,
// not build-once/deploy-many with the DSN injected at container start.
const options = sentryInitOptions(process.env.NEXT_PUBLIC_SENTRY_DSN);
if (options) Sentry.init(options);
export const onRouterTransitionStart = Sentry.captureRouterTransitionStart;
