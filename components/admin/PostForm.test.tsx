import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, fireEvent, screen, waitFor } from "@testing-library/react";

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn(), refresh: vi.fn() }),
}));

import { PostForm } from "@/components/admin/PostForm";

beforeEach(() => vi.restoreAllMocks());
afterEach(() => vi.unstubAllGlobals());

describe("PostForm labels", () => {
  it("exposes every field by its visible label", () => {
    render(<PostForm />);

    expect(screen.getByLabelText("Title")).toBeInTheDocument();
    expect(screen.getByLabelText(/slug/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/body \(markdown\)/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/cover image url/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/seo title/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/seo description/i)).toBeInTheDocument();
  });
});

describe("PostForm image upload", () => {
  it("uploads a picked image and inserts markdown into the body", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ url: "/uploads/x.png" }),
    });
    vi.stubGlobal("fetch", fetchMock);

    const { container } = render(<PostForm />);
    const fileInput = container.querySelector(
      'input[type="file"]',
    ) as HTMLInputElement;
    const body = container.querySelector("textarea") as HTMLTextAreaElement;

    const file = new File([new Uint8Array(8)], "x.png", { type: "image/png" });
    fireEvent.change(fileInput, { target: { files: [file] } });

    await waitFor(() =>
      expect(body.value).toContain("![](/uploads/x.png)"),
    );
    expect(fetchMock).toHaveBeenCalledWith(
      "/api/admin/uploads",
      expect.objectContaining({ method: "POST" }),
    );
  });

  it("shows the server error when the upload fails", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: false,
      json: async () => ({ error: "Image must be 5 MB or smaller" }),
    });
    vi.stubGlobal("fetch", fetchMock);

    const { container, findByText } = render(<PostForm />);
    const fileInput = container.querySelector(
      'input[type="file"]',
    ) as HTMLInputElement;
    const body = container.querySelector("textarea") as HTMLTextAreaElement;

    fireEvent.change(fileInput, {
      target: {
        files: [new File([new Uint8Array(8)], "x.png", { type: "image/png" })],
      },
    });

    expect(await findByText(/5 MB or smaller/i)).toBeInTheDocument();
    expect(body.value).toBe("");
  });
});
