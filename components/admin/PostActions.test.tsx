import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";

const refresh = vi.fn();
vi.mock("next/navigation", () => ({
  useRouter: () => ({ refresh, push: vi.fn() }),
}));

import { PostActions } from "@/components/admin/PostActions";

const post = {
  id: "p1",
  title: "Fresh wax",
  slug: "fresh-wax",
  body: "body",
  coverImage: null,
  status: "DRAFT" as const,
  seoTitle: null,
  seoDescription: null,
};

beforeEach(() => {
  vi.restoreAllMocks();
  refresh.mockClear();
});

describe("PostActions", () => {
  it("refreshes on a successful publish toggle", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({ ok: true, json: async () => ({}) }),
    );
    render(<PostActions post={post} />);
    fireEvent.click(screen.getByRole("button", { name: /publish/i }));
    await vi.waitFor(() => expect(refresh).toHaveBeenCalled());
  });

  it("shows a visible error (and does not refresh) when publish fails", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: false,
        json: async () => ({ error: "Slug already exists" }),
      }),
    );
    render(<PostActions post={post} />);
    fireEvent.click(screen.getByRole("button", { name: /publish/i }));

    expect(await screen.findByRole("alert")).toHaveTextContent(
      /slug already exists/i,
    );
    expect(refresh).not.toHaveBeenCalled();
  });

  it("surfaces a connection error when the network is down", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockRejectedValue(new TypeError("Failed to fetch")),
    );
    render(<PostActions post={post} />);
    fireEvent.click(screen.getByRole("button", { name: /publish/i }));

    expect(await screen.findByRole("alert")).toHaveTextContent(
      /reach the server/i,
    );
  });
});
