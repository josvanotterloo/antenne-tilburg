import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

import { Combobox } from "@/components/ui/Combobox";

// Server-side dataset: the combobox fetches matches from the endpoint as the
// user types; it never receives a preloaded options list.
const SERVER = [
  { id: "1", name: "Techno" },
  { id: "2", name: "Tresor" },
  { id: "3", name: "House" },
  { id: "4", name: "Ambient" },
];

function requestedQueries(fetchMock: ReturnType<typeof vi.fn>): string[] {
  return fetchMock.mock.calls
    .filter(([, init]) => !init || !init.method || init.method === "GET")
    .map(([url]) => new URL(String(url), "http://test").searchParams.get("q"))
    .filter((q): q is string => q !== null);
}

function mockFetch(created = { id: "9", name: "Dub" }) {
  return vi
    .spyOn(globalThis, "fetch")
    .mockImplementation(async (url, init) => {
      if (init?.method === "POST") {
        return new Response(JSON.stringify(created), { status: 201 });
      }
      const q = (
        new URL(String(url), "http://test").searchParams.get("q") ?? ""
      ).toLowerCase();
      const matches = SERVER.filter((o) => o.name.toLowerCase().includes(q))
        .sort((a, b) => a.name.localeCompare(b.name))
        .slice(0, 20);
      return new Response(JSON.stringify(matches), { status: 200 });
    }) as unknown as ReturnType<typeof vi.fn>;
}

function setup(overrides: Partial<Parameters<typeof Combobox>[0]> = {}) {
  const onChange = vi.fn();
  render(
    <Combobox
      label="Genre"
      endpoint="/api/admin/genres"
      value={null}
      onChange={onChange}
      {...overrides}
    />,
  );
  return { onChange };
}

describe("Combobox (server typeahead)", () => {
  let fetchMock: ReturnType<typeof mockFetch>;

  beforeEach(() => {
    fetchMock = mockFetch();
  });
  afterEach(() => vi.restoreAllMocks());

  it("shows the first matches on focus, before the user types", async () => {
    const user = userEvent.setup();
    setup();

    await user.click(screen.getByRole("combobox", { name: /genre/i }));

    expect(
      await screen.findByRole("option", { name: "Ambient" }),
    ).toBeInTheDocument();
    expect(requestedQueries(fetchMock)).toContain("");
  });

  it("searches the server as the user types, debounced", async () => {
    const user = userEvent.setup();
    setup();

    const input = screen.getByRole("combobox", { name: /genre/i });
    await user.click(input);
    await user.type(input, "tre");

    expect(
      await screen.findByRole("option", { name: "Tresor" }),
    ).toBeInTheDocument();
    expect(screen.queryByRole("option", { name: "House" })).toBeNull();

    // Debounce: intermediate keystrokes never reach the server.
    const queries = requestedQueries(fetchMock);
    expect(queries).toContain("tre");
    expect(queries).not.toContain("t");
    expect(queries).not.toContain("tr");
  });

  it("offers a quick-add when there is no exact match, then selects the created item", async () => {
    const user = userEvent.setup();
    const { onChange } = setup();

    const input = screen.getByRole("combobox", { name: /genre/i });
    await user.click(input);
    await user.type(input, "Dub");

    const quickAdd = await screen.findByText(/add "dub"/i);
    await user.click(quickAdd);

    expect(fetchMock).toHaveBeenCalledWith(
      "/api/admin/genres",
      expect.objectContaining({ method: "POST" }),
    );
    expect(onChange).toHaveBeenCalledWith({ id: "9", name: "Dub" });
  });

  it("shows the selected option's name", () => {
    setup({ value: { id: "3", name: "House" } });
    expect(screen.getByRole("combobox", { name: /genre/i })).toHaveValue(
      "House",
    );
  });

  it("closes when the user clicks outside without selecting", async () => {
    const user = userEvent.setup();
    const { onChange } = setup();

    const input = screen.getByRole("combobox", { name: /genre/i });
    await user.click(input);
    await screen.findByRole("listbox");

    await user.click(document.body);

    expect(screen.queryByRole("listbox")).toBeNull();
    expect(onChange).not.toHaveBeenCalled();
  });

  it("stays open when the user clicks inside the combobox", async () => {
    const user = userEvent.setup();
    setup();

    const input = screen.getByRole("combobox", { name: /genre/i });
    await user.click(input);
    await screen.findByRole("listbox");
    await user.click(input); // click again inside — must not close

    expect(screen.getByRole("listbox")).toBeInTheDocument();
  });

  it("supports keyboard selection and Escape to close", async () => {
    const user = userEvent.setup();
    const { onChange } = setup();

    const input = screen.getByRole("combobox", { name: /genre/i });
    await user.click(input);
    await screen.findByRole("option", { name: "Ambient" });
    await user.keyboard("{ArrowDown}{Enter}");

    // Options are shown in the server's (alphabetical) order.
    expect(onChange).toHaveBeenCalledWith({ id: "4", name: "Ambient" });

    await user.click(input);
    await screen.findByRole("listbox");
    await user.keyboard("{Escape}");
    expect(screen.queryByRole("listbox")).toBeNull();
  });
});
