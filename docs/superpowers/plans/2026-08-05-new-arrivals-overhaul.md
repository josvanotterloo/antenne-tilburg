# New Arrivals Overhaul Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Simplify the public `/stock` catalog into a plain "New Arrivals" list (last 100 in-stock products, no filters/search/sort/pagination/price/links) while leaving admin and the database untouched.

**Architecture:** Reuse the existing `getLatestProducts(100)` query (already powers the home page) as the single data source for both `/stock` and `/stock/feed.xml`. Strip price and artist/label links from every public render path (components, detail page, home, JSON-LD, RSS). Delete the weekly-section pages, `StockNav`, and `StockFilters` outright once nothing references them, then delete their now-dead exports from `lib/catalog.ts`. Admin keeps `getCatalogPage`/`buildCatalogWhere`/`CATALOG_INCLUDE` untouched throughout.

**Tech Stack:** Next.js 16 (App Router, TypeScript), React 19, Prisma, Vitest + Testing Library.

## Global Constraints

- Rename "Stock" → "New Arrivals" in nav, footer, `/stock` page heading/metadata, and public copy that echoes the section name (home hero CTA, home Just In link, home empty state, detail page back-link). Do **not** rename generic uses of "stock" as inventory ("Discogs stock").
- `/stock` URL does not change. A new `/new-arrivals` route redirects to `/stock`.
- `/stock` shows exactly the last 100 in-stock products, `createdAt` DESC, via `getLatestProducts()`. No filters, search, sort, pagination, or grid view.
- Price is removed from every public surface: `/stock` rows, `/stock/[id]`, home Just In, Product JSON-LD (`lib/structured-data.ts`), and the `/stock/feed.xml` RSS item description. Price stays in the DB, Prisma schema, and admin.
- Artist and label render as plain text (no links) on all public pages. `?artist=`/`?label=` query-param filtering is removed.
- JUST IN and RESTOCK badges (`isJustIn`/`isRestock` from `lib/catalog.ts`) are preserved unchanged everywhere they currently render.
- `/stock/this-week`, `/stock/last-week`, `/stock/back-in-stock`, and `/stock/back-in-stock/feed.xml` are deleted entirely (404 via Next's file-based routing — there is no page/route left to match).
- `getCatalogPage`, `buildCatalogWhere`, `CATALOG_INCLUDE`, `isRestock`, `isJustIn`, `weekRange`, `shopDayRange`, `shopDateISO` are **not** touched — admin (`app/admin/catalog/page.tsx`, `app/api/catalog/route.ts`) and the newsletter admin pages (`app/admin/content/newsletter/new/page.tsx`, `app/api/admin/newsletter/send/route.ts`, `app/api/admin/newsletter/arrivals/route.ts`) depend on them.
- Never change an existing passing test to make new code pass unless the interface deliberately changed (it does here — this plan's spec was approved by the user first).
- Follow `docs/instructions/branching.md`: this work happens on `feature/new-arrivals-overhaul` (already created and checked out), commit after each task leaves tests green, never commit to `master`.

---

### Task 1: Strip price from Product structured data

**Files:**
- Modify: `lib/structured-data.ts:22-30` (the `offers` object in `productJsonLd`)
- Test: `lib/structured-data.test.ts`

**Interfaces:**
- Consumes: nothing new.
- Produces: `productJsonLd(product)` — same signature, `offers` object no longer has `price`/`priceCurrency` keys. `availability` and `seller` are unchanged. Consumed as-is by `app/(public)/stock/[id]/page.tsx`.

- [ ] **Step 1: Update the existing test to assert price is gone (this IS the interface change, approved by the user)**

Edit `lib/structured-data.test.ts` — replace the `toMatchObject` assertion (lines 30-40):

```ts
    expect(ld.offers).toMatchObject({
      "@type": "Offer",
      availability: "https://schema.org/InStock",
      seller: {
        "@type": "MusicStore",
        name: "Antenne Recordshop",
        url: "https://antenne-tilburg.nl",
      },
    });
    expect(ld.offers).not.toHaveProperty("price");
    expect(ld.offers).not.toHaveProperty("priceCurrency");
```

- [ ] **Step 2: Run the test to verify it fails**

`npx vitest run lib/structured-data.test.ts`
Expected: FAIL — `ld.offers` still has `price: "24.99"`.

- [ ] **Step 3: Remove price/priceCurrency from the implementation**

Edit `lib/structured-data.ts` — replace the `offers` block:

```ts
    offers: {
      "@type": "Offer",
      availability: product.inStock
        ? "https://schema.org/InStock"
        : "https://schema.org/OutOfStock",
      seller: { "@type": "MusicStore", name: STORE_NAME, url: STORE_URL },
    },
```

- [ ] **Step 4: Run the test to verify it passes**

`npx vitest run lib/structured-data.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add lib/structured-data.ts lib/structured-data.test.ts
git commit -m "fix: remove price from Product structured data"
```

---

### Task 2: Remove price and artist/label links from ProductRow

**Files:**
- Modify: `components/stock/ProductRow.tsx`
- Test: `components/stock/ProductRow.test.tsx`

**Interfaces:**
- Consumes: `CatalogProduct` from `lib/catalog.ts` (unchanged), `isJustIn`/`isRestock` (unchanged).
- Produces: `ProductRow({ product, showCondition? })` — same props. No longer imports `stockArtistHref`/`stockLabelHref`. Artist and label render as `<span>` text, not `<Link>`. No price rendered. Still consumed by `app/(public)/stock/page.tsx` (Task 5) — the weekly section pages that also use it are deleted in Task 7.

- [ ] **Step 1: Update the "multiple artists" tests to assert plain text, and add price/label-link-absence assertions**

Edit `components/stock/ProductRow.test.tsx` — replace the `"ProductRow — multiple artists"` describe block (lines 73-106) and add two new tests:

```tsx
describe("ProductRow — artist and label as plain text", () => {
  it("renders a single artist as plain text, not a link", () => {
    render(<ProductRow product={product() as never} />);
    expect(screen.getByText("Vril")).toBeInTheDocument();
    expect(screen.queryByRole("link", { name: "Vril" })).toBeNull();
  });

  it('renders two artists joined by " / ", both as plain text', () => {
    render(
      <ProductRow
        product={
          product({
            productArtists: [
              { position: 0, artistId: "a1", artist: { id: "a1", name: "Jeff Mills" } },
              { position: 1, artistId: "a2", artist: { id: "a2", name: "Surgeon" } },
            ],
          }) as never
        }
      />,
    );
    expect(screen.getByText(/Jeff Mills \/ Surgeon/)).toBeInTheDocument();
    expect(screen.queryByRole("link", { name: "Jeff Mills" })).toBeNull();
    expect(screen.queryByRole("link", { name: "Surgeon" })).toBeNull();
  });

  it("renders the label as plain text, not a link", () => {
    render(<ProductRow product={product() as never} />);
    expect(screen.getByText("Zulema Records")).toBeInTheDocument();
    expect(screen.queryByRole("link", { name: "Zulema Records" })).toBeNull();
  });
});

describe("ProductRow — no price", () => {
  it("does not render a price", () => {
    render(<ProductRow product={product() as never} />);
    expect(screen.queryByText(/€/)).toBeNull();
  });
});
```

- [ ] **Step 2: Run the tests to verify they fail**

`npx vitest run components/stock/ProductRow.test.tsx`
Expected: FAIL — artist/label still render as links, price still renders.

- [ ] **Step 3: Rewrite ProductRow.tsx**

```tsx
import { Fragment } from "react";
import Link from "next/link";

import { isJustIn, isRestock, type CatalogProduct } from "@/lib/catalog";

const badgeClass =
  "ml-2 align-middle font-mono text-[0.625rem] font-bold uppercase tracking-[0.06em] text-signal";

export function JustInBadge() {
  return <span className={badgeClass}>Just In</span>;
}

export function RestockBadge() {
  return <span className={badgeClass}>Restock</span>;
}

// The /stock list row. Artist, title and label are plain text/detail links —
// no price, no artist/label filter links (removed with the public filter UI).
export function ProductRow({
  product,
  showCondition,
}: {
  product: CatalogProduct;
  showCondition?: boolean;
}) {
  return (
    <div className="-mx-4 flex items-baseline justify-between gap-4 px-4 py-4 transition-colors duration-150 ease-out hover:bg-surface">
      <span className="min-w-0 flex-1">
        <span className="font-medium text-ink">
          {[...product.productArtists]
            .sort((a, b) => a.position - b.position)
            .map((pa, i) => (
              <Fragment key={pa.artistId}>
                {i > 0 && " / "}
                {pa.artist.name}
              </Fragment>
            ))}
        </span>
        <span className="text-ink-muted"> — </span>
        <Link
          href={`/stock/${product.id}`}
          className="text-ink-muted transition-colors duration-150 ease-out hover:text-ink"
        >
          {product.title}
        </Link>
        {isJustIn(product.createdAt) && <JustInBadge />}
        {isRestock(product) && <RestockBadge />}
        <span className="mt-0.5 block truncate font-mono text-xs text-ink-muted">
          {product.label.name}
          {" · "}
          {product.genre.name}
          {" · "}
          {product.productType.name}
          {showCondition && (
            <>
              {" · "}
              {product.condition}
            </>
          )}
        </span>
      </span>
    </div>
  );
}
```

- [ ] **Step 4: Run the tests to verify they pass**

`npx vitest run components/stock/ProductRow.test.tsx`
Expected: PASS (badge tests in the file are untouched and still pass — badge logic wasn't changed)

- [ ] **Step 5: Commit**

```bash
git add components/stock/ProductRow.tsx components/stock/ProductRow.test.tsx
git commit -m "fix: remove price and artist/label links from ProductRow"
```

---

### Task 3: Remove price and artist/label links from the product detail page

**Files:**
- Modify: `app/(public)/stock/[id]/page.tsx`
- Test: `app/(public)/stock/[id]/detail.test.tsx`

**Interfaces:**
- Consumes: `CATALOG_INCLUDE`, `composeProductDescription`, `joinArtistNames`, `isJustIn`, `isRestock` from `lib/catalog.ts` (all unchanged). No longer imports `stockArtistHref`/`stockLabelHref`.
- Produces: same page component and route (`/stock/[id]`). No behavioral change to `generateMetadata` or the 404 branches.

- [ ] **Step 1: Update detail.test.tsx — drop the price/priceless assertion changes and the artist/label link test, add plain-text + no-price assertions**

Edit `app/(public)/stock/[id]/detail.test.tsx`:

Replace the `"links artist and label to filtered stock views"` test (lines 62-72) with:

```ts
  it("renders artist and label as plain text, not links", async () => {
    vi.mocked(db.product.findUnique).mockResolvedValue(PRODUCT as never);
    render(await call("p1"));
    expect(screen.getAllByText("Vril").length).toBeGreaterThan(0);
    expect(screen.queryByRole("link", { name: "Vril" })).toBeNull();
    expect(screen.getAllByText("Zulema Records").length).toBeGreaterThan(0);
    expect(screen.queryByRole("link", { name: "Zulema Records" })).toBeNull();
  });

  it("does not render a price", async () => {
    vi.mocked(db.product.findUnique).mockResolvedValue(PRODUCT as never);
    render(await call("p1"));
    expect(screen.queryByText(/€/)).toBeNull();
    expect(screen.queryByRole("term", { name: /price/i })).toBeNull();
  });
```

Update the structured-data test (lines 106-116) to match Task 1's removal:

```ts
  it("emits Product + MusicRecording structured data without price, with availability", async () => {
    vi.mocked(db.product.findUnique).mockResolvedValue(PRODUCT as never);
    const { container } = render(await call("p1"));
    const ld = container.querySelector('script[type="application/ld+json"]');
    expect(ld).not.toBeNull();
    const data = JSON.parse(ld?.textContent ?? "{}");
    expect(data["@type"]).toEqual(["Product", "MusicRecording"]);
    expect(data.name).toBe("Vril — Torus");
    expect(data.offers.price).toBeUndefined();
    expect(data.offers.availability).toBe("https://schema.org/InStock");
  });
```

- [ ] **Step 2: Run the tests to verify they fail**

`npx vitest run "app/(public)/stock/[id]/detail.test.tsx"`
Expected: FAIL — artist/label are still links, price still renders, `data.offers.price` is still `"24.99"`.

- [ ] **Step 3: Rewrite the page**

Edit `app/(public)/stock/[id]/page.tsx`:

Replace the import block (lines 6-17):

```tsx
import { db } from "@/lib/db";
import {
  isJustIn,
  isRestock,
  composeProductDescription,
  joinArtistNames,
  CATALOG_INCLUDE,
} from "@/lib/catalog";
import { productJsonLd } from "@/lib/structured-data";
import { serializeJsonLd } from "@/lib/json-ld";
```

Replace the `ArtistLinks` helper (lines 30-53) with a plain-text version:

```tsx
// Each linked artist joined by a plain " / " separator — shared by the
// header and the <dl> artist row below.
function ArtistNames({
  productArtists,
}: {
  productArtists: { position: number; artistId: string; artist: { name: string } }[];
}) {
  return (
    <>
      {[...productArtists]
        .sort((a, b) => a.position - b.position)
        .map((pa, i) => (
          <Fragment key={pa.artistId}>
            {i > 0 && " / "}
            {pa.artist.name}
          </Fragment>
        ))}
    </>
  );
}
```

Update the header's `<h1>` (remove `className` prop from `ArtistLinks`, rename call) and the back-link text — replace lines 93-117:

```tsx
      <Link
        href="/stock"
        className="font-mono text-xs uppercase tracking-[0.06em] text-ink-muted transition-colors duration-150 ease-out hover:text-signal"
      >
        ← Back to new arrivals
      </Link>

      <header className="space-y-2">
        <h1 className="text-balance text-2xl font-bold tracking-tight text-ink sm:text-3xl">
          <ArtistNames productArtists={product.productArtists} /> — {product.title}
          {justIn && (
            <span className="ml-2 align-middle font-mono text-[0.6875rem] font-bold uppercase tracking-[0.06em] text-signal">
              Just In
            </span>
          )}
          {restock && (
            <span className="ml-2 align-middle font-mono text-[0.6875rem] font-bold uppercase tracking-[0.06em] text-signal">
              Restock
            </span>
          )}
        </h1>
        <p className="font-mono text-sm text-ink-muted">
          {product.label.name} · {product.genre.name} · {product.productType.name}
        </p>
      </header>
```

Replace the `<dl>` Artist and Label rows (lines 129-155) with plain text, and drop the Price row entirely (lines 166-169):

```tsx
      <dl className="grid grid-cols-[8rem_1fr] border-t border-hairline text-sm">
        <dt className={`${dt} border-b border-hairline py-2`}>Artist</dt>
        <dd className="border-b border-hairline py-2 text-ink">
          <ArtistNames productArtists={product.productArtists} />
        </dd>
        <dt className={`${dt} border-b border-hairline py-2`}>Title</dt>
        <dd className="border-b border-hairline py-2 text-ink">{product.title}</dd>
        {product.catalogNumber && (
          <>
            <dt className={`${dt} border-b border-hairline py-2`}>Catalog no.</dt>
            <dd className="border-b border-hairline py-2 font-mono text-ink">
              {product.catalogNumber}
            </dd>
          </>
        )}
        <dt className={`${dt} border-b border-hairline py-2`}>Label</dt>
        <dd className="border-b border-hairline py-2 text-ink">{product.label.name}</dd>
        <dt className={`${dt} border-b border-hairline py-2`}>Genre</dt>
        <dd className="border-b border-hairline py-2 text-ink">{product.genre.name}</dd>
        <dt className={`${dt} border-b border-hairline py-2`}>Type</dt>
        <dd className="border-b border-hairline py-2 text-ink">
          {product.productType.name}
        </dd>
        <dt className={`${dt} border-b border-hairline py-2`}>Condition</dt>
        <dd className="border-b border-hairline py-2 font-mono text-ink">
          {product.condition}
        </dd>
      </dl>
```

Note: `Fragment` is already imported at the top of the file (line 1, alongside `cache`) — no new import needed for `ArtistNames`.

- [ ] **Step 4: Run the tests to verify they pass**

`npx vitest run "app/(public)/stock/[id]/detail.test.tsx"`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add "app/(public)/stock/[id]/page.tsx" "app/(public)/stock/[id]/detail.test.tsx"
git commit -m "fix: remove price and artist/label links from product detail page"
```

---

### Task 4: Remove price from home page Just In section; update stock CTA copy

**Files:**
- Modify: `app/(public)/page.tsx`
- Test: `app/(public)/page.test.tsx`

**Interfaces:**
- Consumes: `getLatestProducts`, `isJustIn`, `joinArtistNames` from `lib/catalog.ts` (unchanged).
- Produces: same `HomePage` component; `JustInRow` no longer renders price.

- [ ] **Step 1: Add a no-price test and update CTA copy assertions**

Edit `app/(public)/page.test.tsx` — add after the `"shows the Just In arrivals..."` test (after line 79):

```ts
  it("does not render a price in the Just In section", async () => {
    render(await HomePage());
    expect(screen.queryByText(/€/)).toBeNull();
  });

  it("uses New Arrivals copy for the stock CTAs", async () => {
    render(await HomePage());
    expect(screen.getByRole("link", { name: /browse new arrivals/i })).toHaveAttribute(
      "href",
      "/stock",
    );
    expect(screen.getByRole("link", { name: /new arrivals →/i })).toHaveAttribute(
      "href",
      "/stock",
    );
  });
```

- [ ] **Step 2: Run the tests to verify they fail**

`npx vitest run "app/(public)/page.test.tsx"`
Expected: FAIL — price still renders; "Browse new arrivals"/"New arrivals →" links don't exist yet (buttons still say "Browse stock"/"All stock →").

- [ ] **Step 3: Update the implementation**

Edit `app/(public)/page.tsx`:

Change the hero CTA (line 75): `Browse stock` → `Browse new arrivals`

Change the Just In section header link (line 95): `All stock →` → `New arrivals →`

Change the empty-state link text (line 101): `Browse the full stock` → `Browse new arrivals`

Remove the price span from `JustInRow` (lines 176-201) — delete the final `<span>` block:

```tsx
function JustInRow({ product }: { product: CatalogProduct }) {
  return (
    <Link
      href={`/stock/${product.id}`}
      className="group flex items-baseline justify-between gap-4 py-3"
    >
      <span className="min-w-0 flex-1">
        <span className="font-medium text-ink transition-colors duration-150 ease-out group-hover:text-signal">
          {joinArtistNames(product.productArtists)}
        </span>
        <span className="text-ink-muted"> — {product.title}</span>
        {isJustIn(product.createdAt) && (
          <span className="ml-2 font-mono text-[0.625rem] font-bold uppercase tracking-[0.06em] text-signal">
            New
          </span>
        )}
        <span className="block truncate font-mono text-xs text-ink-muted">
          {product.label.name} · {product.genre.name}
        </span>
      </span>
    </Link>
  );
}
```

- [ ] **Step 4: Run the tests to verify they pass**

`npx vitest run "app/(public)/page.test.tsx"`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add "app/(public)/page.tsx" "app/(public)/page.test.tsx"
git commit -m "fix: remove price from home Just In section, update stock CTA copy"
```

---

### Task 5: Rewrite `/stock` — New Arrivals, last 100, no filters/search/sort/pagination

**Files:**
- Modify: `app/(public)/stock/page.tsx` (full rewrite)
- Test: `app/(public)/stock/page.test.tsx` (full rewrite)

**Interfaces:**
- Consumes: `getLatestProducts` (default `limit = 100`) from `lib/catalog.ts`, `ProductRow` from `components/stock/ProductRow.tsx` (Task 2's version — plain text artist/label, no price).
- Produces: `StockPage` — a plain async server component with **no** `searchParams` prop. Still the default export of `/stock`.
- No longer imports: `db`, `catalogPageNumbers`, `getCatalogPage`, `isJustIn`, `isRestock`, `stockArtistHref`, `stockLabelHref`, `StockNav`, anything from `StockFilters`.

- [ ] **Step 1: Rewrite page.test.tsx**

```tsx
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";

vi.mock("next/link", () => ({
  default: ({ href, children }: { href: string; children: React.ReactNode }) => (
    <a href={href}>{children}</a>
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
  genre: { id: "g1", name: "Techno" },
  productType: { id: "t1", name: "LP" },
  ...over,
});

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(getLatestProducts).mockResolvedValue([product()] as never);
});

describe("/stock page", () => {
  it("renders the New Arrivals heading", async () => {
    render(await StockPage());
    expect(
      screen.getByRole("heading", { name: /new arrivals/i }),
    ).toBeInTheDocument();
  });

  it("requests the last 100 in-stock arrivals with no arguments (default limit)", async () => {
    await StockPage();
    expect(getLatestProducts).toHaveBeenCalledWith();
  });

  it("renders products from getLatestProducts", async () => {
    render(await StockPage());
    expect(screen.getByText("Vril")).toBeInTheDocument();
    expect(screen.getByText(/Torus/)).toBeInTheDocument();
    expect(screen.getByText(/Zulema Records/)).toBeInTheDocument();
  });

  it("shows the RESTOCK badge when a product is a restock", async () => {
    vi.mocked(getLatestProducts).mockResolvedValue([
      product({
        createdAt: new Date("2026-06-01T10:00:00Z"),
        updatedAt: new Date("2026-07-10T10:00:00Z"),
        quantity: 2,
      }),
    ] as never);
    render(await StockPage());
    expect(screen.getByText(/restock/i)).toBeInTheDocument();
  });

  it("shows the JUST IN badge for a recently created product", async () => {
    vi.mocked(getLatestProducts).mockResolvedValue([
      product({ createdAt: new Date() }),
    ] as never);
    render(await StockPage());
    expect(screen.getByText(/just in/i)).toBeInTheDocument();
  });

  it("renders no filter sidebar, search box, sort controls, or pagination", async () => {
    render(await StockPage());
    expect(screen.queryByRole("searchbox")).toBeNull();
    expect(screen.queryByRole("heading", { name: /^genre$/i })).toBeNull();
    expect(screen.queryByRole("heading", { name: /^condition$/i })).toBeNull();
    expect(screen.queryByText(/sort:/i)).toBeNull();
    expect(screen.queryByText(/grid view/i)).toBeNull();
    expect(screen.queryByText(/list view/i)).toBeNull();
    expect(screen.queryByRole("navigation", { name: /pagination/i })).toBeNull();
    expect(screen.queryByRole("navigation", { name: /stock sections/i })).toBeNull();
  });

  it("does not render a price or artist/label links", async () => {
    render(await StockPage());
    expect(screen.queryByText(/€/)).toBeNull();
    expect(screen.queryByRole("link", { name: "Vril" })).toBeNull();
    expect(screen.queryByRole("link", { name: "Zulema Records" })).toBeNull();
  });

  it("renders each product's title as a link to its detail page", async () => {
    render(await StockPage());
    expect(screen.getByRole("link", { name: /Torus/ })).toHaveAttribute(
      "href",
      "/stock/p1",
    );
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

`npx vitest run "app/(public)/stock/page.test.tsx"`
Expected: FAIL — current page still requires `searchParams`, renders `StockNav`/filters/pagination, calls `getCatalogPage` not `getLatestProducts`.

- [ ] **Step 3: Rewrite page.tsx**

```tsx
import type { Metadata } from "next";

import { getLatestProducts } from "@/lib/catalog";
import { ProductRow } from "@/components/stock/ProductRow";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "New Arrivals" };

export default async function StockPage() {
  const products = await getLatestProducts();

  return (
    <div className="space-y-8">
      <h1 className="text-3xl font-bold leading-[0.95] tracking-tight text-ink sm:text-4xl">
        New Arrivals
      </h1>

      {products.length === 0 ? (
        <p className="border border-hairline p-8 text-center font-mono text-sm text-ink-muted">
          Nothing here yet.
        </p>
      ) : (
        <ul className="divide-y divide-hairline border-t border-hairline">
          {products.map((product) => (
            <li key={product.id}>
              <ProductRow product={product} />
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
```

- [ ] **Step 4: Run the test to verify it passes**

`npx vitest run "app/(public)/stock/page.test.tsx"`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add "app/(public)/stock/page.tsx" "app/(public)/stock/page.test.tsx"
git commit -m "feat: simplify /stock to New Arrivals — last 100, no filters/search/pagination"
```

---

### Task 6: Strip price from the RSS feed; switch `/stock/feed.xml` to the last 100

**Files:**
- Modify: `lib/rss.ts`, `lib/rss.test.ts`
- Modify: `app/(public)/stock/feed.xml/route.ts`, `app/(public)/stock/feed.test.ts`

**Interfaces:**
- Consumes: `getLatestProducts`, `joinArtistNames` from `lib/catalog.ts`.
- Produces: `FeedProduct` interface drops the `price` field. `productFeed()` same signature otherwise. `/stock/feed.xml`'s `GET` handler unchanged signature, now sourced from `getLatestProducts()` (100, matching the page) instead of an inline `take: 50` query.

- [ ] **Step 1: Update rss.test.ts to drop price from the fixture and description assertion**

Edit `lib/rss.test.ts`:

Remove `price: "24.99",` from the `PRODUCT` fixture (line 12).

Replace the description assertion in `"renders one <item>..."` (lines 48-50):

```ts
    expect(xml).toContain(
      "<description>Zulema Records · Techno · LP</description>",
    );
```

Replace the last test (`"formats the price to two decimals..."`, lines 89-92) — this test no longer applies since price is gone; remove it entirely.

- [ ] **Step 2: Run the test to verify it fails**

`npx vitest run lib/rss.test.ts`
Expected: FAIL (TypeScript error too — `price` still required by `FeedProduct`; description still contains `€24.99`).

- [ ] **Step 3: Update rss.ts**

Edit `lib/rss.ts` — drop `price: unknown;` from the `FeedProduct` interface (line 17), and change the description line:

```ts
      const desc = escapeXml(
        `${p.label.name} · ${p.genre.name} · ${p.productType.name}`,
      );
```

- [ ] **Step 4: Run rss.test.ts to verify it passes**

`npx vitest run lib/rss.test.ts`
Expected: PASS

- [ ] **Step 5: Update feed.test.ts (write failing test first)**

Replace `app/(public)/stock/feed.test.ts` entirely:

```ts
// @vitest-environment node
import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@/lib/catalog", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/catalog")>();
  return { ...actual, getLatestProducts: vi.fn() };
});

import { GET } from "@/app/(public)/stock/feed.xml/route";
import { getLatestProducts } from "@/lib/catalog";

const PRODUCT = {
  id: "p1",
  productArtists: [
    { position: 0, artistId: "a1", artist: { id: "a1", name: "Vril" } },
  ],
  title: "Torus",
  createdAt: new Date("2026-07-01T00:00:00Z"),
  label: { name: "Zulema Records" },
  genre: { name: "Techno" },
  productType: { name: "LP" },
};

describe("/stock/feed.xml", () => {
  beforeEach(() => vi.clearAllMocks());

  it("returns an RSS document of the last 100 in-stock arrivals, no price", async () => {
    vi.mocked(getLatestProducts).mockResolvedValue([PRODUCT] as never);

    const res = await GET();
    const body = await res.text();

    expect(res.status).toBe(200);
    expect(res.headers.get("content-type")).toMatch(/xml/);
    expect(body).toContain("<rss");
    expect(body).toContain("Vril — Torus");
    expect(body).toContain("/stock/p1");
    expect(body).toContain("Zulema Records");
    expect(body).not.toContain("€");

    // getLatestProducts() with no args uses its default limit of 100 —
    // mirrors the /stock page exactly.
    expect(getLatestProducts).toHaveBeenCalledWith();
  });

  it("escapes XML-special characters", async () => {
    vi.mocked(getLatestProducts).mockResolvedValue([
      { ...PRODUCT, title: "Rock & Roll <mix>" },
    ] as never);

    const body = await (await GET()).text();
    expect(body).toContain("Rock &amp; Roll &lt;mix&gt;");
  });
});
```

- [ ] **Step 6: Run the test to verify it fails**

`npx vitest run "app/(public)/stock/feed.xml/feed.test.ts"`
Expected: FAIL — route still queries `db.product.findMany` directly with `take: 50` and includes price via the old `PRODUCT` shape's `price` field (route not yet changed).

- [ ] **Step 7: Rewrite the route**

```ts
import { getLatestProducts, joinArtistNames } from "@/lib/catalog";
import { productFeed } from "@/lib/rss";

export const dynamic = "force-dynamic";

// RSS feed of the last 100 new arrivals (in-stock, newest first) — mirrors /stock.
export async function GET() {
  const products = await getLatestProducts();

  return productFeed({
    title: "Antenne Recordshop — New Arrivals",
    description: "Latest vinyl & tapes at Antenne Recordshop, Tilburg.",
    products: products.map((p) => ({
      ...p,
      artistDisplay: joinArtistNames(p.productArtists),
    })),
    pubDate: (p) => p.createdAt,
  });
}
```

- [ ] **Step 8: Run the test to verify it passes**

`npx vitest run "app/(public)/stock/feed.xml/feed.test.ts"`
Expected: PASS

- [ ] **Step 9: Commit**

```bash
git add lib/rss.ts lib/rss.test.ts "app/(public)/stock/feed.xml/route.ts" "app/(public)/stock/feed.test.ts"
git commit -m "fix: remove price from RSS feed, bump /stock/feed.xml to last 100"
```

---

### Task 7: Delete weekly sections, StockNav, StockFilters, and the back-in-stock feed

**Files:**
- Delete: `app/(public)/stock/this-week/page.tsx`, `app/(public)/stock/last-week/page.tsx`, `app/(public)/stock/back-in-stock/page.tsx`, `app/(public)/stock/SectionPage.tsx`, `app/(public)/stock/sections.test.tsx`
- Delete: `app/(public)/stock/back-in-stock/feed.xml/route.ts`, `app/(public)/stock/back-in-stock/feed.test.ts`
- Delete: `components/stock/StockNav.tsx`, `components/stock/StockNav.test.tsx`, `components/stock/StockFilters.tsx`

**Interfaces:**
- Consumes: nothing (this task only deletes files).
- Produces: nothing new. After this task, `getThisWeekProducts`, `getLastWeekProducts`, `getBackInStockProducts`, and every export of `StockFilters.tsx`/`StockNav.tsx` have zero remaining consumers anywhere in the codebase — this is the precondition Task 8 depends on.

- [ ] **Step 1: Confirm nothing outside the files being deleted still imports them**

```bash
grep -rln "StockNav\|StockFilters\|SectionPage\|getThisWeekProducts\|getLastWeekProducts\|getBackInStockProducts" app components lib --include="*.ts" --include="*.tsx" | grep -v -E "app/\(public\)/stock/(this-week|last-week|back-in-stock|SectionPage|sections\.test)|components/stock/Stock(Nav|Filters)|lib/catalog\.ts$"
```

Expected: no output (the only matches are the files this task is about to delete, plus `lib/catalog.ts` where they're still defined — Task 8 removes those).

- [ ] **Step 2: Delete the files**

```bash
git rm -r "app/(public)/stock/this-week" "app/(public)/stock/last-week" "app/(public)/stock/back-in-stock" "app/(public)/stock/SectionPage.tsx" "app/(public)/stock/sections.test.tsx" components/stock/StockNav.tsx components/stock/StockNav.test.tsx components/stock/StockFilters.tsx
```

- [ ] **Step 3: Run the full test suite to verify nothing else references the deleted files**

`npx vitest run`
Expected: PASS (no import errors, no failing tests — the deleted files' own tests are gone, and no surviving file imports them per Step 1's grep).

- [ ] **Step 4: Commit**

```bash
git commit -m "chore: delete weekly stock sections, StockNav, StockFilters"
```

- [ ] **Step 5: Manually verify the deleted routes 404 (Next's file-based routing — no test to write, this is framework behavior)**

Start the dev server (`npm run dev`) and confirm each of these returns 404:

```bash
curl -s -o /dev/null -w "%{http_code}\n" http://localhost:3000/stock/this-week
curl -s -o /dev/null -w "%{http_code}\n" http://localhost:3000/stock/last-week
curl -s -o /dev/null -w "%{http_code}\n" http://localhost:3000/stock/back-in-stock
curl -s -o /dev/null -w "%{http_code}\n" http://localhost:3000/stock/back-in-stock/feed.xml
```

Expected: `404` for all four. Stop the dev server after checking.

---

### Task 8: Remove dead exports from `lib/catalog.ts`

**Files:**
- Modify: `lib/catalog.ts`
- Modify: `lib/catalog.test.ts`

**Interfaces:**
- Consumes: nothing new.
- Produces: `lib/catalog.ts` no longer exports `stockArtistHref`, `stockLabelHref`, `getThisWeekProducts`, `getLastWeekProducts`, `getBackInStockProducts`, `SectionFilters`, or `BACK_IN_STOCK_DAYS`, and no longer has the internal `weekProducts`/`sectionWhere` helpers. `weekRange`, `shopMidnightUTC`, `shopClock`, `SHOP_TZ`, `shopDayRange`, `shopDateISO`, `isRestock`, `RESTOCK_EPSILON_MS` **stay** — the newsletter admin pages depend on `weekRange`/`shopDayRange`/`shopDateISO`, and `isRestock` still drives every RESTOCK badge.

- [ ] **Step 1: Remove the now-obsolete test blocks and imports from catalog.test.ts**

Edit `lib/catalog.test.ts`:

Remove `getThisWeekProducts`, `getLastWeekProducts`, `getBackInStockProducts` from the import block (lines 29-31).

Delete the three `describe` blocks that test them: `"getThisWeekProducts / getLastWeekProducts"` (lines 341-376), `"section queries — genre/condition filters"` (lines 378-429), and `"getBackInStockProducts"` (lines 431-471). Leave `"weekRange (shop-timezone Mon–Sun weeks)"` (lines 295-339), `"shopDayRange..."` (473-498), and `"shopDateISO"` (500-506) untouched — those functions stay.

- [ ] **Step 2: Run the test to verify it still passes (this is a deletion, not a new-behavior test — the suite should stay green throughout since we're removing tests for code we're about to delete)**

`npx vitest run lib/catalog.test.ts`
Expected: PASS

- [ ] **Step 3: Remove the dead exports from catalog.ts**

Edit `lib/catalog.ts`:

Delete `stockArtistHref`/`stockLabelHref` (lines 78-84).

Delete the `"——— Weekly sections..."` section (lines 256-443): `BACK_IN_STOCK_DAYS`, `SectionFilters`, `sectionWhere`, `weekProducts`, `getThisWeekProducts`, `getLastWeekProducts`, `getBackInStockProducts`. **Keep** everything above that comment through `getLatestProducts` (ends line 254), and **keep** `SHOP_TZ`, `RESTOCK_EPSILON_MS`, `SHOP_CLOCK`, `shopClock`, `shopMidnightUTC`, `weekRange`, `shopDayRange`, `SHOP_DATE`, `shopDateISO`, `isRestock` — move these out from under the deleted section if needed so they remain exported at module scope (they currently live between the deleted functions; verify each survives the edit and is still exported where it was public before).

Concretely, the surviving tail of the file after `getLatestProducts` should read (in this order, unchanged from today except the deletions above):

```ts
export const SHOP_TZ = "Europe/Amsterdam";

const RESTOCK_EPSILON_MS = 60_000;

const SHOP_CLOCK = new Intl.DateTimeFormat("en-US", {
  timeZone: SHOP_TZ,
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
  hour: "2-digit",
  minute: "2-digit",
  second: "2-digit",
  hour12: false,
});

function shopClock(at: Date) {
  const p = Object.fromEntries(
    SHOP_CLOCK.formatToParts(at).map((x) => [x.type, x.value]),
  );
  return {
    year: Number(p.year),
    month: Number(p.month),
    day: Number(p.day),
    hour: Number(p.hour) % 24,
    minute: Number(p.minute),
    second: Number(p.second),
  };
}

function shopMidnightUTC(year: number, month: number, day: number): Date {
  const target = Date.UTC(year, month - 1, day);
  let utc = target;
  for (let i = 0; i < 2; i++) {
    const c = shopClock(new Date(utc));
    const seen = Date.UTC(c.year, c.month - 1, c.day, c.hour, c.minute, c.second);
    utc -= seen - target;
  }
  return new Date(utc);
}

export function weekRange(
  offsetWeeks = 0,
  now: Date = new Date(),
): { start: Date; end: Date } {
  const c = shopClock(now);
  const dateOnly = Date.UTC(c.year, c.month - 1, c.day);
  const mondayIdx = (new Date(dateOnly).getUTCDay() + 6) % 7;
  const monday = new Date(
    dateOnly - mondayIdx * 86_400_000 + offsetWeeks * 7 * 86_400_000,
  );
  const nextMonday = new Date(monday.getTime() + 7 * 86_400_000);
  const toMidnight = (d: Date) =>
    shopMidnightUTC(d.getUTCFullYear(), d.getUTCMonth() + 1, d.getUTCDate());
  return { start: toMidnight(monday), end: toMidnight(nextMonday) };
}

const ISO_DATE = /^(\d{4})-(\d{2})-(\d{2})$/;

export function shopDayRange(
  from: string,
  to: string,
): { start: Date; end: Date } | null {
  const f = ISO_DATE.exec(from);
  const t = ISO_DATE.exec(to);
  if (!f || !t) return null;
  const start = shopMidnightUTC(Number(f[1]), Number(f[2]), Number(f[3]));
  const dayAfterTo = new Date(
    Date.UTC(Number(t[1]), Number(t[2]) - 1, Number(t[3])) + 86_400_000,
  );
  const end = shopMidnightUTC(
    dayAfterTo.getUTCFullYear(),
    dayAfterTo.getUTCMonth() + 1,
    dayAfterTo.getUTCDate(),
  );
  if (start.getTime() >= end.getTime()) return null;
  return { start, end };
}

const SHOP_DATE = new Intl.DateTimeFormat("en-CA", {
  timeZone: SHOP_TZ,
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
});

export function shopDateISO(date: Date): string {
  return SHOP_DATE.format(date);
}

export function isRestock(p: {
  createdAt: Date | string;
  updatedAt: Date | string;
  quantity: number;
}): boolean {
  return (
    p.quantity > 0 &&
    new Date(p.updatedAt).getTime() - new Date(p.createdAt).getTime() >
      RESTOCK_EPSILON_MS
  );
}
```

Keep each function's existing doc comment from the current file (they're omitted above only for brevity — carry them over verbatim).

- [ ] **Step 4: Run catalog.test.ts, then the full suite**

`npx vitest run lib/catalog.test.ts`
Expected: PASS

`npx vitest run`
Expected: PASS (confirms nothing else in the codebase referenced the deleted exports — Task 7's Step 1 grep already checked this, this is the final confirmation after the exports are actually gone)

- [ ] **Step 5: Typecheck**

`npx tsc --noEmit`
Expected: no errors

- [ ] **Step 6: Commit**

```bash
git add lib/catalog.ts lib/catalog.test.ts
git commit -m "chore: remove dead weekly-section and stock-filter-link exports from lib/catalog.ts"
```

---

### Task 9: Rename "Stock" → "New Arrivals" in nav and footer

**Files:**
- Modify: `components/layout/SiteHeader.tsx`, `components/layout/SiteHeader.test.tsx`
- Modify: `components/layout/SiteFooter.tsx`, `components/layout/SiteFooter.test.tsx`

**Interfaces:**
- Consumes: nothing new.
- Produces: no signature change — both components remain prop-less.

- [ ] **Step 1: Add/update the failing tests**

Edit `components/layout/SiteHeader.test.tsx` — add a new test:

```tsx
  it("labels the stock nav link New Arrivals", () => {
    render(<SiteHeader />);
    expect(
      screen.getByRole("link", { name: "New Arrivals" }),
    ).toHaveAttribute("href", "/stock");
  });
```

Edit `components/layout/SiteFooter.test.tsx` — update the `nav` array in `"links to the five main pages"` (line 33):

```ts
      ["New Arrivals", "/stock"],
```

- [ ] **Step 2: Run the tests to verify they fail**

`npx vitest run components/layout/SiteHeader.test.tsx components/layout/SiteFooter.test.tsx`
Expected: FAIL — both still say "Stock".

- [ ] **Step 3: Update the implementation**

Edit `components/layout/SiteHeader.tsx` line 8: `{ href: "/stock", label: "Stock" }` → `{ href: "/stock", label: "New Arrivals" }`

Edit `components/layout/SiteFooter.tsx` line 8: `{ href: "/stock", label: "Stock" }` → `{ href: "/stock", label: "New Arrivals" }`

- [ ] **Step 4: Run the tests to verify they pass**

`npx vitest run components/layout/SiteHeader.test.tsx components/layout/SiteFooter.test.tsx`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add components/layout/SiteHeader.tsx components/layout/SiteHeader.test.tsx components/layout/SiteFooter.tsx components/layout/SiteFooter.test.tsx
git commit -m "feat: rename Stock to New Arrivals in nav and footer"
```

---

### Task 10: Update sitemap.ts — drop the removed weekly-section routes

**Files:**
- Modify: `app/sitemap.ts`
- Modify: `app/sitemap.test.ts`

**Interfaces:**
- Consumes: nothing new.
- Produces: same `sitemap()` default export; `STATIC_ROUTES` has 3 fewer entries.

- [ ] **Step 1: Update the failing test**

Edit `app/sitemap.test.ts` — replace the `"includes every static public route"` test (lines 24-29):

```ts
  it("includes every static public route", async () => {
    const urls = (await sitemap()).map((e) => e.url);
    for (const path of ["", "/about", "/faq", "/visit", "/stock", "/blog", "/newsletter"]) {
      expect(urls).toContain(`${base}${path}`);
    }
  });

  it("no longer lists the removed weekly stock sections", async () => {
    const urls = (await sitemap()).map((e) => e.url);
    for (const path of ["/stock/this-week", "/stock/last-week", "/stock/back-in-stock"]) {
      expect(urls).not.toContain(`${base}${path}`);
    }
  });
```

- [ ] **Step 2: Run the test to verify it fails**

`npx vitest run app/sitemap.test.ts`
Expected: FAIL — the new "no longer lists" test fails because `STATIC_ROUTES` still includes them.

- [ ] **Step 3: Update the implementation**

Edit `app/sitemap.ts` — remove the three entries from `STATIC_ROUTES` (lines 15-17):

```ts
const STATIC_ROUTES = [
  "",
  "/about",
  "/faq",
  "/visit",
  "/stock",
  "/blog",
  "/newsletter",
];
```

- [ ] **Step 4: Run the test to verify it passes**

`npx vitest run app/sitemap.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add app/sitemap.ts app/sitemap.test.ts
git commit -m "fix: remove deleted weekly stock sections from sitemap"
```

---

### Task 11: Add `/new-arrivals` → `/stock` redirect

**Files:**
- Create: `app/(public)/new-arrivals/page.tsx`
- Create: `app/(public)/new-arrivals/redirect.test.tsx`

**Interfaces:**
- Consumes: `redirect` from `next/navigation` (same pattern already used by `app/admin/page.tsx`).
- Produces: a page component at `/new-arrivals` that calls `redirect("/stock")` and renders nothing.

- [ ] **Step 1: Write the failing test**

```tsx
import { describe, it, expect, vi } from "vitest";

vi.mock("next/navigation", () => ({
  redirect: vi.fn(() => {
    throw new Error("NEXT_REDIRECT");
  }),
}));

import NewArrivalsRedirect from "@/app/(public)/new-arrivals/page";
import { redirect } from "next/navigation";

describe("/new-arrivals", () => {
  it("redirects to /stock", () => {
    expect(() => NewArrivalsRedirect()).toThrow("NEXT_REDIRECT");
    expect(redirect).toHaveBeenCalledWith("/stock");
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

`npx vitest run "app/(public)/new-arrivals/redirect.test.tsx"`
Expected: FAIL — module `@/app/(public)/new-arrivals/page` does not exist yet.

- [ ] **Step 3: Create the page**

```tsx
import { redirect } from "next/navigation";

export default function NewArrivalsRedirect() {
  redirect("/stock");
}
```

- [ ] **Step 4: Run the test to verify it passes**

`npx vitest run "app/(public)/new-arrivals/redirect.test.tsx"`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add "app/(public)/new-arrivals/page.tsx" "app/(public)/new-arrivals/redirect.test.tsx"
git commit -m "feat: add /new-arrivals redirect to /stock"
```

---

## Close-out (after all 11 tasks)

Per `docs/instructions/branching.md`'s close-out checklist:

1. Run the full suite via the run-tests skill (not a targeted run): `scripts/run-tests.sh`
2. Run `npx eslint .` and `npx tsc --noEmit` — both clean
3. Per `CLAUDE.md`'s "When to run /code-review": this branch touches 15+ files but no auth/security/payment logic and no new API routes/contracts — it's borderline on the ">5 files" trigger. Run `/code-review` before merging (the file-count trigger alone qualifies it).
4. Visual consistency check (branching.md step 2): run the app, compare `/stock` before/after mentally isn't possible (old page is gone) — instead verify: `/stock` shows New Arrivals heading + up to 100 rows no price/links, `/stock/[id]` has no price row, home page Just In has no price, nav/footer say "New Arrivals", `/new-arrivals` redirects, the four deleted routes 404 (already checked in Task 7 Step 5).
5. Merge `feature/new-arrivals-overhaul` into `master` (fast-forward), delete the branch, push
6. Create `docs/features/NNN-new-arrivals-overhaul.md`
7. Fill in `docs/sessions/2026-08-05.md` using the session log template
8. Add a `tasks/lessons.md` row if anything unexpected came up during implementation (e.g. if the RSS-feed-price and CTA-copy gaps from the design phase turn up again elsewhere)
9. Update the test-count baseline in `tasks/todo.md` if one is tracked there
