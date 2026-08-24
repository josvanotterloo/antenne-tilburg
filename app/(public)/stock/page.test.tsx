import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";

vi.mock("next/link", () => ({
  default: ({
    href,
    children,
    ...rest
  }: {
    href: string;
    children: React.ReactNode;
  } & Record<string, unknown>) => (
    <a href={href} {...rest}>
      {children}
    </a>
  ),
}));
vi.mock("@/lib/catalog", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/catalog")>();
  return { ...actual, getLatestProducts: vi.fn() };
});

import StockPage from "@/app/(public)/stock/page";
import { getLatestProducts } from "@/lib/catalog";

const product = (over: Record<string, unknown> = {}) => ({
  id: "p1",
  productArtists: [
    { position: 0, artistId: "a1", artist: { id: "a1", name: "Vril" } },
  ],
  title: "Torus",
  price: "24.99",
  condition: "NEW",
  inStock: true,
  quantity: 1,
  createdAt: new Date(),
  updatedAt: new Date(),
  label: { id: "l1", name: "Zulema Records" },
  productGenres: [
    { position: 0, genreId: "g1", genre: { id: "g1", name: "Techno" } },
  ],
  productType: { id: "t1", name: "LP" },
  ...over,
});

const noParams = Promise.resolve({});

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(getLatestProducts).mockResolvedValue([product()] as never);
});

describe("/stock page", () => {
  it("renders the New Arrivals heading", async () => {
    render(await StockPage({ searchParams: noParams }));
    expect(
      screen.getByRole("heading", { name: /new arrivals/i }),
    ).toBeInTheDocument();
  });

  it("requests the last 100 in-stock arrivals, unsorted, by default", async () => {
    await StockPage({ searchParams: noParams });
    expect(getLatestProducts).toHaveBeenCalledWith(100, true, undefined, undefined);
  });

  it("passes sort/order from the URL through to getLatestProducts", async () => {
    await StockPage({
      searchParams: Promise.resolve({ sort: "artist", order: "desc" }),
    });
    expect(getLatestProducts).toHaveBeenCalledWith(100, true, "artist", "desc");
  });

  it("renders products from getLatestProducts", async () => {
    render(await StockPage({ searchParams: noParams }));
    expect(screen.getByText("Vril")).toBeInTheDocument();
    expect(screen.getByText(/Torus/)).toBeInTheDocument();
    expect(screen.getByText(/Zulema Records/)).toBeInTheDocument();
    expect(screen.getByText("LP")).toBeInTheDocument();
  });

  it("shows the RESTOCK badge when a product is a restock", async () => {
    vi.mocked(getLatestProducts).mockResolvedValue([
      product({
        createdAt: new Date("2026-06-01T10:00:00Z"),
        updatedAt: new Date("2026-07-10T10:00:00Z"),
        quantity: 2,
      }),
    ] as never);
    render(await StockPage({ searchParams: noParams }));
    expect(screen.getByText(/restock/i)).toBeInTheDocument();
  });

  it("never shows a JUST IN badge", async () => {
    vi.mocked(getLatestProducts).mockResolvedValue([
      product({ createdAt: new Date() }),
    ] as never);
    render(await StockPage({ searchParams: noParams }));
    expect(screen.queryByText(/just in/i)).toBeNull();
  });

  it("no longer shows an 'In stock only' toggle", async () => {
    render(await StockPage({ searchParams: noParams }));
    expect(
      screen.queryByRole("link", { name: /in stock only/i }),
    ).toBeNull();
  });

  it("renders no filter sidebar, search box, or pagination", async () => {
    render(await StockPage({ searchParams: noParams }));
    expect(screen.queryByRole("searchbox")).toBeNull();
    expect(screen.queryByRole("heading", { name: /^genre$/i })).toBeNull();
    expect(screen.queryByRole("heading", { name: /^condition$/i })).toBeNull();
    expect(screen.queryByRole("navigation", { name: /pagination/i })).toBeNull();
    expect(screen.queryByRole("navigation", { name: /stock sections/i })).toBeNull();
  });

  it("does not render a price or artist/label links", async () => {
    render(await StockPage({ searchParams: noParams }));
    expect(screen.queryByText(/€/)).toBeNull();
    expect(screen.queryByRole("link", { name: "Vril" })).toBeNull();
    expect(screen.queryByRole("link", { name: "Zulema Records" })).toBeNull();
  });

  it("renders each product's title as a link to its detail page", async () => {
    render(await StockPage({ searchParams: noParams }));
    expect(screen.getByRole("link", { name: /Torus/ })).toHaveAttribute(
      "href",
      "/stock/p1",
    );
  });

  it("shows an empty-state message and no table when there are no arrivals", async () => {
    vi.mocked(getLatestProducts).mockResolvedValue([] as never);
    render(await StockPage({ searchParams: noParams }));
    expect(screen.getByText(/nothing here yet/i)).toBeInTheDocument();
    expect(screen.queryByRole("table")).toBeNull();
  });

  describe("sortable column headers", () => {
    it("renders a sortable header for each of Type, Artist, Title, and Label", async () => {
      render(await StockPage({ searchParams: noParams }));
      for (const name of ["Type", "Artist", "Title", "Label"]) {
        expect(
          screen.getByRole("columnheader", { name: new RegExp(`^${name}$`, "i") }),
        ).toBeInTheDocument();
      }
    });

    it("defaults to no active sort — every header reads aria-sort=none", async () => {
      render(await StockPage({ searchParams: noParams }));
      for (const name of ["Type", "Artist", "Title", "Label"]) {
        expect(
          screen.getByRole("columnheader", { name: new RegExp(`^${name}$`, "i") }),
        ).toHaveAttribute("aria-sort", "none");
      }
    });

    it("each header's first-click link sorts ascending", async () => {
      render(await StockPage({ searchParams: noParams }));
      expect(screen.getByRole("link", { name: "Type" })).toHaveAttribute(
        "href",
        "/stock?sort=type&order=asc",
      );
      expect(screen.getByRole("link", { name: "Artist" })).toHaveAttribute(
        "href",
        "/stock?sort=artist&order=asc",
      );
      expect(screen.getByRole("link", { name: "Title" })).toHaveAttribute(
        "href",
        "/stock?sort=title&order=asc",
      );
      expect(screen.getByRole("link", { name: "Label" })).toHaveAttribute(
        "href",
        "/stock?sort=label&order=asc",
      );
    });

    it("shows the active column as ascending, second-click link sorts descending", async () => {
      render(
        await StockPage({
          searchParams: Promise.resolve({ sort: "title", order: "asc" }),
        }),
      );
      expect(
        screen.getByRole("columnheader", { name: /^title/i }),
      ).toHaveAttribute("aria-sort", "ascending");
      expect(screen.getByRole("link", { name: /^title/i })).toHaveAttribute(
        "href",
        "/stock?sort=title&order=desc",
      );
      // Inactive columns stay unsorted.
      expect(
        screen.getByRole("columnheader", { name: /^artist$/i }),
      ).toHaveAttribute("aria-sort", "none");
    });

    it("shows the active column as descending, toggles back to ascending on next click", async () => {
      render(
        await StockPage({
          searchParams: Promise.resolve({ sort: "title", order: "desc" }),
        }),
      );
      expect(
        screen.getByRole("columnheader", { name: /^title/i }),
      ).toHaveAttribute("aria-sort", "descending");
      expect(screen.getByRole("link", { name: /^title/i })).toHaveAttribute(
        "href",
        "/stock?sort=title&order=asc",
      );
    });
  });
});
