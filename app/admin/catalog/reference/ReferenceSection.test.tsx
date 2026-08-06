import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

import { ReferenceSection, type ReferenceItem } from "./ReferenceSection";

const INITIAL: ReferenceItem[] = [
  { id: "1", name: "Ambient", productCount: 0 },
  { id: "2", name: "House", productCount: 3 },
];

const SERVER: ReferenceItem[] = [
  ...INITIAL,
  { id: "3", name: "Techno", productCount: 5 },
];

function mockFetch(overrides: { post?: ReferenceItem } = {}) {
  return vi.spyOn(globalThis, "fetch").mockImplementation(async (url, init) => {
    const method = init?.method ?? "GET";
    if (method === "POST") {
      return new Response(
        JSON.stringify(overrides.post ?? { id: "9", name: "Dub" }),
        { status: 201 },
      );
    }
    if (method === "PATCH" || method === "DELETE") {
      return new Response(JSON.stringify({ ok: true }), { status: 200 });
    }
    const q = (
      new URL(String(url), "http://test").searchParams.get("q") ?? ""
    ).toLowerCase();
    const matches = SERVER.filter((o) => o.name.toLowerCase().includes(q));
    return new Response(JSON.stringify(matches), { status: 200 });
  }) as unknown as ReturnType<typeof vi.fn>;
}

function setup(overrides: Partial<Parameters<typeof ReferenceSection>[0]> = {}) {
  render(
    <ReferenceSection
      title="Genres"
      endpoint="/api/admin/genres"
      initialItems={INITIAL}
      initialTotal={90}
      {...overrides}
    />,
  );
}

describe("ReferenceSection", () => {
  beforeEach(() => {
    mockFetch();
  });
  afterEach(() => vi.restoreAllMocks());

  it("renders a search input scoped to the section", () => {
    setup();
    expect(
      screen.getByRole("searchbox", { name: /search genres/i }),
    ).toBeInTheDocument();
  });

  it("renders the total count", () => {
    setup();
    expect(screen.getByText(/90 genres/i)).toBeInTheDocument();
  });

  it("updates results as the user types, debounced", async () => {
    const user = userEvent.setup();
    setup();

    expect(screen.getByText("Ambient")).toBeInTheDocument();

    await user.type(
      screen.getByRole("searchbox", { name: /search genres/i }),
      "tec",
    );

    expect(await screen.findByText("Techno")).toBeInTheDocument();
    expect(screen.queryByText("Ambient")).toBeNull();
  });

  it("increments the total and shows a newly-added item that matches the empty query", async () => {
    const user = userEvent.setup();
    setup();

    await user.type(
      screen.getByRole("textbox", { name: /new genres name/i }),
      "Dub",
    );
    await user.click(screen.getByRole("button", { name: /^add$/i }));

    expect(await screen.findByText("Dub")).toBeInTheDocument();
    expect(screen.getByText(/91 genres/i)).toBeInTheDocument();
  });

  it("increments the total but hides a newly-added item that doesn't match the active search", async () => {
    const user = userEvent.setup();
    setup();

    await user.type(
      screen.getByRole("searchbox", { name: /search genres/i }),
      "tec",
    );
    await screen.findByText("Techno");

    await user.type(
      screen.getByRole("textbox", { name: /new genres name/i }),
      "Dub",
    );
    await user.click(screen.getByRole("button", { name: /^add$/i }));

    await screen.findByText(/91 genres/i);
    expect(screen.queryByText("Dub")).toBeNull();
  });

  it("keeps a renamed item visible even if the new name no longer matches the active search", async () => {
    const user = userEvent.setup();
    setup();

    await user.type(
      screen.getByRole("searchbox", { name: /search genres/i }),
      "hou",
    );
    // "House" is already visible from the initial (unfiltered) list, so
    // waiting on it alone wouldn't prove the debounced search has actually
    // run. Wait for evidence the "hou" filter applied instead: Ambient,
    // which doesn't match, disappearing.
    await waitFor(() => expect(screen.queryByText("Ambient")).toBeNull());

    await user.click(screen.getByRole("button", { name: /^edit$/i }));
    const editInput = screen.getByRole("textbox", { name: /edit house/i });
    await user.clear(editInput);
    await user.type(editInput, "Techno Renamed");
    await user.click(screen.getByRole("button", { name: /^save$/i }));

    expect(await screen.findByText("Techno Renamed")).toBeInTheDocument();
  });

  it("removes a deleted item and decrements the total", async () => {
    const user = userEvent.setup();
    setup({ initialItems: [{ id: "1", name: "Ambient", productCount: 0 }] });

    await user.click(screen.getByRole("button", { name: /^delete$/i }));

    expect(await screen.findByText(/89 genres/i)).toBeInTheDocument();
    expect(screen.queryByText("Ambient")).toBeNull();
  });
});
