"use client";

import { useEffect } from "react";
import * as Sentry from "@sentry/nextjs";

import "./globals.css";

// Replaces the root layout entirely when a render error escapes it, so it
// must own its own <html>/<body> — the normal app/layout.tsx isn't rendered.
// Deliberately skips the next/font loaders app/layout.tsx uses: this page
// exists to render when something else has already gone wrong, so it stays
// on system fonts rather than pulling in another thing that could fail.
export default function GlobalError({
  error,
}: {
  error: Error & { digest?: string };
}) {
  useEffect(() => {
    Sentry.captureException(error);
  }, [error]);

  return (
    <html lang="nl">
      <body className="min-h-screen bg-canvas font-sans text-ink antialiased">
        <p>Something went wrong. Please refresh the page.</p>
      </body>
    </html>
  );
}
