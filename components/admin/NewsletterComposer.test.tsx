import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

import { NewsletterComposer } from "@/components/admin/NewsletterComposer";

// Structured composer (contract migrated deliberately, 2026-07-17): three
// parts — header (template), auto-loaded arrivals, footer (template) — plus
// subject and a date range. The old single markdown body is gone.

const GROUPS = [
  {
    genre: "Techno",
    items: [
      {
        artist: "Vril",
        label: "Zulema Records",
        catalogNumber: "ZR-001",
        restock: true,
      },
    ],
  },
];

function mockFetch(overrides: Record<string, Response> = {}) {
  return vi
    .spyOn(globalThis, "fetch")
    .mockImplementation(async (url, init) => {
      const u = String(url);
      if (u.startsWith("/api/admin/newsletter/arrivals")) {
        return (
          overrides.arrivals ??
          new Response(JSON.stringify(GROUPS), { status: 200 })
        );
      }
      if (u === "/api/admin/newsletter/template") {
        return (
          overrides.template ??
          new Response(JSON.stringify({ ok: true }), { status: 200 })
        );
      }
      if (u === "/api/admin/newsletter/send" && init?.method === "POST") {
        return (
          overrides.send ??
          new Response(JSON.stringify({ ok: true, sent: 3, failed: 0 }), {
            status: 200,
          })
        );
      }
      throw new Error(`unexpected fetch ${u}`);
    });
}

function setup() {
  render(
    <NewsletterComposer
      initialHeader="Hello **diggers**"
      initialFooter="See you at the shop"
      defaultFrom="2026-07-13"
      defaultTo="2026-07-17"
    />,
  );
}

describe("NewsletterComposer (structured)", () => {
  beforeEach(() => {
    // Block body on purpose: returning the spy from the hook would make
    // vitest call it as a teardown fn — i.e. fetch(undefined) after the test.
    mockFetch();
  });
  afterEach(() => vi.restoreAllMocks());

  it("renders the three parts pre-populated from the template, with the date range", () => {
    setup();

    expect(screen.getByLabelText(/subject/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/header/i)).toHaveValue("Hello **diggers**");
    expect(screen.getByLabelText(/footer/i)).toHaveValue(
      "See you at the shop",
    );
    expect(screen.getByLabelText(/from/i)).toHaveValue("2026-07-13");
    expect(screen.getByLabelText(/^to/i)).toHaveValue("2026-07-17");
    expect(
      screen.getByRole("button", { name: /load arrivals/i }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: /send newsletter/i }),
    ).toBeInTheDocument();
  });

  it("loads arrivals for the date range and shows the grouped list", async () => {
    const user = userEvent.setup();
    const fetchMock = mockFetch();
    setup();

    await user.click(screen.getByRole("button", { name: /load arrivals/i }));

    expect(
      await screen.findByText(/VRIL \[Zulema Records ZR-001\] \*/),
    ).toBeInTheDocument();
    expect(screen.getByText(/techno/)).toBeInTheDocument();
    const url = String(fetchMock.mock.calls[0][0]);
    expect(url).toContain("from=2026-07-13");
    expect(url).toContain("to=2026-07-17");
  });

  it("saves the header/footer template separately", async () => {
    const user = userEvent.setup();
    const fetchMock = mockFetch();
    setup();

    await user.click(screen.getByRole("button", { name: /save template/i }));

    await waitFor(() => {
      const call = fetchMock.mock.calls.find(
        ([u]) => String(u) === "/api/admin/newsletter/template",
      );
      expect(call).toBeDefined();
      expect(JSON.parse((call![1] as RequestInit).body as string)).toEqual({
        headerText: "Hello **diggers**",
        footerText: "See you at the shop",
      });
    });
  });

  it("previews all three parts assembled", async () => {
    const user = userEvent.setup();
    setup();

    await user.click(screen.getByRole("button", { name: /load arrivals/i }));
    await screen.findByText(/VRIL/);
    await user.click(screen.getByRole("button", { name: /preview/i }));

    const preview = screen.getByTestId("newsletter-preview");
    expect(preview).toHaveTextContent("diggers"); // header markdown
    expect(preview.querySelector("strong")).toBeTruthy(); // rendered, not raw
    expect(preview).toHaveTextContent("VRIL [Zulema Records ZR-001] *");
    expect(preview).toHaveTextContent("See you at the shop"); // footer
    expect(preview).toHaveTextContent("Noordstraat 82"); // contact block
    expect(preview).toHaveTextContent("soundcloud.com"); // social links
  });

  it("sends the structured newsletter and reports the count", async () => {
    const user = userEvent.setup();
    const fetchMock = mockFetch();
    setup();

    await user.type(screen.getByLabelText(/subject/i), "July arrivals");
    await user.click(
      screen.getByRole("button", { name: /send newsletter/i }),
    );

    expect(await screen.findByRole("status")).toHaveTextContent(
      /sent to 3 subscribers/i,
    );
    const call = fetchMock.mock.calls.find(
      ([u]) => String(u) === "/api/admin/newsletter/send",
    );
    expect(JSON.parse((call![1] as RequestInit).body as string)).toEqual({
      subject: "July arrivals",
      header: "Hello **diggers**",
      footer: "See you at the shop",
      from: "2026-07-13",
      to: "2026-07-17",
    });
  });

  it("locks out a second send after success to prevent a duplicate blast", async () => {
    const user = userEvent.setup();
    setup();

    await user.type(screen.getByLabelText(/subject/i), "July arrivals");
    const send = screen.getByRole("button", { name: /send newsletter/i });
    await user.click(send);
    await screen.findByRole("status");

    expect(screen.getByRole("button", { name: /sent/i })).toBeDisabled();
  });
});
