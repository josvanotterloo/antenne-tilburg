import { describe, it, expect, vi, afterEach } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

import { Combobox } from "@/components/ui/Combobox";

const OPTIONS = [
  { id: "1", name: "Techno" },
  { id: "2", name: "House" },
  { id: "3", name: "Ambient" },
];

function setup(overrides: Partial<Parameters<typeof Combobox>[0]> = {}) {
  const onChange = vi.fn();
  const onCreated = vi.fn();
  render(
    <Combobox
      label="Genre"
      options={OPTIONS}
      value={null}
      onChange={onChange}
      createEndpoint="/api/admin/genres"
      onCreated={onCreated}
      {...overrides}
    />,
  );
  return { onChange, onCreated };
}

describe("Combobox", () => {
  afterEach(() => vi.restoreAllMocks());

  it("filters options as the user types", async () => {
    const user = userEvent.setup();
    setup();

    const input = screen.getByRole("combobox", { name: /genre/i });
    await user.click(input);
    await user.type(input, "ho");

    expect(screen.getByRole("option", { name: "House" })).toBeInTheDocument();
    expect(screen.queryByRole("option", { name: "Techno" })).toBeNull();
    expect(screen.queryByRole("option", { name: "Ambient" })).toBeNull();
  });

  it("offers a quick-add when there is no match, then selects the created item", async () => {
    const user = userEvent.setup();
    const created = { id: "9", name: "Dub" };
    const fetchMock = vi
      .spyOn(globalThis, "fetch")
      .mockResolvedValue(
        new Response(JSON.stringify(created), { status: 201 }),
      );
    const { onChange, onCreated } = setup();

    const input = screen.getByRole("combobox", { name: /genre/i });
    await user.click(input);
    await user.type(input, "Dub");

    const quickAdd = screen.getByText(/add "dub"/i);
    await user.click(quickAdd);

    expect(fetchMock).toHaveBeenCalledWith(
      "/api/admin/genres",
      expect.objectContaining({ method: "POST" }),
    );
    expect(onCreated).toHaveBeenCalledWith(created);
    expect(onChange).toHaveBeenCalledWith("9");
  });

  it("supports keyboard selection and Escape to close", async () => {
    const user = userEvent.setup();
    const { onChange } = setup();

    const input = screen.getByRole("combobox", { name: /genre/i });
    await user.click(input);
    await user.keyboard("{ArrowDown}{Enter}");

    expect(onChange).toHaveBeenCalledWith("1"); // first option, Techno

    await user.click(input);
    await user.keyboard("{Escape}");
    expect(screen.queryByRole("listbox")).toBeNull();
  });
});
