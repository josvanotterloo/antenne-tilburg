import * as Sentry from "@sentry/nextjs";

import { sentryInitOptions } from "@/lib/sentry-init-options";

const options = sentryInitOptions(process.env.SENTRY_DSN);
if (options) Sentry.init(options);
