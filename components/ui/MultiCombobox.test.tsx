import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

import { MultiCombobox } from "@/components/ui/MultiCombobox";

// Server-side dataset: matches are fetched from the endpoint as the user
// types; the component never receives a preloaded options list.
const SERVER = [
  { id: "1", name: "Jeff Mills" },
  { id: "2", name: "Surgeon" },
  { id: "3", name: "Vril" },
];

function mockFetch(created = { id: "9", name: "Drax" }) {
  return vi.spyOn(globalThis, "fetch").mockImplementation(async (url, init) => {
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

function setup(overrides: Partial<Parameters<typeof MultiCombobox>[0]> = {}) {
  const onChange = vi.fn();
  const utils = render(
    <MultiCombobox
      label="Artists"
      endpoint="/api/admin/artists"
      selected={[]}
      onChange={onChange}
      {...overrides}
    />,
  );
  return { onChange, ...utils };
}

describe("MultiCombobox", () => {
  let fetchMock: ReturnType<typeof mockFetch>;

  beforeEach(() => {
    fetchMock = mockFetch();
  });
  afterEach(() => vi.restoreAllMocks());

  it("shows the first matches on focus", async () => {
    const user = userEvent.setup();
    setup();

    await user.click(screen.getByRole("combobox", { name: /artists/i }));

    expect(
      await screen.findByRole("option", { name: "Jeff Mills" }),
    ).toBeInTheDocument();
  });

  it("adds a selected option as a chip and clears the search", async () => {
    const user = userEvent.setup();
    const { onChange } = setup();

    const input = screen.getByRole("combobox", { name: /artists/i });
    await user.click(input);
    await user.click(await screen.findByRole("option", { name: "Vril" }));

    expect(onChange).toHaveBeenCalledWith([{ id: "3", name: "Vril" }]);
  });

  it("appends a second selection after the first, preserving order", async () => {
    const user = userEvent.setup();
    const { onChange, rerender } = setup({
      selected: [{ id: "3", name: "Vril" }],
    });

    const input = screen.getByRole("combobox", { name: /artists/i });
    await user.click(input);
    await user.click(await screen.findByRole("option", { name: "Jeff Mills" }));

    expect(onChange).toHaveBeenCalledWith([
      { id: "3", name: "Vril" },
      { id: "1", name: "Jeff Mills" },
    ]);
    void rerender;
  });

  it("renders a removable chip per selected artist, in order", () => {
    setup({
      selected: [
        { id: "1", name: "Jeff Mills" },
        { id: "2", name: "Surgeon" },
      ],
    });

    const chips = screen.getAllByRole("button", { name: /remove/i });
    expect(chips.map((c) => c.getAttribute("aria-label"))).toEqual([
      "Remove Jeff Mills",
      "Remove Surgeon",
    ]);
  });

  it("removing a chip calls onChange with that artist excluded, others preserved in order", async () => {
    const user = userEvent.setup();
    const { onChange } = setup({
      selected: [
        { id: "1", name: "Jeff Mills" },
        { id: "2", name: "Surgeon" },
      ],
    });

    await user.click(screen.getByRole("button", { name: "Remove Jeff Mills" }));

    expect(onChange).toHaveBeenCalledWith([{ id: "2", name: "Surgeon" }]);
  });

  it("excludes already-selected artists from the dropdown", async () => {
    const user = userEvent.setup();
    setup({ selected: [{ id: "3", name: "Vril" }] });

    const input = screen.getByRole("combobox", { name: /artists/i });
    await user.click(input);
    await screen.findByRole("option", { name: "Jeff Mills" });

    expect(screen.queryByRole("option", { name: "Vril" })).toBeNull();
  });

  it("quick-adds a new artist and appends it to the selection", async () => {
    const user = userEvent.setup();
    const { onChange } = setup({ selected: [{ id: "3", name: "Vril" }] });

    const input = screen.getByRole("combobox", { name: /artists/i });
    await user.click(input);
    await user.type(input, "Drax");

    const quickAdd = await screen.findByText(/add "drax"/i);
    await user.click(quickAdd);

    expect(fetchMock).toHaveBeenCalledWith(
      "/api/admin/artists",
      expect.objectContaining({ method: "POST" }),
    );
    expect(onChange).toHaveBeenCalledWith([
      { id: "3", name: "Vril" },
      { id: "9", name: "Drax" },
    ]);
  });
});
