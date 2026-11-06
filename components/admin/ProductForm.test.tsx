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

  it("renders English labels and condition buttons when locale is EN", () => {
    render(<ProductForm locale="EN" />);
    expect(screen.getByText("Title")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "New" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Secondhand" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /add product/i })).toBeInTheDocument();
  });

  it("renders every field of the product", () => {
    render(<ProductForm locale="NL" />);

    expect(
      screen.getByRole("combobox", { name: /artiesten/i }),
    ).toBeInTheDocument();
    expect(screen.getByRole("textbox", { name: /titel/i })).toBeInTheDocument();
    expect(
      screen.getByRole("textbox", { name: /catalogusnummer/i }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("combobox", { name: /label/i }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("combobox", { name: /genre/i }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("combobox", { name: /formaat/i }),
    ).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Nieuw" })).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Tweedehands" }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("spinbutton", { name: /prijs/i }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("textbox", { name: /beschrijving/i }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: /product toevoegen/i }),
    ).toBeInTheDocument();
  });

  it("associates labels with inputs — clicking a label focuses its field", async () => {
    const user = userEvent.setup();
    render(<ProductForm locale="NL" />);

    await user.click(screen.getByText("Artiesten"));
    expect(screen.getByRole("combobox", { name: /artiesten/i })).toHaveFocus();

    await user.click(screen.getByText("Prijs (€)"));
    expect(screen.getByRole("spinbutton", { name: /prijs/i })).toHaveFocus();
  });

  it("shows the sell-one button only when editing an existing product", () => {
    const { unmount } = render(<ProductForm product={PRODUCT} locale="NL" />);
    expect(
      screen.getByRole("button", { name: /verkoop één/i }),
    ).toBeInTheDocument();
    unmount();

    render(<ProductForm locale="NL" />);
    expect(screen.queryByRole("button", { name: /verkoop één/i })).toBeNull();
  });

  it("shows quantity as read-only text with Adjust stock, only when editing", () => {
    const { unmount } = render(<ProductForm product={PRODUCT} locale="NL" />);
    expect(screen.getByText("4")).toBeInTheDocument();
    expect(screen.queryByRole("spinbutton", { name: /aantal/i })).toBeNull();
    expect(screen.getByRole("button", { name: /voorraad aanpassen/i })).toBeInTheDocument();
    unmount();

    render(<ProductForm locale="NL" />);
    expect(screen.queryByRole("button", { name: /voorraad aanpassen/i })).toBeNull();
  });

  it("shows an editable quantity input, defaulting to 1, only when creating a new product", () => {
    const { unmount } = render(<ProductForm locale="NL" />);
    expect(screen.getByRole("spinbutton", { name: /aantal/i })).toHaveValue(1);
    unmount();

    render(<ProductForm product={PRODUCT} locale="NL" />);
    expect(screen.queryByRole("spinbutton", { name: /aantal/i })).toBeNull();
  });

  it("shows a +1 button next to Sell one when editing, absent when creating", () => {
    const { unmount } = render(<ProductForm product={PRODUCT} locale="NL" />);
    expect(screen.getByRole("button", { name: "+1" })).toBeInTheDocument();
    unmount();

    render(<ProductForm locale="NL" />);
    expect(screen.queryByRole("button", { name: "+1" })).toBeNull();
  });

  it("keeps Sell one and +1 independently enabled while the other is pending", async () => {
    const user = userEvent.setup();
    let resolveSell: (value: Response) => void;
    vi.spyOn(globalThis, "fetch").mockImplementation(
      () =>
        new Promise((resolve) => {
          resolveSell = resolve;
        }),
    );

    render(<ProductForm product={PRODUCT} locale="NL" />);
    const sellButton = screen.getByRole("button", { name: /verkoop één/i });
    const plusOneButton = screen.getByRole("button", { name: "+1" });
    await user.click(sellButton);

    expect(sellButton).toBeDisabled();
    expect(plusOneButton).toBeEnabled();

    resolveSell!(new Response(JSON.stringify({ quantity: 3 })));
    await waitFor(() => expect(sellButton).toBeEnabled());
  });

  it("sends the entered quantity when creating a new product", async () => {
    const user = userEvent.setup();
    vi.spyOn(globalThis, "fetch").mockImplementation(async (input) => {
      const url = String(input);
      if (url.startsWith("/api/admin/artists")) {
        return new Response(JSON.stringify([{ id: "a1", name: "Vril" }]));
      }
      if (url.startsWith("/api/admin/labels")) {
        return new Response(JSON.stringify([{ id: "l1", name: "Zulema Records" }]));
      }
      if (url.startsWith("/api/admin/genres")) {
        return new Response(JSON.stringify([{ id: "g1", name: "Techno" }]));
      }
      if (url.startsWith("/api/admin/product-types")) {
        return new Response(JSON.stringify([{ id: "t1", name: "LP" }]));
      }
      return new Response(JSON.stringify([]));
    });

    render(<ProductForm locale="NL" />);

    await user.click(screen.getByRole("combobox", { name: /artiesten/i }));
    await user.click(await screen.findByRole("option", { name: "Vril" }));
    await user.type(screen.getByRole("textbox", { name: /titel/i }), "Torus");
    await user.click(screen.getByRole("combobox", { name: /label/i }));
    await user.click(await screen.findByRole("option", { name: "Zulema Records" }));
    await user.click(screen.getByRole("combobox", { name: /genre/i }));
    await user.click(await screen.findByRole("option", { name: "Techno" }));
    await user.click(screen.getByRole("combobox", { name: /formaat/i }));
    await user.click(await screen.findByRole("option", { name: "LP" }));
    await user.type(screen.getByRole("spinbutton", { name: /prijs/i }), "24.99");

    const quantityInput = screen.getByRole("spinbutton", { name: /aantal/i });
    await user.clear(quantityInput);
    await user.type(quantityInput, "3");

    await user.click(screen.getByRole("button", { name: /product toevoegen/i }));

    await waitFor(() =>
      expect(global.fetch).toHaveBeenCalledWith(
        "/api/admin/products",
        expect.objectContaining({ body: expect.stringContaining('"quantity":3') }),
      ),
    );
  });

  // Regression: AdjustStockForm previously rendered its own <form>, nested
  // inside this component's <form> — invalid HTML that real browsers
  // silently refuse to submit (jsdom doesn't reproduce the bug, which is why
  // it shipped undetected). Asserting a single <form> in the tree, even
  // after expanding the adjust-stock UI, keeps that regression from
  // returning unnoticed.
  it("never nests a second <form> inside itself, even with Adjust stock expanded", async () => {
    const user = userEvent.setup();
    const { container } = render(<ProductForm product={PRODUCT} locale="NL" />);
    await user.click(screen.getByRole("button", { name: /voorraad aanpassen/i }));
    expect(container.querySelectorAll("form")).toHaveLength(1);
  });

  it("renders a cover image upload field, without a preview on a new product", () => {
    render(<ProductForm locale="NL" />);
    expect(screen.getByLabelText(/omslagafbeelding/i)).toBeInTheDocument();
    expect(screen.queryByRole("img", { name: /cover image/i })).toBeNull();
  });

  it("shows the existing cover image preview when editing", () => {
    render(<ProductForm product={PRODUCT} locale="NL" />);
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

    render(<ProductForm locale="NL" />);
    const file = new File([new Uint8Array(8)], "cover.png", {
      type: "image/png",
    });
    await user.upload(screen.getByLabelText(/omslagafbeelding/i), file);

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

    render(<ProductForm product={PRODUCT} locale="NL" />);
    await user.click(screen.getByRole("button", { name: /wijzigingen opslaan/i }));

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
        locale="NL"
      />,
    );

    await user.click(screen.getByRole("button", { name: "Verwijder Vril" }));
    await user.click(screen.getByRole("button", { name: /wijzigingen opslaan/i }));

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
        locale="NL"
      />,
    );

    expect(
      screen.getByRole("combobox", { name: /genres/i }),
    ).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Verwijder Techno" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Verwijder House" })).toBeInTheDocument();
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

    render(<ProductForm product={PRODUCT} locale="NL" />);

    await user.click(screen.getByRole("combobox", { name: /genres/i }));
    await user.click(await screen.findByRole("option", { name: "House" }));
    await user.click(screen.getByRole("button", { name: /wijzigingen opslaan/i }));

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

    render(<ProductForm locale="NL" />);

    await user.click(screen.getByRole("combobox", { name: /artiesten/i }));
    await user.click(await screen.findByRole("option", { name: "Vril" }));

    await user.type(screen.getByRole("textbox", { name: /titel/i }), "Torus");

    await user.click(screen.getByRole("combobox", { name: /label/i }));
    await user.click(
      await screen.findByRole("option", { name: "Zulema Records" }),
    );

    await user.click(screen.getByRole("combobox", { name: /genre/i }));
    await user.click(await screen.findByRole("option", { name: "Techno" }));

    await user.click(screen.getByRole("combobox", { name: /formaat/i }));
    await user.click(await screen.findByRole("option", { name: "LP" }));

    await user.type(screen.getByRole("spinbutton", { name: /prijs/i }), "24.99");

    await user.click(screen.getByRole("button", { name: /product toevoegen/i }));

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

    render(<ProductForm locale="NL" />);
    await user.click(screen.getByRole("combobox", { name: /label/i }));
    await user.click(await screen.findByRole("option", { name: "Warp" }));

    expect(screen.getByRole("combobox", { name: /leverancier/i })).toHaveValue(
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

    render(<ProductForm locale="NL" />);

    await user.click(screen.getByRole("combobox", { name: /leverancier/i }));
    await user.click(
      await screen.findByRole("option", { name: "Manual Distro" }),
    );

    await user.click(screen.getByRole("combobox", { name: /label/i }));
    await user.click(await screen.findByRole("option", { name: "Warp" }));

    expect(screen.getByRole("combobox", { name: /leverancier/i })).toHaveValue(
      "Manual Distro",
    );
  });

  it("Various Artists checkbox is unchecked by default, with the artist combobox visible", () => {
    render(<ProductForm locale="NL" />);
    expect(
      screen.getByRole("checkbox", { name: /diverse artiesten/i }),
    ).not.toBeChecked();
    expect(
      screen.getByRole("combobox", { name: /artiesten/i }),
    ).toBeInTheDocument();
    expect(screen.queryByPlaceholderText(/surgeon, regis/i)).toBeNull();
  });

  it("checking Various Artists hides the artist combobox and shows the contents textarea", async () => {
    const user = userEvent.setup();
    render(<ProductForm locale="NL" />);

    await user.click(screen.getByRole("checkbox", { name: /diverse artiesten/i }));

    expect(screen.queryByRole("combobox", { name: /artiesten/i })).toBeNull();
    expect(screen.getByPlaceholderText(/surgeon, regis/i)).toBeInTheDocument();
  });

  it("unchecking Various Artists after checking clears contents and restores an empty artist combobox", async () => {
    const user = userEvent.setup();
    render(<ProductForm locale="NL" />);

    const checkbox = screen.getByRole("checkbox", { name: /diverse artiesten/i });
    await user.click(checkbox);
    await user.type(
      screen.getByPlaceholderText(/surgeon, regis/i),
      "Surgeon, Regis",
    );
    await user.click(checkbox);

    expect(screen.queryByPlaceholderText(/surgeon, regis/i)).toBeNull();
    const combobox = screen.getByRole("combobox", { name: /artiesten/i });
    expect(combobox).toBeInTheDocument();
    expect(screen.queryByText("Vril")).toBeNull();
  });

  it("submits isVariousArtists and contents when the checkbox is checked", async () => {
    const user = userEvent.setup();
    const fetchMock = vi
      .spyOn(globalThis, "fetch")
      .mockResolvedValue(new Response(JSON.stringify({ ok: true })));

    render(<ProductForm product={PRODUCT} locale="NL" />);
    await user.click(screen.getByRole("checkbox", { name: /diverse artiesten/i }));
    await user.type(
      screen.getByPlaceholderText(/surgeon, regis/i),
      "Surgeon, Regis",
    );
    await user.click(screen.getByRole("button", { name: /wijzigingen opslaan/i }));

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

    render(<ProductForm product={PRODUCT} locale="NL" />);

    await user.click(screen.getByRole("combobox", { name: /label/i }));
    await user.click(await screen.findByRole("option", { name: "Ostgut Ton" }));

    expect(screen.getByRole("combobox", { name: /leverancier/i })).toHaveValue("");
  });
});
