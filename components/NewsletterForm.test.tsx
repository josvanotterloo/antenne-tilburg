import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";

import NewsletterForm from "@/components/NewsletterForm";

const fill = () => {
  fireEvent.change(screen.getByLabelText(/name/i), {
    target: { value: "Jos" },
  });
  fireEvent.change(screen.getByLabelText(/email/i), {
    target: { value: "jos@x.com" },
  });
};

beforeEach(() => vi.restoreAllMocks());
afterEach(() => vi.unstubAllGlobals());

describe("NewsletterForm", () => {
  it("renders name and email fields and a submit button", () => {
    render(<NewsletterForm />);
    expect(screen.getByLabelText(/name/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/email/i)).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: /sign up|subscribe/i }),
    ).toBeInTheDocument();
  });

  it("posts the signup and confirms on success", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValue({ ok: true, json: async () => ({ ok: true }) });
    vi.stubGlobal("fetch", fetchMock);

    render(<NewsletterForm />);
    fill();
    fireEvent.click(screen.getByRole("button", { name: /sign up|subscribe/i }));

    expect(
      await screen.findByText(/check your email to confirm/i),
    ).toBeInTheDocument();
    expect(fetchMock).toHaveBeenCalledWith(
      "/api/newsletter",
      expect.objectContaining({ method: "POST" }),
    );
    expect(JSON.parse(fetchMock.mock.calls[0][1].body)).toEqual({
      name: "Jos",
      email: "jos@x.com",
    });
  });

  it("shows the server error message on failure", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: false,
      json: async () => ({ error: "A valid email is required" }),
    });
    vi.stubGlobal("fetch", fetchMock);

    render(<NewsletterForm />);
    fill();
    fireEvent.click(screen.getByRole("button", { name: /sign up|subscribe/i }));

    expect(
      await screen.findByText(/valid email is required/i),
    ).toBeInTheDocument();
  });
});
