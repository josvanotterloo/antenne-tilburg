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

  it("moving the second chip up swaps it with the first (position is load-bearing)", async () => {
    const user = userEvent.setup();
    const { onChange } = setup({
      selected: [
        { id: "1", name: "Jeff Mills" },
        { id: "2", name: "Surgeon" },
      ],
    });

    await user.click(screen.getByRole("button", { name: "Move Surgeon up" }));

    expect(onChange).toHaveBeenCalledWith([
      { id: "2", name: "Surgeon" },
      { id: "1", name: "Jeff Mills" },
    ]);
  });

  it("moving the first chip down swaps it with the second", async () => {
    const user = userEvent.setup();
    const { onChange } = setup({
      selected: [
        { id: "1", name: "Jeff Mills" },
        { id: "2", name: "Surgeon" },
      ],
    });

    await user.click(
      screen.getByRole("button", { name: "Move Jeff Mills down" }),
    );

    expect(onChange).toHaveBeenCalledWith([
      { id: "2", name: "Surgeon" },
      { id: "1", name: "Jeff Mills" },
    ]);
  });

  it("disables move-up on the first chip and move-down on the last", () => {
    setup({
      selected: [
        { id: "1", name: "Jeff Mills" },
        { id: "2", name: "Surgeon" },
      ],
    });

    expect(screen.getByRole("button", { name: "Move Jeff Mills up" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "Move Surgeon down" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "Move Jeff Mills down" })).toBeEnabled();
    expect(screen.getByRole("button", { name: "Move Surgeon up" })).toBeEnabled();
  });

  it("does not render reorder buttons with only one artist selected", () => {
    setup({ selected: [{ id: "1", name: "Jeff Mills" }] });
    expect(screen.queryByRole("button", { name: /^Move /i })).toBeNull();
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

  it("blocks submission (native required) when required and nothing is selected", () => {
    const { container } = setup({ required: true, selected: [] });
    const proxy = container.querySelector(
      'input[aria-hidden="true"]',
    ) as HTMLInputElement;
    expect(proxy).not.toBeNull();
    expect(proxy.checkValidity()).toBe(false);
  });

  it("the required proxy becomes valid once at least one artist is selected", () => {
    const { container } = setup({
      required: true,
      selected: [{ id: "3", name: "Vril" }],
    });
    const proxy = container.querySelector(
      'input[aria-hidden="true"]',
    ) as HTMLInputElement;
    expect(proxy.checkValidity()).toBe(true);
  });

  it("does not render the required proxy when required is not set", () => {
    const { container } = setup({ selected: [] });
    expect(container.querySelector('input[aria-hidden="true"]')).toBeNull();
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
