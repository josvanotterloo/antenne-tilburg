"use client";

import { useCallback, useState } from "react";

// Shared state wrapper for an admin mutation. Guarantees the two things every
// hand-rolled handler kept getting wrong:
//   - `pending` is ALWAYS reset (the missing `finally`), so a thrown/rejected
//     action can't leave a button stuck disabled;
//   - a thrown error is captured into `error` for display, so a failure is
//     never a silent no-op.
// Pair with apiSend (which throws friendly messages): run(() => apiSend(...)).

const GENERIC_ERROR = "Something went wrong. Please try again.";

export interface AsyncAction {
  pending: boolean;
  error: string | null;
  setError: (message: string | null) => void;
  run: (action: () => Promise<void>) => Promise<void>;
}

export function useAsyncAction(): AsyncAction {
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const run = useCallback(async (action: () => Promise<void>) => {
    setPending(true);
    setError(null);
    try {
      await action();
    } catch (err) {
      setError(err instanceof Error && err.message ? err.message : GENERIC_ERROR);
    } finally {
      setPending(false);
    }
  }, []);

  return { pending, error, setError, run };
}
