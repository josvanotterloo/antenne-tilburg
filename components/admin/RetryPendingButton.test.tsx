import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";

const refresh = vi.fn();
vi.mock("next/navigation", () => ({
  useRouter: () => ({ refresh }),
}));

import { RetryPendingButton } from "@/components/admin/RetryPendingButton";

beforeEach(() => {
  vi.restoreAllMocks();
  refresh.mockClear();
});

const click = () =>
  fireEvent.click(
    screen.getByRole("button", { name: /wachtende e-mails opnieuw proberen/i }),
  );

describe("RetryPendingButton", () => {
  it("shows the result and refreshes the page on success", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({ tried: 3, succeeded: 2, failed: 1 }),
      }),
    );
    render(<RetryPendingButton locale="NL" />);
    click();

    expect(await screen.findByRole("status")).toHaveTextContent(
      /3 opnieuw geprobeerd.*2 verzonden.*1 mislukt/i,
    );
    expect(refresh).toHaveBeenCalled();
  });

  it("omits the failed count when everything succeeded", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({ tried: 2, succeeded: 2, failed: 0 }),
      }),
    );
    render(<RetryPendingButton locale="NL" />);
    click();

    const status = await screen.findByRole("status");
    expect(status).toHaveTextContent(/2 opnieuw geprobeerd.*2 verzonden/i);
    expect(status).not.toHaveTextContent(/mislukt/i);
  });

  it("shows a visible error (and does not refresh) when the request fails", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: false,
        json: async () => ({ error: "EMAIL_ENCRYPTION_KEY is missing" }),
      }),
    );
    render(<RetryPendingButton locale="NL" />);
    click();

    expect(await screen.findByRole("alert")).toHaveTextContent(
      /EMAIL_ENCRYPTION_KEY is missing/i,
    );
    expect(refresh).not.toHaveBeenCalled();
  });

  it("renders the English button and result text when locale is EN", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({ tried: 3, succeeded: 2, failed: 1 }),
      }),
    );
    render(<RetryPendingButton locale="EN" />);
    fireEvent.click(screen.getByRole("button", { name: /retry pending emails/i }));

    expect(await screen.findByRole("status")).toHaveTextContent(
      /retried 3.*2 sent.*1 failed/i,
    );
  });
});
