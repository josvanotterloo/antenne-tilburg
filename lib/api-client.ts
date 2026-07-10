// Thin fetch wrapper for admin mutations. Turns the two silent failure modes
// into thrown, human-readable Errors so callers (via useAsyncAction) always
// surface a message instead of a stuck button or a silent no-op:
//   - network failure (fetch rejects) → "Couldn't reach the server…"
//   - non-ok response → the server's { error } message, or a generic fallback
// On success, returns the parsed JSON body (or undefined for an empty body).

const NETWORK_ERROR =
  "Couldn't reach the server. Please check your connection and try again.";
const GENERIC_ERROR = "Something went wrong. Please try again.";

export async function apiSend<T = unknown>(
  input: RequestInfo | URL,
  init?: RequestInit,
): Promise<T> {
  let res: Response;
  try {
    res = await fetch(input, init);
  } catch {
    throw new Error(NETWORK_ERROR);
  }

  if (!res.ok) {
    const body = (await res.json().catch(() => null)) as {
      error?: string;
    } | null;
    throw new Error(body?.error || GENERIC_ERROR);
  }

  return res.json().catch(() => undefined as T);
}
