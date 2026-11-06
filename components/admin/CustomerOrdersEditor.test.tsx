import { describe, it, expect, vi, afterEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

import { CustomerOrdersEditor } from "@/components/admin/CustomerOrdersEditor";

function mockFetch(response: Response) {
  return vi.spyOn(globalThis, "fetch").mockResolvedValue(response);
}

afterEach(() => {
  vi.restoreAllMocks();
});

describe("CustomerOrdersEditor", () => {
  it("renders the initial content in the textarea", () => {
    render(<CustomerOrdersEditor initialContent="## Customer Orders - Vril" locale="NL" />);

    expect(screen.getByRole("textbox")).toHaveValue(
      "## Customer Orders - Vril",
    );
  });

  it("updates the textarea on edit and clears a prior Saved indicator", async () => {
    const user = userEvent.setup();
    mockFetch(new Response(JSON.stringify({ ok: true }), { status: 200 }));
    render(<CustomerOrdersEditor initialContent="start" locale="NL" />);

    await user.click(screen.getByRole("button", { name: /opslaan/i }));
    expect(await screen.findByText("✓ Opgeslagen")).toBeInTheDocument();

    await user.type(screen.getByRole("textbox"), " more");

    expect(screen.getByRole("textbox")).toHaveValue("start more");
    expect(screen.queryByText("✓ Opgeslagen")).not.toBeInTheDocument();
  });

  it("POSTs the current content and shows Saved on success", async () => {
    const fetchMock = mockFetch(
      new Response(JSON.stringify({ ok: true }), { status: 200 }),
    );
    const user = userEvent.setup();
    render(<CustomerOrdersEditor initialContent="## notes" locale="NL" />);

    await user.click(screen.getByRole("button", { name: /opslaan/i }));

    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledWith(
        "/api/admin/customer-orders",
        expect.objectContaining({ method: "POST" }),
      );
    });
    const [, init] = fetchMock.mock.calls[0];
    expect(JSON.parse(init!.body as string)).toEqual({ content: "## notes" });
    expect(await screen.findByText("✓ Opgeslagen")).toBeInTheDocument();
  });

  it("shows a visible error and no Saved indicator when the save fails", async () => {
    mockFetch(
      new Response(JSON.stringify({ error: "disk full" }), { status: 500 }),
    );
    const user = userEvent.setup();
    render(<CustomerOrdersEditor initialContent="## notes" locale="NL" />);

    await user.click(screen.getByRole("button", { name: /opslaan/i }));

    expect(await screen.findByRole("alert")).toHaveTextContent("disk full");
    expect(screen.queryByText("✓ Opgeslagen")).not.toBeInTheDocument();
  });

  it("renders the markdown preview from the live (edited) content, not the stale initial content", async () => {
    const user = userEvent.setup();
    render(<CustomerOrdersEditor initialContent="old heading" locale="NL" />);

    await user.clear(screen.getByRole("textbox"));
    await user.type(screen.getByRole("textbox"), "## Fresh Heading");

    expect(
      await screen.findByRole("heading", { name: "Fresh Heading" }),
    ).toBeInTheDocument();
    expect(screen.queryByText("old heading")).not.toBeInTheDocument();
  });

  it("renders English chrome when locale is EN", async () => {
    const user = userEvent.setup();
    mockFetch(new Response(JSON.stringify({ ok: true }), { status: 200 }));
    render(<CustomerOrdersEditor initialContent="start" locale="EN" />);

    expect(screen.getByText("Preview")).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: /save/i }));
    expect(await screen.findByText("✓ Saved")).toBeInTheDocument();
  });
});
