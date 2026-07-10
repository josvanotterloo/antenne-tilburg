import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";

const refresh = vi.fn();
vi.mock("next/navigation", () => ({
  useRouter: () => ({ refresh, push: vi.fn() }),
}));

import { NoticeActions } from "@/components/admin/NoticeActions";

const notice = {
  id: "n1",
  message: "Closed for the holidays",
  active: true,
  startsAt: null,
  endsAt: null,
};

beforeEach(() => {
  vi.restoreAllMocks();
  refresh.mockClear();
});

describe("NoticeActions", () => {
  it("refreshes on a successful activate toggle", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({ ok: true, json: async () => ({}) }),
    );
    render(<NoticeActions notice={notice} />);
    fireEvent.click(screen.getByRole("button", { name: /deactivate/i }));
    await vi.waitFor(() => expect(refresh).toHaveBeenCalled());
  });

  it("shows a visible error (and does not refresh) when the toggle fails", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: false,
        json: async () => ({ error: "Could not save notice" }),
      }),
    );
    render(<NoticeActions notice={notice} />);
    fireEvent.click(screen.getByRole("button", { name: /deactivate/i }));

    expect(await screen.findByRole("alert")).toHaveTextContent(
      /could not save notice/i,
    );
    expect(refresh).not.toHaveBeenCalled();
  });
});
