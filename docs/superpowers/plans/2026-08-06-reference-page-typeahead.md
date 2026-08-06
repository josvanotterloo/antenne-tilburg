# Reference Page Typeahead Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make `/admin/catalog/reference` usable at production scale (55,295 artists, 10,484 labels, 132 product types, 90 genres) by switching each section to server-side typeahead search instead of an unbounded flat list.

**Architecture:** Reuse the existing `GET .../labels|genres|product-types|artists?q=` endpoints (already used by the product-form `Combobox`, already capped at 20 results, already alphabetical-on-empty-query). Extend their response with a per-item product count (currently missing from that endpoint) so the reference page's existing add/rename/delete UX is fully preserved. Fix the reference page's own initial server-side fetch, which currently loads every row with no limit — the same scale bug, one layer earlier. `ReferenceSection` gains a debounced search box and a locally-synced total count.

**Tech Stack:** Next.js 16 (App Router, TypeScript), React 19, Prisma, Vitest + Testing Library.

## Global Constraints

- No new API routes. Only the existing four `GET .../{resource}?q=` handlers change, and only additively (an extra `productCount` field).
- `collectionHandlers(delegate, options?)` gains an optional `{ countField?: string }`, defaulting to `"products"`. Only `artists/route.ts` passes `{ countField: "productArtists" }` — Artist's relation to Product is many-to-many via `ProductArtist`, everything else has a direct FK.
- Search results: max 20, debounced 200ms, alphabetical, empty query = first page. This is already the endpoint's behavior — no change to that contract, only to its response shape.
- `page.tsx`'s initial Prisma fetch changes from "every row" to "first 20 + a separate `count()`" per category — this is the actual fix for the stated scale problem, not just the client list.
- Total count per section is fetched once (server-side) and kept in sync client-side (+1 on add, −1 on delete, unchanged on rename) — never refetched.
- A newly-added item is only spliced into the visible list if it matches the active search query (or the query is empty); the total count always increments regardless.
- A renamed item stays visible in its current position even if the rename would no longer match the active search query.
- Never change an existing passing test to make new code pass unless the interface deliberately changed. `lib/reference-crud.test.ts` and `app/api/admin/reference-routes.test.ts` have deliberate, approved contract changes (GET now returns `productCount`) — update them; nothing else in those files changes.
- Follow `docs/instructions/branching.md`: work happens on `feature/reference-page-typeahead` (already created and checked out), commit after each task leaves tests green, never commit to `master`.

---

### Task 1: `lib/reference-crud.ts` — product count in typeahead responses

**Files:**
- Modify: `lib/reference-crud.ts`
- Modify: `lib/reference-crud.test.ts`

**Interfaces:**
- Consumes: nothing new.
- Produces: `collectionHandlers(delegate, options?: { countField?: string })` — the `GET` handler it returns now responds with `{ id, name, productCount }[]` instead of `{ id, name }[]`. Consumed by Task 2 (`artists/route.ts` passes `countField`) and indirectly by every existing caller of `labels/route.ts`, `genres/route.ts`, `product-types/route.ts` (unchanged call sites — default `countField` applies).

- [ ] **Step 1: Update the existing tests for the deliberate contract change**

Edit `lib/reference-crud.test.ts` — replace the two GET tests in `describe("collectionHandlers", ...)`:

```ts
  it("GET returns the first page ordered by name, with each item's product count", async () => {
    const { fns, delegate } = makeDelegate();
    fns.findMany.mockResolvedValue([
      { id: "1", name: "Techno", _count: { products: 3 } },
    ]);
    const { GET } = collectionHandlers(delegate);

    const res = await GET(new Request("http://test/api"));

    expect(res.status).toBe(200);
    expect(await res.json()).toEqual([{ id: "1", name: "Techno", productCount: 3 }]);
    expect(fns.findMany).toHaveBeenCalledWith({
      where: undefined,
      orderBy: { name: "asc" },
      take: 20,
      include: { _count: { select: { products: true } } },
    });
  });

  it("GET filters by ?q= case-insensitively", async () => {
    const { fns, delegate } = makeDelegate();
    fns.findMany.mockResolvedValue([
      { id: "2", name: "Tresor", _count: { products: 0 } },
    ]);
    const { GET } = collectionHandlers(delegate);

    const res = await GET(new Request("http://test/api?q=tre"));

    expect(await res.json()).toEqual([{ id: "2", name: "Tresor", productCount: 0 }]);
    expect(fns.findMany).toHaveBeenCalledWith({
      where: { name: { contains: "tre", mode: "insensitive" } },
      orderBy: { name: "asc" },
      take: 20,
      include: { _count: { select: { products: true } } },
    });
  });
```

Add a new test in the same `describe` block, after the two above:

```ts
  it("GET maps a custom countField into productCount", async () => {
    const { fns, delegate } = makeDelegate();
    fns.findMany.mockResolvedValue([
      { id: "3", name: "Vril", _count: { productArtists: 7 } },
    ]);
    const { GET } = collectionHandlers(delegate, { countField: "productArtists" });

    const res = await GET(new Request("http://test/api"));

    expect(await res.json()).toEqual([{ id: "3", name: "Vril", productCount: 7 }]);
    expect(fns.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        include: { _count: { select: { productArtists: true } } },
      }),
    );
  });
```

The `"GET returns the 401 from requireAdmin without hitting the db"` test and every test in `describe("itemHandlers", ...)` are unaffected — leave them exactly as they are.

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx vitest run lib/reference-crud.test.ts`
Expected: FAIL — `fns.findMany` isn't called with `include` yet, and the GET response doesn't have `productCount`.

- [ ] **Step 3: Update the implementation**

Edit `lib/reference-crud.ts` — replace the `ReferenceDelegate` interface's `findMany` signature:

```ts
export interface ReferenceDelegate {
  findMany(args: {
    where?: { name: { contains: string; mode: "insensitive" } };
    orderBy: { name: "asc" };
    take: number;
    include: { _count: { select: Record<string, true> } };
  }): Promise<(ReferenceRecord & { _count: Record<string, number> })[]>;
  create(args: { data: { name: string } }): Promise<ReferenceRecord>;
  findUnique(args: {
    where: { id: string };
    include: { _count: { select: { products: true } } };
  }): Promise<(ReferenceRecord & { _count: { products: number } }) | null>;
  update(args: {
    where: { id: string };
    data: { name: string };
  }): Promise<ReferenceRecord>;
  delete(args: { where: { id: string } }): Promise<ReferenceRecord>;
}
```

Replace `collectionHandlers`:

```ts
export function collectionHandlers(
  delegate: ReferenceDelegate,
  options: { countField?: string } = {},
) {
  const countField = options.countField ?? "products";

  // Typeahead search: ?q= filters by name (case-insensitive substring);
  // results are alphabetical, capped at SEARCH_LIMIT, each carrying the
  // product count for the caller's delete-guard UX. No q → first page.
  async function GET(req: Request) {
    const denied = await requireAdmin();
    if (denied) return denied;
    const q = new URL(req.url).searchParams.get("q")?.trim() ?? "";
    const rows = await delegate.findMany({
      where: q ? { name: { contains: q, mode: "insensitive" } } : undefined,
      orderBy: { name: "asc" },
      take: SEARCH_LIMIT,
      include: { _count: { select: { [countField]: true } } },
    });
    const items = rows.map((r) => ({
      id: r.id,
      name: r.name,
      productCount: r._count[countField],
    }));
    return NextResponse.json(items);
  }

  async function POST(req: Request) {
    const denied = await requireAdmin();
    if (denied) return denied;
    const name = readName(await req.json().catch(() => null));
    if (!name) {
      return NextResponse.json({ error: "Name is required" }, { status: 400 });
    }
    try {
      const created = await delegate.create({ data: { name } });
      return NextResponse.json(created, { status: 201 });
    } catch (error) {
      if (isUniqueViolation(error)) {
        return NextResponse.json(
          { error: `"${name}" already exists` },
          { status: 409 },
        );
      }
      throw error;
    }
  }

  return { GET, POST };
}
```

(`POST` is unchanged — reproduced above only so the surrounding function body is complete and unambiguous to edit.)

- [ ] **Step 4: Run the test to verify it passes**

Run: `npx vitest run lib/reference-crud.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add lib/reference-crud.ts lib/reference-crud.test.ts
git commit -m "feat: add product count to reference typeahead GET responses"
```

---

### Task 2: Artist count field + route-level tests

**Files:**
- Modify: `app/api/admin/artists/route.ts`
- Create: `app/api/admin/artists/route.test.ts`
- (`app/api/admin/reference-routes.test.ts` — already updated in Task 1, see Step 4 below)

**Interfaces:**
- Consumes: `collectionHandlers` with its new `options` param from Task 1.
- Produces: nothing new consumed by later tasks — `GET /api/admin/artists?q=` now returns `productCount` sourced from `productArtists`, same response shape as the other three resources.

- [ ] **Step 1: Update `artists/route.ts`**

```ts
import { db } from "@/lib/db";
import { collectionHandlers, type ReferenceDelegate } from "@/lib/reference-crud";

// GET (typeahead) and POST (create) never touch the products relation, so the
// generic factory applies unchanged even though Artist<->Product is a
// many-to-many (via ProductArtist) rather than the single-FK shape Label/
// Genre/ProductType use — countField picks the right relation so the
// typeahead's productCount reflects productArtists, not products. Rename
// (PATCH) and delete (DELETE) need bespoke handling — see ./[id]/route.ts.
export const { GET, POST } = collectionHandlers(
  db.artist as unknown as ReferenceDelegate,
  { countField: "productArtists" },
);
```

- [ ] **Step 2: Write the failing test for the new file**

```ts
// app/api/admin/artists/route.test.ts
// @vitest-environment node
import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@/lib/api-auth", () => ({
  requireAdmin: vi.fn().mockResolvedValue(null),
}));
vi.mock("@/lib/db", () => ({
  db: { artist: { findMany: vi.fn(), create: vi.fn() } },
}));

import { db } from "@/lib/db";
import { GET, POST } from "@/app/api/admin/artists/route";

describe("GET /api/admin/artists", () => {
  beforeEach(() => vi.clearAllMocks());

  it("maps the productArtists count to productCount, not products", async () => {
    vi.mocked(db.artist.findMany).mockResolvedValue([
      { id: "a1", name: "Vril", _count: { productArtists: 12 } },
    ] as never);

    const res = await GET(new Request("http://test/api"));

    expect(await res.json()).toEqual([{ id: "a1", name: "Vril", productCount: 12 }]);
    expect(db.artist.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        include: { _count: { select: { productArtists: true } } },
      }),
    );
  });

  it("caps results at 20 and orders alphabetically", async () => {
    vi.mocked(db.artist.findMany).mockResolvedValue([] as never);
    await GET(new Request("http://test/api"));
    expect(db.artist.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ orderBy: { name: "asc" }, take: 20 }),
    );
  });
});

describe("POST /api/admin/artists", () => {
  beforeEach(() => vi.clearAllMocks());

  it("creates an artist from a valid name", async () => {
    vi.mocked(db.artist.create).mockResolvedValue({ id: "a1", name: "Vril" } as never);
    const res = await POST(
      new Request("http://test/api", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ name: "Vril" }),
      }),
    );
    expect(res.status).toBe(201);
  });
});
```

- [ ] **Step 3: Run the test to verify it fails**

Run: `npx vitest run app/api/admin/artists/route.test.ts`
Expected: FAIL until Step 1's edit lands — if you do Step 1 before writing the test, run this only to confirm the test itself is meaningful (temporarily revert the `countField` option and confirm the first test fails on `productArtists: 12` vs `products` mismatch, then restore). If Step 1 is already applied, this step should PASS immediately — in that case, temporarily change `countField` to `"products"` in `artists/route.ts`, confirm the first test fails, then restore it to `"productArtists"` and confirm it passes again. Either way you must observe a real failure before the real pass.

- [x] **Step 4 (already done — moved into Task 1):** `app/api/admin/reference-routes.test.ts`'s
GET-contract tests were updated as part of Task 1's own commit (`10da3be`),
not this task. Task 1's implementer correctly caught that its interface
change broke this file too — leaving it for Task 2 would have meant Task
1's commit landed with the suite red, violating "each commit leaves the
codebase passing." Nothing left to do here; skip straight to Step 5.

- [ ] **Step 5: Run both test files to verify they pass**

Run: `npx vitest run app/api/admin/artists/route.test.ts app/api/admin/reference-routes.test.ts`
Expected: PASS

- [ ] **Step 6: Commit**

```bash
git add app/api/admin/artists/route.ts app/api/admin/artists/route.test.ts
git commit -m "feat: source artist typeahead product counts from productArtists"
```

---

### Task 3: `page.tsx` — bounded initial fetch + grand totals

**Files:**
- Modify: `app/admin/catalog/reference/page.tsx`
- Create: `app/admin/catalog/reference/page.test.tsx`

**Interfaces:**
- Consumes: nothing new from Tasks 1-2 (this page queries Prisma directly, not through the API routes).
- Produces: `ReferenceSection` gets a new required prop, `initialTotal: number` — consumed by Task 4.

- [ ] **Step 1: Write the failing test**

```tsx
// app/admin/catalog/reference/page.test.tsx
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";

vi.mock("@/lib/db", () => ({
  db: {
    label: { findMany: vi.fn(), count: vi.fn() },
    genre: { findMany: vi.fn(), count: vi.fn() },
    productType: { findMany: vi.fn(), count: vi.fn() },
    artist: { findMany: vi.fn(), count: vi.fn() },
  },
}));

import ReferenceDataPage from "@/app/admin/catalog/reference/page";
import { db } from "@/lib/db";

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(db.label.findMany).mockResolvedValue([] as never);
  vi.mocked(db.label.count).mockResolvedValue(10484 as never);
  vi.mocked(db.genre.findMany).mockResolvedValue([] as never);
  vi.mocked(db.genre.count).mockResolvedValue(90 as never);
  vi.mocked(db.productType.findMany).mockResolvedValue([] as never);
  vi.mocked(db.productType.count).mockResolvedValue(132 as never);
  vi.mocked(db.artist.findMany).mockResolvedValue([] as never);
  vi.mocked(db.artist.count).mockResolvedValue(55295 as never);
});

describe("/admin/catalog/reference", () => {
  it("fetches only the first 20 rows per category, not the whole table", async () => {
    await ReferenceDataPage();
    expect(db.label.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ take: 20 }),
    );
    expect(db.genre.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ take: 20 }),
    );
    expect(db.productType.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ take: 20 }),
    );
    expect(db.artist.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ take: 20 }),
    );
  });

  it("fetches a grand total count per category alongside the first page", async () => {
    await ReferenceDataPage();
    expect(db.label.count).toHaveBeenCalled();
    expect(db.genre.count).toHaveBeenCalled();
    expect(db.productType.count).toHaveBeenCalled();
    expect(db.artist.count).toHaveBeenCalled();
  });

  it("passes the grand totals through to each section", async () => {
    const ui = await ReferenceDataPage();
    render(ui);
    expect(screen.getByText(/10,484 labels/i)).toBeInTheDocument();
    expect(screen.getByText(/90 genres/i)).toBeInTheDocument();
    expect(screen.getByText(/132 product types/i)).toBeInTheDocument();
    expect(screen.getByText(/55,295 artists/i)).toBeInTheDocument();
  });
});
```

Note: the third test's assertions on rendered text depend on Task 4's `ReferenceSection` changes (the total-count display). Run it after Task 4 is also in place if it fails purely for that reason — but write it now, as specified, and note in your report if it can only be confirmed passing once Task 4 lands (the first two tests, which only check the Prisma call arguments, must pass on Task 3 alone).

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx vitest run app/admin/catalog/reference/page.test.tsx`
Expected: FAIL — current `page.tsx` calls `findMany` with no `take`, and never calls `count()`.

- [ ] **Step 3: Update the implementation**

Replace `app/admin/catalog/reference/page.tsx` in full:

```tsx
import { db } from "@/lib/db";

import { ReferenceSection, type ReferenceItem } from "./ReferenceSection";

// Reads live reference data; never prerender at build time.
export const dynamic = "force-dynamic";

const PAGE_SIZE = 20;

type WithCount = { id: string; name: string; _count: { products: number } };

const toItems = (rows: WithCount[]): ReferenceItem[] =>
  rows.map((r) => ({ id: r.id, name: r.name, productCount: r._count.products }));

// First page only — these tables can hold tens of thousands of rows
// (55k+ artists in production), so an unbounded findMany here would defeat
// the point of the typeahead search this page hands off to on the client.
const firstPage = {
  orderBy: { name: "asc" as const },
  take: PAGE_SIZE,
  include: { _count: { select: { products: true } } },
};

type ArtistWithCount = {
  id: string;
  name: string;
  _count: { productArtists: number };
};

// Remapped to the same { id, name, productCount } shape as the other lists
// here — ReferenceSection doesn't need to know Artist's relation is a join
// table (`productArtists`), not a direct FK count (`products`).
const toArtistItems = (rows: ArtistWithCount[]): ReferenceItem[] =>
  rows.map((r) => ({
    id: r.id,
    name: r.name,
    productCount: r._count.productArtists,
  }));

export default async function ReferenceDataPage() {
  const [
    labels,
    labelTotal,
    genres,
    genreTotal,
    productTypes,
    productTypeTotal,
    artists,
    artistTotal,
  ] = await Promise.all([
    db.label.findMany(firstPage),
    db.label.count(),
    db.genre.findMany(firstPage),
    db.genre.count(),
    db.productType.findMany(firstPage),
    db.productType.count(),
    db.artist.findMany({
      orderBy: { name: "asc" },
      take: PAGE_SIZE,
      include: { _count: { select: { productArtists: true } } },
    }),
    db.artist.count(),
  ]);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Reference data</h1>
        <p className="text-sm text-admin-ink-muted">
          Labels, genres, product types and artists used across the catalog.
        </p>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        <ReferenceSection
          title="Labels"
          endpoint="/api/admin/labels"
          initialItems={toItems(labels)}
          initialTotal={labelTotal}
        />
        <ReferenceSection
          title="Genres"
          endpoint="/api/admin/genres"
          initialItems={toItems(genres)}
          initialTotal={genreTotal}
        />
        <ReferenceSection
          title="Product Types"
          endpoint="/api/admin/product-types"
          initialItems={toItems(productTypes)}
          initialTotal={productTypeTotal}
        />
        <ReferenceSection
          title="Artists"
          endpoint="/api/admin/artists"
          initialItems={toArtistItems(artists)}
          initialTotal={artistTotal}
        />
      </div>
    </div>
  );
}
```

- [ ] **Step 4: Run the test's first two cases to verify they pass**

Run: `npx vitest run app/admin/catalog/reference/page.test.tsx`
Expected: the first two tests PASS; the third ("passes the grand totals through") may still FAIL until Task 4 adds the total-count display to `ReferenceSection` — this is expected, note it in your report rather than treating it as a blocker for this task.

- [ ] **Step 5: Commit**

```bash
git add app/admin/catalog/reference/page.tsx app/admin/catalog/reference/page.test.tsx
git commit -m "fix: bound the reference page's initial fetch to the first 20 rows per category"
```

---

### Task 4: `ReferenceSection.tsx` — search, total count, add/rename/delete adjustments

**Files:**
- Modify: `app/admin/catalog/reference/ReferenceSection.tsx`
- Create: `app/admin/catalog/reference/ReferenceSection.test.tsx`

**Interfaces:**
- Consumes: `initialTotal` prop from Task 3's `page.tsx`; the `productCount` field in `GET .../{resource}?q=` responses from Tasks 1-2.
- Produces: nothing new — this is the leaf component. After this task, `page.test.tsx`'s third test (Task 3, Step 1) should also pass — run the full reference-page test suite as this task's final check.

- [ ] **Step 1: Write the failing test file**

```tsx
// app/admin/catalog/reference/ReferenceSection.test.tsx
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen } from "@testing-library/react";
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
  let fetchMock: ReturnType<typeof mockFetch>;

  beforeEach(() => {
    fetchMock = mockFetch();
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
    await screen.findByText("House");

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
```

Note: `fetchMock` is assigned but not directly asserted on in every test above — that's fine, `beforeEach` sets it up for all tests; individual tests only inspect it if needed (none here do beyond the implicit behavior it drives).

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx vitest run app/admin/catalog/reference/ReferenceSection.test.tsx`
Expected: FAIL — no search input, no total count display, `initialTotal` prop not accepted yet.

- [ ] **Step 3: Update the implementation**

Replace `app/admin/catalog/reference/ReferenceSection.tsx` in full:

```tsx
"use client";

import { useEffect, useRef, useState } from "react";

import { apiSend } from "@/lib/api-client";
import { useAsyncAction } from "@/lib/use-async-action";

export interface ReferenceItem {
  id: string;
  name: string;
  productCount: number;
}

const SEARCH_DEBOUNCE_MS = 200;

export function ReferenceSection({
  title,
  endpoint,
  initialItems,
  initialTotal,
}: {
  title: string;
  endpoint: string;
  initialItems: ReferenceItem[];
  initialTotal: number;
}) {
  const { error, run } = useAsyncAction();
  const [items, setItems] = useState(initialItems);
  const [totalCount, setTotalCount] = useState(initialTotal);
  const [query, setQuery] = useState("");
  const [searchError, setSearchError] = useState<string | null>(null);
  const [newName, setNewName] = useState("");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState("");

  const isFirstRender = useRef(true);
  const searchSeq = useRef(0);

  // Server-side typeahead: any query change fetches matches after a
  // debounce. The very first render is skipped — initialItems already IS
  // an empty-query search, fetched server-side (see page.tsx), so refetching
  // it here on mount would just be a redundant duplicate request.
  useEffect(() => {
    if (isFirstRender.current) {
      isFirstRender.current = false;
      return;
    }
    const seq = ++searchSeq.current;
    const timer = setTimeout(async () => {
      try {
        const res = await fetch(
          `${endpoint}?q=${encodeURIComponent(query.trim())}`,
        );
        if (!res.ok) throw new Error();
        const matches = (await res.json()) as ReferenceItem[];
        if (seq === searchSeq.current) {
          setItems(matches);
          setSearchError(null);
        }
      } catch {
        if (seq === searchSeq.current) {
          setSearchError("Couldn't load results. Keep typing to retry.");
        }
      }
    }, SEARCH_DEBOUNCE_MS);
    return () => clearTimeout(timer);
  }, [query, endpoint]);

  function handleAdd(event: React.FormEvent) {
    event.preventDefault();
    const name = newName.trim();
    if (!name) return;
    run(async () => {
      const created = await apiSend<{ id: string; name: string }>(endpoint, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ name }),
      });
      setTotalCount((n) => n + 1);
      // Only shown if it matches what's currently on screen — otherwise it
      // exists (the total above already reflects that) but stays hidden
      // until the admin searches for it, same as a fresh search would show.
      const trimmedQuery = query.trim();
      const matchesQuery =
        trimmedQuery === "" ||
        created.name.toLowerCase().includes(trimmedQuery.toLowerCase());
      if (matchesQuery) {
        setItems((prev) =>
          [...prev, { ...created, productCount: 0 }].sort((a, b) =>
            a.name.localeCompare(b.name),
          ),
        );
      }
      setNewName("");
    });
  }

  function handleSaveEdit(id: string) {
    const name = editName.trim();
    if (!name) return;
    run(async () => {
      await apiSend(`${endpoint}/${id}`, {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ name }),
      });
      // Stays visible even if the rename no longer matches the active
      // search query — an admin editing an item shouldn't see it vanish
      // out from under them mid-edit.
      setItems((prev) =>
        prev
          .map((item) => (item.id === id ? { ...item, name } : item))
          .sort((a, b) => a.name.localeCompare(b.name)),
      );
      setEditingId(null);
    });
  }

  function handleDelete(id: string) {
    run(async () => {
      await apiSend(`${endpoint}/${id}`, { method: "DELETE" });
      setItems((prev) => prev.filter((item) => item.id !== id));
      setTotalCount((n) => n - 1);
    });
  }

  const label = title.toLowerCase();

  return (
    <section className="rounded border border-admin-hairline bg-admin-surface p-4">
      <div className="flex items-baseline justify-between gap-2">
        <h2 className="font-semibold">{title}</h2>
        <span className="text-xs text-admin-ink-muted">
          {totalCount.toLocaleString()} {label}
        </span>
      </div>

      <input
        type="search"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        placeholder={`Search ${label}`}
        aria-label={`Search ${label}`}
        className="mt-3 w-full rounded border border-admin-hairline px-2 py-1 text-sm"
      />

      <form onSubmit={handleAdd} className="mt-3 flex gap-2">
        <input
          value={newName}
          onChange={(e) => setNewName(e.target.value)}
          placeholder={`Add ${title.toLowerCase().replace(/s$/, "")}`}
          aria-label={`New ${title} name`}
          className="flex-1 rounded border border-admin-hairline px-2 py-1 text-sm"
        />
        <button
          type="submit"
          className="rounded bg-admin-ink transition-colors duration-150 ease-out hover:bg-signal px-3 py-1 text-sm text-admin-bg"
        >
          Add
        </button>
      </form>

      {(error || searchError) && (
        <p role="alert" className="mt-2 text-sm text-red-400">
          {error ?? searchError}
        </p>
      )}

      <ul className="mt-3 divide-y divide-admin-hairline">
        {items.map((item) => (
          <li
            key={item.id}
            className="flex items-center justify-between gap-2 py-2 text-sm"
          >
            {editingId === item.id ? (
              <>
                <input
                  value={editName}
                  onChange={(e) => setEditName(e.target.value)}
                  aria-label={`Edit ${item.name}`}
                  className="flex-1 rounded border border-admin-hairline px-2 py-1"
                />
                <button
                  type="button"
                  onClick={() => handleSaveEdit(item.id)}
                  className="text-admin-ink hover:underline"
                >
                  Save
                </button>
                <button
                  type="button"
                  onClick={() => setEditingId(null)}
                  className="text-admin-ink-muted hover:underline"
                >
                  Cancel
                </button>
              </>
            ) : (
              <>
                <span className="flex-1">{item.name}</span>
                <button
                  type="button"
                  onClick={() => {
                    setEditingId(item.id);
                    setEditName(item.name);
                  }}
                  className="text-admin-ink hover:underline"
                >
                  Edit
                </button>
                {item.productCount > 0 ? (
                  <span className="text-admin-ink-muted">
                    In use by {item.productCount} products
                  </span>
                ) : (
                  <button
                    type="button"
                    onClick={() => handleDelete(item.id)}
                    className="text-red-400 hover:underline"
                  >
                    Delete
                  </button>
                )}
              </>
            )}
          </li>
        ))}
      </ul>
    </section>
  );
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `npx vitest run app/admin/catalog/reference/ReferenceSection.test.tsx`
Expected: PASS

- [ ] **Step 5: Run the full reference-page test suite together**

Run: `npx vitest run app/admin/catalog/reference/`
Expected: PASS, including `page.test.tsx`'s third test ("passes the grand totals through to each section"), which depended on this task.

- [ ] **Step 6: Run the full suite and typecheck**

Run: `npm test` and `npx tsc --noEmit`
Expected: both clean — this is the last task in the plan.

- [ ] **Step 7: Commit**

```bash
git add app/admin/catalog/reference/ReferenceSection.tsx app/admin/catalog/reference/ReferenceSection.test.tsx
git commit -m "feat: add search, total count, and match-aware add/rename to ReferenceSection"
```

---

## Self-Review Notes (for the plan author, already applied above)

- **Spec coverage:** typeahead search/debounce/20-cap/empty-query-first-page (Task 4, reusing the unchanged endpoint contract), total count display + sync (Task 3 + Task 4), add/rename/delete preserved (Task 4), no new API routes (confirmed — only the 4 existing GET handlers extended), the actual scale bug in the SSR fetch (Task 3, found during design, not in the original request's literal text but squarely in its stated goal).
- **Placeholder scan:** none — every step has real code.
- **Type consistency:** `ReferenceItem` (with `productCount`) is the same shape threaded through `page.tsx`'s `toItems`/`toArtistItems`, the API routes' GET responses, and `ReferenceSection`'s props/state throughout — verified no divergence between the four files that touch it.
