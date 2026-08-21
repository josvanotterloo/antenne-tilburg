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
  artists: [{ id: "a1", name: "Vril" }],
  title: "Torus",
  catalogNumber: "ZR-001",
  label: { id: "l1", name: "Zulema Records" },
  genres: [{ id: "g1", name: "Techno" }],
  productType: { id: "t1", name: "LP" },
  supplier: null,
  condition: "NEW" as const,
  price: "24.99",
  description: "Deep dub techno.",
  coverImage: "/uploads/existing-cover.webp",
  quantity: 4,
  isVariousArtists: false,
  contents: null,
};

describe("ProductForm", () => {
  beforeEach(() => vi.clearAllMocks());
  afterEach(() => vi.restoreAllMocks());

  it("renders every field of the product", () => {
    render(<ProductForm />);

    expect(
      screen.getByRole("combobox", { name: /artists/i }),
    ).toBeInTheDocument();
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
      screen.getByRole("textbox", { name: /description/i }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: /add product/i }),
    ).toBeInTheDocument();
  });

  it("associates labels with inputs — clicking a label focuses its field", async () => {
    const user = userEvent.setup();
    render(<ProductForm />);

    await user.click(screen.getByText("Artists"));
    expect(screen.getByRole("combobox", { name: /artists/i })).toHaveFocus();

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

  it("shows quantity as read-only text with Adjust stock, only when editing", () => {
    const { unmount } = render(<ProductForm product={PRODUCT} />);
    expect(screen.getByText("4")).toBeInTheDocument();
    expect(screen.queryByRole("spinbutton", { name: /quantity/i })).toBeNull();
    expect(screen.getByRole("button", { name: /adjust stock/i })).toBeInTheDocument();
    unmount();

    render(<ProductForm />);
    expect(screen.queryByRole("button", { name: /adjust stock/i })).toBeNull();
  });

  // Regression: AdjustStockForm previously rendered its own <form>, nested
  // inside this component's <form> — invalid HTML that real browsers
  // silently refuse to submit (jsdom doesn't reproduce the bug, which is why
  // it shipped undetected). Asserting a single <form> in the tree, even
  // after expanding the adjust-stock UI, keeps that regression from
  // returning unnoticed.
  it("never nests a second <form> inside itself, even with Adjust stock expanded", async () => {
    const user = userEvent.setup();
    const { container } = render(<ProductForm product={PRODUCT} />);
    await user.click(screen.getByRole("button", { name: /adjust stock/i }));
    expect(container.querySelectorAll("form")).toHaveLength(1);
  });

  it("renders a cover image upload field, without a preview on a new product", () => {
    render(<ProductForm />);
    expect(screen.getByLabelText(/cover image/i)).toBeInTheDocument();
    expect(screen.queryByRole("img", { name: /cover image/i })).toBeNull();
  });

  it("shows the existing cover image preview when editing", () => {
    render(<ProductForm product={PRODUCT} />);
    expect(screen.getByRole("img", { name: /cover image/i })).toHaveAttribute(
      "src",
      "/uploads/existing-cover.webp",
    );
  });

  it("uploads a picked file and previews the returned URL", async () => {
    const user = userEvent.setup();
    const fetchMock = vi
      .spyOn(globalThis, "fetch")
      .mockResolvedValue(
        new Response(JSON.stringify({ url: "/uploads/new-cover.webp" }), {
          status: 201,
        }),
      );

    render(<ProductForm />);
    const file = new File([new Uint8Array(8)], "cover.png", {
      type: "image/png",
    });
    await user.upload(screen.getByLabelText(/cover image/i), file);

    expect(fetchMock).toHaveBeenCalledWith(
      "/api/admin/uploads",
      expect.objectContaining({ method: "POST" }),
    );
    expect(
      await screen.findByRole("img", { name: /cover image/i }),
    ).toHaveAttribute("src", "/uploads/new-cover.webp");
  });

  it("submits valid data and returns to the catalog", async () => {
    const user = userEvent.setup();
    const fetchMock = vi
      .spyOn(globalThis, "fetch")
      .mockResolvedValue(new Response(JSON.stringify({ ok: true })));

    render(<ProductForm product={PRODUCT} />);
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
      artistIds: ["a1"],
      title: "Torus",
      labelId: "l1",
      genreIds: ["g1"],
      productTypeId: "t1",
      condition: "NEW",
      price: "24.99",
      coverImage: "/uploads/existing-cover.webp",
    });
    await waitFor(() => expect(push).toHaveBeenCalledWith("/admin/catalog"));
  });

  it("removing an artist chip and submitting sends the remaining artistIds", async () => {
    const user = userEvent.setup();
    const fetchMock = vi
      .spyOn(globalThis, "fetch")
      .mockResolvedValue(new Response(JSON.stringify({ ok: true })));

    render(
      <ProductForm
        product={{
          ...PRODUCT,
          artists: [
            { id: "a1", name: "Vril" },
            { id: "a2", name: "Rrose" },
          ],
        }}
      />,
    );

    await user.click(screen.getByRole("button", { name: "Remove Vril" }));
    await user.click(screen.getByRole("button", { name: /save changes/i }));

    await waitFor(() => expect(fetchMock).toHaveBeenCalled());
    const body = JSON.parse(
      (fetchMock.mock.calls[0][1] as RequestInit).body as string,
    );
    expect(body.artistIds).toEqual(["a2"]);
  });

  it("renders a genre multi-select, with existing genres shown as removable chips", () => {
    render(
      <ProductForm
        product={{
          ...PRODUCT,
          genres: [
            { id: "g1", name: "Techno" },
            { id: "g2", name: "House" },
          ],
        }}
      />,
    );

    expect(
      screen.getByRole("combobox", { name: /genres/i }),
    ).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Remove Techno" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Remove House" })).toBeInTheDocument();
  });

  it("adding a second genre and submitting sends both genreIds, in pick order", async () => {
    const user = userEvent.setup();
    const fetchMock = vi.spyOn(globalThis, "fetch").mockImplementation(async (input) => {
      const url = String(input);
      if (url.startsWith("/api/admin/genres")) {
        return new Response(JSON.stringify([{ id: "g2", name: "House" }]));
      }
      return new Response(JSON.stringify({ ok: true }));
    });

    render(<ProductForm product={PRODUCT} />);

    await user.click(screen.getByRole("combobox", { name: /genres/i }));
    await user.click(await screen.findByRole("option", { name: "House" }));
    await user.click(screen.getByRole("button", { name: /save changes/i }));

    await waitFor(() =>
      expect(fetchMock).toHaveBeenCalledWith(
        "/api/admin/products/p1",
        expect.objectContaining({ method: "PATCH" }),
      ),
    );
    const call = fetchMock.mock.calls.find(([url]) => url === "/api/admin/products/p1")!;
    const body = JSON.parse((call[1] as RequestInit).body as string);
    expect(body.genreIds).toEqual(["g1", "g2"]);
  });

  it("submits supplierId: null when no supplier is picked", async () => {
    const user = userEvent.setup();
    vi.spyOn(globalThis, "fetch").mockImplementation(async (input) => {
      const url = String(input);
      if (url.startsWith("/api/admin/artists")) {
        return new Response(JSON.stringify([{ id: "a1", name: "Vril" }]));
      }
      if (url.startsWith("/api/admin/labels")) {
        return new Response(
          JSON.stringify([{ id: "l1", name: "Zulema Records" }]),
        );
      }
      if (url.startsWith("/api/admin/genres")) {
        return new Response(JSON.stringify([{ id: "g1", name: "Techno" }]));
      }
      if (url.startsWith("/api/admin/product-types")) {
        return new Response(JSON.stringify([{ id: "t1", name: "LP" }]));
      }
      return new Response(JSON.stringify([]));
    });

    render(<ProductForm />);

    await user.click(screen.getByRole("combobox", { name: /artists/i }));
    await user.click(await screen.findByRole("option", { name: "Vril" }));

    await user.type(screen.getByRole("textbox", { name: /title/i }), "Torus");

    await user.click(screen.getByRole("combobox", { name: /label/i }));
    await user.click(
      await screen.findByRole("option", { name: "Zulema Records" }),
    );

    await user.click(screen.getByRole("combobox", { name: /genre/i }));
    await user.click(await screen.findByRole("option", { name: "Techno" }));

    await user.click(screen.getByRole("combobox", { name: /product type/i }));
    await user.click(await screen.findByRole("option", { name: "LP" }));

    await user.type(screen.getByRole("spinbutton", { name: /price/i }), "24.99");

    await user.click(screen.getByRole("button", { name: /add product/i }));

    await waitFor(() =>
      expect(global.fetch).toHaveBeenCalledWith(
        "/api/admin/products",
        expect.objectContaining({
          body: expect.stringContaining('"supplierId":null'),
        }),
      ),
    );
  });

  it("prefills the supplier from the selected label when creating, without overwriting a manual pick", async () => {
    const user = userEvent.setup();
    vi.spyOn(globalThis, "fetch").mockImplementation(async (input) => {
      const url = String(input);
      if (url.startsWith("/api/admin/labels")) {
        return new Response(
          JSON.stringify([
            { id: "l1", name: "Warp", supplierId: "s1", supplierName: "Beta Distro" },
          ]),
        );
      }
      return new Response(JSON.stringify([]));
    });

    render(<ProductForm />);
    await user.click(screen.getByRole("combobox", { name: /label/i }));
    await user.click(await screen.findByRole("option", { name: "Warp" }));

    expect(screen.getByRole("combobox", { name: /supplier/i })).toHaveValue(
      "Beta Distro",
    );
  });

  it("keeps a manually picked supplier when a label with its own supplier is chosen afterward", async () => {
    const user = userEvent.setup();
    vi.spyOn(globalThis, "fetch").mockImplementation(async (input) => {
      const url = String(input);
      if (url.startsWith("/api/admin/suppliers")) {
        return new Response(
          JSON.stringify([{ id: "s2", name: "Manual Distro" }]),
        );
      }
      if (url.startsWith("/api/admin/labels")) {
        return new Response(
          JSON.stringify([
            { id: "l1", name: "Warp", supplierId: "s1", supplierName: "Beta Distro" },
          ]),
        );
      }
      return new Response(JSON.stringify([]));
    });

    render(<ProductForm />);

    await user.click(screen.getByRole("combobox", { name: /supplier/i }));
    await user.click(
      await screen.findByRole("option", { name: "Manual Distro" }),
    );

    await user.click(screen.getByRole("combobox", { name: /label/i }));
    await user.click(await screen.findByRole("option", { name: "Warp" }));

    expect(screen.getByRole("combobox", { name: /supplier/i })).toHaveValue(
      "Manual Distro",
    );
  });

  it("Various Artists checkbox is unchecked by default, with the artist combobox visible", () => {
    render(<ProductForm />);
    expect(
      screen.getByRole("checkbox", { name: /various artists/i }),
    ).not.toBeChecked();
    expect(
      screen.getByRole("combobox", { name: /artists/i }),
    ).toBeInTheDocument();
    expect(screen.queryByPlaceholderText(/surgeon, regis/i)).toBeNull();
  });

  it("checking Various Artists hides the artist combobox and shows the contents textarea", async () => {
    const user = userEvent.setup();
    render(<ProductForm />);

    await user.click(screen.getByRole("checkbox", { name: /various artists/i }));

    expect(screen.queryByRole("combobox", { name: /artists/i })).toBeNull();
    expect(screen.getByPlaceholderText(/surgeon, regis/i)).toBeInTheDocument();
  });

  it("unchecking Various Artists after checking clears contents and restores an empty artist combobox", async () => {
    const user = userEvent.setup();
    render(<ProductForm />);

    const checkbox = screen.getByRole("checkbox", { name: /various artists/i });
    await user.click(checkbox);
    await user.type(
      screen.getByPlaceholderText(/surgeon, regis/i),
      "Surgeon, Regis",
    );
    await user.click(checkbox);

    expect(screen.queryByPlaceholderText(/surgeon, regis/i)).toBeNull();
    const combobox = screen.getByRole("combobox", { name: /artists/i });
    expect(combobox).toBeInTheDocument();
    expect(screen.queryByText("Vril")).toBeNull();
  });

  it("submits isVariousArtists and contents when the checkbox is checked", async () => {
    const user = userEvent.setup();
    const fetchMock = vi
      .spyOn(globalThis, "fetch")
      .mockResolvedValue(new Response(JSON.stringify({ ok: true })));

    render(<ProductForm product={PRODUCT} />);
    await user.click(screen.getByRole("checkbox", { name: /various artists/i }));
    await user.type(
      screen.getByPlaceholderText(/surgeon, regis/i),
      "Surgeon, Regis",
    );
    await user.click(screen.getByRole("button", { name: /save changes/i }));

    await waitFor(() => expect(fetchMock).toHaveBeenCalled());
    const body = JSON.parse(
      (fetchMock.mock.calls[0][1] as RequestInit).body as string,
    );
    expect(body.isVariousArtists).toBe(true);
    expect(body.contents).toBe("Surgeon, Regis");
  });

  it("never prefills supplier when editing an existing product, even with no supplier set", async () => {
    const user = userEvent.setup();
    vi.spyOn(globalThis, "fetch").mockImplementation(async (input) => {
      const url = String(input);
      if (url.startsWith("/api/admin/labels")) {
        return new Response(
          JSON.stringify([
            { id: "l2", name: "Ostgut Ton", supplierId: "s1", supplierName: "Beta Distro" },
          ]),
        );
      }
      return new Response(JSON.stringify([]));
    });

    render(<ProductForm product={PRODUCT} />);

    await user.click(screen.getByRole("combobox", { name: /label/i }));
    await user.click(await screen.findByRole("option", { name: "Ostgut Ton" }));

    expect(screen.getByRole("combobox", { name: /supplier/i })).toHaveValue("");
  });
});
