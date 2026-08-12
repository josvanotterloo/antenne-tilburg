export class TimeoutError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "TimeoutError";
  }
}

// Races `run` against a timer, rejecting with a TimeoutError if the timer fires
// first. `run` receives an AbortSignal it may use to cancel its own work — but
// isn't required to (some SDKs, e.g. Resend's, don't accept one), in which case
// this only stops the *caller* from hanging, not the underlying operation.
export async function withTimeout<T>(
  run: (signal: AbortSignal) => Promise<T>,
  ms: number,
  message: string,
): Promise<T> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), ms);
  try {
    return await Promise.race([
      run(controller.signal),
      new Promise<never>((_, reject) => {
        controller.signal.addEventListener("abort", () =>
          reject(new TimeoutError(message)),
        );
      }),
    ]);
  } catch (err) {
    // `run` may reject on its own in response to the same abort signal (e.g.
    // fetch does), racing our synthetic TimeoutError above with no guaranteed
    // winner. Normalize on signal state rather than trusting which rejection
    // reached here first.
    if (controller.signal.aborted) {
      throw new TimeoutError(message);
    }
    throw err;
  } finally {
    clearTimeout(timeoutId);
  }
}
