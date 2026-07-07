import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";

import { NewsletterComposer } from "@/components/admin/NewsletterComposer";

beforeEach(() => {
  vi.restoreAllMocks();
});

describe("NewsletterComposer", () => {
  it("renders subject, body and a Send button", () => {
    render(<NewsletterComposer />);
    expect(screen.getByLabelText(/subject/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/body/i)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /^send/i })).toBeInTheDocument();
  });

  it("renders the markdown body when Preview is toggled", () => {
    render(<NewsletterComposer />);
    fireEvent.change(screen.getByLabelText(/body/i), {
      target: { value: "**bold**" },
    });
    fireEvent.click(screen.getByRole("button", { name: /preview/i }));
    expect(screen.getByText("bold").tagName).toBe("STRONG");
  });

  it("posts the send and shows how many subscribers were reached", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ ok: true, sent: 5, failed: 0 }),
    });
    vi.stubGlobal("fetch", fetchMock);

    render(<NewsletterComposer />);
    fireEvent.change(screen.getByLabelText(/subject/i), {
      target: { value: "New arrivals" },
    });
    fireEvent.change(screen.getByLabelText(/body/i), {
      target: { value: "Fresh wax" },
    });
    fireEvent.click(screen.getByRole("button", { name: /^send/i }));

    expect(
      await screen.findByText(/sent to 5 subscribers/i),
    ).toBeInTheDocument();
    expect(fetchMock).toHaveBeenCalledWith(
      "/api/admin/newsletter/send",
      expect.objectContaining({ method: "POST" }),
    );
    expect(JSON.parse(fetchMock.mock.calls[0][1].body)).toEqual({
      subject: "New arrivals",
      body: "Fresh wax",
    });
  });
});
