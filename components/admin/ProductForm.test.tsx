import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

const push = vi.fn();
const refresh = vi.fn();
vi.mock("next/navigation", () => ({
  useRouter: () => ({ push, refresh }),
}));

import { ProductForm } from "@/components/admin/ProductForm";

const PRODUCT = {
  id: "p1",
  artist: "Vril",
  title: "Torus",
  catalogNumber: "ZR-001",
  label: { id: "l1", name: "Zulema Records" },
  genre: { id: "g1", name: "Techno" },
  productType: { id: "t1", name: "LP" },
  condition: "NEW" as const,
  price: "24.99",
  description: "Deep dub techno.",
  quantity: 4,
};

describe("ProductForm", () => {
  beforeEach(() => vi.clearAllMocks());
  afterEach(() => vi.restoreAllMocks());

  it("renders every field of the product", () => {
    render(<ProductForm />);

    expect(screen.getByRole("textbox", { name: /artist/i })).toBeInTheDocument();
    expect(screen.getByRole("textbox", { name: /title/i })).toBeInTheDocument();
    expect(
      screen.getByRole("textbox", { name: /catalog number/i }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("combobox", { name: /label/i }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("combobox", { name: /genre/i }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("combobox", { name: /product type/i }),
    ).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "NEW" })).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "SECONDHAND" }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("spinbutton", { name: /price/i }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("spinbutton", { name: /quantity/i }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("textbox", { name: /description/i }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: /add product/i }),
    ).toBeInTheDocument();
  });

  it("associates labels with inputs — clicking a label focuses its field", async () => {
    const user = userEvent.setup();
    render(<ProductForm />);

    await user.click(screen.getByText("Artist"));
    expect(screen.getByRole("textbox", { name: /artist/i })).toHaveFocus();

    await user.click(screen.getByText("Price (€)"));
    expect(screen.getByRole("spinbutton", { name: /price/i })).toHaveFocus();
  });

  it("shows the sell-one button only when editing an existing product", () => {
    const { unmount } = render(<ProductForm product={PRODUCT} />);
    expect(
      screen.getByRole("button", { name: /sell one/i }),
    ).toBeInTheDocument();
    unmount();

    render(<ProductForm />);
    expect(screen.queryByRole("button", { name: /sell one/i })).toBeNull();
  });

  it("submits valid data and returns to the catalog", async () => {
    const user = userEvent.setup();
    const fetchMock = vi
      .spyOn(globalThis, "fetch")
      .mockResolvedValue(new Response(JSON.stringify({ ok: true })));

    render(<ProductForm product={PRODUCT} />);

    const artist = screen.getByRole("textbox", { name: /artist/i });
    await user.clear(artist);
    await user.type(artist, "Vril & Rrose");
    await user.click(screen.getByRole("button", { name: /save changes/i }));

    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledWith(
        "/api/admin/products/p1",
        expect.objectContaining({ method: "PATCH" }),
      );
    });
    const body = JSON.parse(
      (fetchMock.mock.calls[0][1] as RequestInit).body as string,
    );
    expect(body).toMatchObject({
      artist: "Vril & Rrose",
      title: "Torus",
      labelId: "l1",
      genreId: "g1",
      productTypeId: "t1",
      condition: "NEW",
      price: "24.99",
    });
    await waitFor(() => expect(push).toHaveBeenCalledWith("/admin/catalog"));
  });
});
