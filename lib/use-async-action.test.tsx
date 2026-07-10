import { afterEach, describe, it, expect, vi } from "vitest";
import { act, renderHook, waitFor } from "@testing-library/react";

import { useAsyncAction } from "@/lib/use-async-action";

afterEach(() => vi.restoreAllMocks());

describe("useAsyncAction", () => {
  it("starts idle with no error", () => {
    const { result } = renderHook(() => useAsyncAction());
    expect(result.current.pending).toBe(false);
    expect(result.current.error).toBeNull();
  });

  it("runs an action, toggling pending and staying error-free on success", async () => {
    const { result } = renderHook(() => useAsyncAction());
    const action = vi.fn().mockResolvedValue(undefined);

    await act(async () => {
      await result.current.run(action);
    });

    expect(action).toHaveBeenCalledTimes(1);
    expect(result.current.pending).toBe(false);
    expect(result.current.error).toBeNull();
  });

  it("captures a thrown error message and always resets pending (no stuck flag)", async () => {
    const { result } = renderHook(() => useAsyncAction());

    await act(async () => {
      await result.current.run(async () => {
        throw new Error("Could not save post");
      });
    });

    expect(result.current.error).toBe("Could not save post");
    // The critical guarantee: pending is reset even though the action threw.
    expect(result.current.pending).toBe(false);
  });

  it("falls back to a generic message when a non-Error is thrown", async () => {
    const { result } = renderHook(() => useAsyncAction());
    await act(async () => {
      await result.current.run(async () => {
        throw "boom";
      });
    });
    expect(result.current.error).toMatch(/something went wrong/i);
    expect(result.current.pending).toBe(false);
  });

  it("clears a previous error when a new run starts", async () => {
    const { result } = renderHook(() => useAsyncAction());
    await act(async () => {
      await result.current.run(async () => {
        throw new Error("first failure");
      });
    });
    expect(result.current.error).toBe("first failure");

    await act(async () => {
      await result.current.run(async () => undefined);
    });
    await waitFor(() => expect(result.current.error).toBeNull());
  });

  it("exposes setError so callers can clear/set messages directly", async () => {
    const { result } = renderHook(() => useAsyncAction());
    act(() => result.current.setError("manual"));
    expect(result.current.error).toBe("manual");
  });
});
