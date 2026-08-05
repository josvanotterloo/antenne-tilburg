# Dymo Label Printing Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let an admin print a Dymo shipping/crate label (89×36mm, part 99012) for a product directly from the admin catalog UI.

**Architecture:** A pure XML-generation function (`lib/dymo-label.ts`) builds DYMO Connect Framework XML from a `CatalogProduct`. A GET route (`/api/admin/label/[productId]`) fetches the product, guards on required fields, and either returns the XML for manual preview (`DYMO_MODE=preview`, default) or POSTs it to the local DYMO Connect web service to print (`DYMO_MODE=print`). Two admin UI touch points (edit page, catalog list) link to that route, only when the product has every field the label needs.

**Tech Stack:** Next.js 16 (App Router, TypeScript), React 19, Prisma, Vitest + Testing Library.

## Global Constraints

- Label: DYMO part **99012**, 89mm × 36mm → **5040 × 2040 twips** (landscape). Use these numbers verbatim — do not recompute from the mm↔twip ratio.
- Layout (exact twip positions — see Task 1 for the full table): row 1 artist (uppercase, bold, 16pt), row 2 title (bold, 14pt), row 3 label name (left) / `catalogNumber · productType · condition` (right, omitting a falsy `catalogNumber` with no dangling separator), row 4 genre (left) / `ANTENNE TILBURG` (center, bold) / `€ price` (right).
- Condition mapping: `NEW` → `"Nieuw"`, `SECONDHAND` → `"Tweedehands"`.
- Multiple artists: `" / "`-joined, then the whole line uppercased.
- `requireAdmin()` (`lib/api-auth.ts`) returns a 401 `NextResponse` — never a redirect. Call it first in the route handler, exactly like every other `/api/admin/*` route.
- `missingLabelFields()` gates both the API route (422 if non-empty) and both UI touch points (hide the print link/icon if non-empty). Required: at least one artist, non-blank title, non-null price, and truthy label/genre/productType.
- `DYMO_MODE` (env, default `"preview"` when unset): `"preview"` → return the XML as `text/xml` with `Content-Disposition: inline`. `"print"` → POST form-encoded (`printerName`, `labelXml`) via plain `fetch()` (no new npm dependency) to `http://localhost:41951/DYMO/DLS/Printing/PrintLabel`, using the `DYMO_PRINTER_NAME` env var as `printerName` (500 with a clear message if unset while in print mode).
- No schema changes. No changes to `components/admin/ProductForm.tsx`'s props.
- Never change an existing passing test to make new code pass — this plan only adds new test blocks to the two existing admin test files it touches (`catalog.test.tsx`, `edit-page.test.tsx`).
- Follow `docs/instructions/branching.md`: work happens on `feature/dymo-label-printing` (already created and checked out), commit after each task leaves tests green, never commit to `master`.

---

### Task 1: `lib/dymo-label.ts` — XML generation and the required-fields guard

**Files:**
- Create: `lib/dymo-label.ts`
- Test: `lib/dymo-label.test.ts`

**Interfaces:**
- Consumes: `CatalogProduct` type from `lib/catalog.ts` (already includes `label`, `genre`, `productType`, `productArtists: { position, artistId, artist: { name } }[]`, plus scalar `title`/`catalogNumber`/`condition`/`price`).
- Produces: `generateLabelXml(product: CatalogProduct): string` and `missingLabelFields(product: CatalogProduct): string[]` — both consumed by Task 2 (API route) and Tasks 3/4 (UI gating).

- [ ] **Step 1: Write the failing test file**

```ts
// lib/dymo-label.test.ts
import { describe, it, expect } from "vitest";

import { generateLabelXml, missingLabelFields } from "@/lib/dymo-label";
import type { CatalogProduct } from "@/lib/catalog";

function product(over: Record<string, unknown> = {}): CatalogProduct {
  return {
    id: "p1",
    title: "Torus",
    catalogNumber: "ZR-001",
    price: "24.99",
    condition: "NEW",
    productArtists: [
      { position: 0, artistId: "a1", artist: { id: "a1", name: "Vril" } } as never,
    ],
    label: { id: "l1", name: "Zulema Records" } as never,
    genre: { id: "g1", name: "Techno" } as never,
    productType: { id: "t1", name: "LP" } as never,
    ...over,
  } as CatalogProduct;
}

describe("generateLabelXml", () => {
  it("returns a DieCutLabel document with the artist in uppercase", () => {
    const xml = generateLabelXml(product());
    expect(xml).toContain("<DieCutLabel");
    expect(xml).toContain("VRIL");
    expect(xml).not.toContain(">Vril<");
  });

  it("joins multiple artists with \" / \", uppercased", () => {
    const xml = generateLabelXml(
      product({
        productArtists: [
          { position: 0, artistId: "a1", artist: { id: "a1", name: "Jeff Mills" } },
          { position: 1, artistId: "a2", artist: { id: "a2", name: "Surgeon" } },
        ],
      }),
    );
    expect(xml).toContain("JEFF MILLS / SURGEON");
  });

  it('renders condition NEW as "Nieuw" and SECONDHAND as "Tweedehands"', () => {
    expect(generateLabelXml(product({ condition: "NEW" }))).toContain("Nieuw");
    expect(
      generateLabelXml(product({ condition: "SECONDHAND" })),
    ).toContain("Tweedehands");
  });

  it("omits the catalog number gracefully when absent, with no dangling separator", () => {
    const xml = generateLabelXml(product({ catalogNumber: null }));
    expect(xml).toContain("LP · Nieuw");
    expect(xml).not.toContain("· LP · Nieuw"); // no leading separator either
    expect(xml).not.toContain("null");
  });

  it("includes the catalog number, format and condition together when present", () => {
    const xml = generateLabelXml(product());
    expect(xml).toContain("ZR-001 · LP · Nieuw");
  });

  it("includes the product type (format) on line 3 even without a catalog number", () => {
    const xml = generateLabelXml(product({ catalogNumber: null }));
    expect(xml).toContain("LP");
  });

  it("formats price as € XX.XX", () => {
    const xml = generateLabelXml(product({ price: "9.5" }));
    expect(xml).toContain("€ 9.50");
  });

  it("includes the label name and genre as plain text", () => {
    const xml = generateLabelXml(product());
    expect(xml).toContain("Zulema Records");
    expect(xml).toContain("Techno");
  });

  it("includes the ANTENNE TILBURG brand text", () => {
    expect(generateLabelXml(product())).toContain("ANTENNE TILBURG");
  });

  it("XML-escapes special characters in text content", () => {
    const xml = generateLabelXml(
      product({ title: 'Rock & Roll <Live>', label: { id: "l1", name: "A&B" } }),
    );
    expect(xml).toContain("Rock &amp; Roll &lt;Live&gt;");
    expect(xml).toContain("A&amp;B");
    expect(xml).not.toContain("<Live>");
  });

  it("uses the 99012 label dimensions (5040 x 2040 twips)", () => {
    const xml = generateLabelXml(product());
    expect(xml).toContain('Units="twips"');
    expect(xml).toContain("99012");
    expect(xml).toContain('Width="5040"');
    expect(xml).toContain('Height="2040"');
  });
});

describe("missingLabelFields", () => {
  it("returns an empty array for a fully-populated product", () => {
    expect(missingLabelFields(product())).toEqual([]);
  });

  it("flags a missing artist", () => {
    expect(missingLabelFields(product({ productArtists: [] }))).toContain(
      "Artist",
    );
  });

  it("flags a blank title", () => {
    expect(missingLabelFields(product({ title: "   " }))).toContain("Title");
  });

  it("flags a null price", () => {
    expect(missingLabelFields(product({ price: null }))).toContain("Price");
  });

  it("flags a missing label/genre/productType", () => {
    expect(missingLabelFields(product({ label: null }))).toContain("Label");
    expect(missingLabelFields(product({ genre: null }))).toContain("Genre");
    expect(
      missingLabelFields(product({ productType: null })),
    ).toContain("Product Type");
  });

  it("lists every missing field at once, not just the first", () => {
    const missing = missingLabelFields(
      product({ productArtists: [], price: null }),
    );
    expect(missing).toEqual(["Artist", "Price"]);
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx vitest run lib/dymo-label.test.ts`
Expected: FAIL with "Cannot find module '@/lib/dymo-label'" (or similar) — the module doesn't exist yet.

- [ ] **Step 3: Write the implementation**

```ts
// lib/dymo-label.ts
import type { CatalogProduct } from "@/lib/catalog";

// DYMO Connect Framework XML for the 89x36mm label (part 99012), built as
// plain string templates — no DYMO SDK dependency. Visual fidelity is
// checked by hand: DYMO_MODE=preview serves this XML for the admin to
// paste into DYMO Connect Desktop.

const LABEL_WIDTH_TWIPS = 5040; // 89mm
const LABEL_HEIGHT_TWIPS = 2040; // 36mm

function escapeXml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

const CONDITION_LABEL: Record<CatalogProduct["condition"], string> = {
  NEW: "Nieuw",
  SECONDHAND: "Tweedehands",
};

function joinedArtistNames(product: CatalogProduct): string {
  return [...product.productArtists]
    .sort((a, b) => a.position - b.position)
    .map((pa) => pa.artist.name)
    .join(" / ");
}

interface TextSpec {
  name: string;
  x: number;
  y: number;
  width: number;
  height: number;
  align: "Left" | "Center" | "Right";
  fontSize: number;
  bold: boolean;
  text: string;
  shrinkToFit?: boolean;
}

function textObject(spec: TextSpec): string {
  return `  <ObjectInfo>
    <TextObject>
      <Name>${spec.name}</Name>
      <ForeColor Alpha="255" Red="0" Green="0" Blue="0"/>
      <BackColor Alpha="0" Red="255" Green="255" Blue="255"/>
      <LinkedObjectName></LinkedObjectName>
      <Rotation>Rotation0</Rotation>
      <IsMirrored>False</IsMirrored>
      <IsVariable>False</IsVariable>
      <GroupID>-1</GroupID>
      <IsOutlined>False</IsOutlined>
      <HorizontalAlignment>${spec.align}</HorizontalAlignment>
      <VerticalAlignment>Middle</VerticalAlignment>
      <TextFitMode>${spec.shrinkToFit ? "ShrinkToFit" : "None"}</TextFitMode>
      <UseFullFontHeight>True</UseFullFontHeight>
      <Verticalized>False</Verticalized>
      <StyledText>
        <Element>
          <String>${escapeXml(spec.text)}</String>
          <Attributes>
            <Font Family="Helvetica" Size="${spec.fontSize}" Bold="${spec.bold ? "True" : "False"}" Italic="False" Underline="False" Strikeout="False"/>
            <ForeColor Alpha="255" Red="0" Green="0" Blue="0"/>
          </Attributes>
        </Element>
      </StyledText>
    </TextObject>
    <Bounds X="${spec.x}" Y="${spec.y}" Width="${spec.width}" Height="${spec.height}"/>
  </ObjectInfo>`;
}

// Row layout (twips), landscape 5040x2040 canvas — sums exactly:
// 60 (top margin) + 640 + 560 + 380 + 340 + 60 (bottom margin) = 2040.
export function generateLabelXml(product: CatalogProduct): string {
  const artistLine = joinedArtistNames(product).toUpperCase();
  const conditionLabel = CONDITION_LABEL[product.condition];
  const line3Right = [product.catalogNumber, product.productType.name, conditionLabel]
    .filter((v): v is string => Boolean(v))
    .join(" · ");
  const priceText = `€ ${Number(product.price).toFixed(2)}`;

  const objects = [
    textObject({
      name: "ARTIST", x: 80, y: 60, width: 4880, height: 640,
      align: "Left", fontSize: 16, bold: true, text: artistLine, shrinkToFit: true,
    }),
    textObject({
      name: "TITLE", x: 80, y: 700, width: 4880, height: 560,
      align: "Left", fontSize: 14, bold: true, text: product.title, shrinkToFit: true,
    }),
    textObject({
      name: "LABEL", x: 80, y: 1260, width: 2400, height: 380,
      align: "Left", fontSize: 9, bold: false, text: product.label.name,
    }),
    textObject({
      name: "CATINFO", x: 2560, y: 1260, width: 2400, height: 380,
      align: "Right", fontSize: 9, bold: false, text: line3Right,
    }),
    textObject({
      name: "GENRE", x: 80, y: 1640, width: 1600, height: 340,
      align: "Left", fontSize: 9, bold: false, text: product.genre.name,
    }),
    textObject({
      name: "BRAND", x: 1680, y: 1640, width: 1680, height: 340,
      align: "Center", fontSize: 9, bold: true, text: "ANTENNE TILBURG",
    }),
    textObject({
      name: "PRICE", x: 3360, y: 1640, width: 1600, height: 340,
      align: "Right", fontSize: 9, bold: false, text: priceText,
    }),
  ].join("\n");

  return `<?xml version="1.0" encoding="utf-8"?>
<DieCutLabel Version="8.0" Units="twips">
  <PaperOrientation>Landscape</PaperOrientation>
  <Id>Small99012</Id>
  <PaperName>99012</PaperName>
  <DrawCommands>
    <RoundRectangle X="0" Y="0" Width="${LABEL_WIDTH_TWIPS}" Height="${LABEL_HEIGHT_TWIPS}" Rx="270" Ry="270"/>
  </DrawCommands>
${objects}
</DieCutLabel>`;
}

interface RequiredField {
  key: string;
  present: (p: CatalogProduct) => boolean;
}

const REQUIRED_FIELDS: RequiredField[] = [
  { key: "Artist", present: (p) => p.productArtists.length > 0 },
  { key: "Title", present: (p) => p.title.trim().length > 0 },
  { key: "Price", present: (p) => p.price != null },
  { key: "Label", present: (p) => Boolean(p.label) },
  { key: "Genre", present: (p) => Boolean(p.genre) },
  { key: "Product Type", present: (p) => Boolean(p.productType) },
];

// Gates both the API route (422 if non-empty) and the two UI print
// affordances (hidden if non-empty) — see the API route and the edit/list
// pages.
export function missingLabelFields(product: CatalogProduct): string[] {
  return REQUIRED_FIELDS.filter((f) => !f.present(product)).map((f) => f.key);
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `npx vitest run lib/dymo-label.test.ts`
Expected: PASS, all tests green.

- [ ] **Step 5: Commit**

```bash
git add lib/dymo-label.ts lib/dymo-label.test.ts
git commit -m "feat: add Dymo label XML generation and required-fields guard"
```

---

### Task 2: `GET /api/admin/label/[productId]` + env vars

**Files:**
- Create: `app/api/admin/label/[productId]/route.ts`
- Test: `app/api/admin/label/[productId]/route.test.ts`
- Modify: `.env.example`, `.env.local` (append-only — do not read their existing contents, permission-denied by design; use a shell append, e.g. `grep -q '^DYMO_MODE=' .env.example || printf '...' >> .env.example`)

**Interfaces:**
- Consumes: `requireAdmin` (`lib/api-auth.ts`), `db` (`lib/db.ts`), `CATALOG_INCLUDE` (`lib/catalog.ts`), `generateLabelXml`/`missingLabelFields` (`lib/dymo-label.ts`, Task 1).
- Produces: the route other tasks link to (`/api/admin/label/${id}`) — no exports consumed by later tasks beyond the URL pattern itself.

- [ ] **Step 1: Append the env vars first (no test needed — not application code)**

```bash
grep -q '^DYMO_MODE=' .env.example || printf '\nDYMO_MODE=preview        # preview: show XML in browser | print: send to Dymo Connect\nDYMO_PRINTER_NAME=       # required when DYMO_MODE=print - exact name from Dymo Connect\n' >> .env.example
grep -q '^DYMO_MODE=' .env.local || printf '\nDYMO_MODE=preview\n' >> .env.local
```

- [ ] **Step 2: Write the failing test file**

```ts
// app/api/admin/label/[productId]/route.test.ts
// @vitest-environment node
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

vi.mock("@/lib/api-auth", () => ({
  requireAdmin: vi.fn().mockResolvedValue(null),
}));
vi.mock("@/lib/db", () => ({
  db: { product: { findUnique: vi.fn() } },
}));

import { db } from "@/lib/db";
import { requireAdmin } from "@/lib/api-auth";
import { GET } from "@/app/api/admin/label/[productId]/route";

const mockRequireAdmin = vi.mocked(requireAdmin);

const PRODUCT = {
  id: "p1",
  title: "Torus",
  catalogNumber: "ZR-001",
  price: "24.99",
  condition: "NEW",
  productArtists: [
    { position: 0, artistId: "a1", artist: { id: "a1", name: "Vril" } },
  ],
  label: { id: "l1", name: "Zulema Records" },
  genre: { id: "g1", name: "Techno" },
  productType: { id: "t1", name: "LP" },
};

const call = (id: string) =>
  GET(new Request(`http://x/api/admin/label/${id}`), {
    params: Promise.resolve({ productId: id }),
  });

const ORIGINAL_ENV = { ...process.env };

beforeEach(() => {
  vi.clearAllMocks();
  mockRequireAdmin.mockResolvedValue(null);
  process.env = { ...ORIGINAL_ENV };
  delete process.env.DYMO_MODE;
  delete process.env.DYMO_PRINTER_NAME;
});

afterEach(() => {
  process.env = { ...ORIGINAL_ENV };
  vi.unstubAllGlobals();
});

describe("GET /api/admin/label/[productId]", () => {
  it("returns 401 from requireAdmin when unauthenticated", async () => {
    mockRequireAdmin.mockResolvedValue(new Response(null, { status: 401 }) as never);
    const res = await call("p1");
    expect(res.status).toBe(401);
  });

  it("returns 404 for an unknown product", async () => {
    vi.mocked(db.product.findUnique).mockResolvedValue(null as never);
    const res = await call("missing");
    expect(res.status).toBe(404);
  });

  it("returns 422 with the missing field list for an incomplete product", async () => {
    vi.mocked(db.product.findUnique).mockResolvedValue({
      ...PRODUCT,
      productArtists: [],
    } as never);
    const res = await call("p1");
    expect(res.status).toBe(422);
    const body = await res.json();
    expect(body.fields).toContain("Artist");
  });

  it("returns text/xml with an inline disposition by default (no DYMO_MODE set)", async () => {
    vi.mocked(db.product.findUnique).mockResolvedValue(PRODUCT as never);
    const res = await call("p1");
    expect(res.status).toBe(200);
    expect(res.headers.get("content-type")).toMatch(/xml/);
    expect(res.headers.get("content-disposition")).toBe("inline");
    const body = await res.text();
    expect(body).toContain("<DieCutLabel");
  });

  it("returns text/xml explicitly in preview mode", async () => {
    process.env.DYMO_MODE = "preview";
    vi.mocked(db.product.findUnique).mockResolvedValue(PRODUCT as never);
    const res = await call("p1");
    expect(res.headers.get("content-type")).toMatch(/xml/);
  });

  it("posts to the local Dymo service in print mode and returns ok", async () => {
    process.env.DYMO_MODE = "print";
    process.env.DYMO_PRINTER_NAME = "DYMO LabelWriter 450";
    vi.mocked(db.product.findUnique).mockResolvedValue(PRODUCT as never);

    const fetchMock = vi.fn().mockResolvedValue(new Response("ok", { status: 200 }));
    vi.stubGlobal("fetch", fetchMock);

    const res = await call("p1");

    expect(fetchMock).toHaveBeenCalledWith(
      "http://localhost:41951/DYMO/DLS/Printing/PrintLabel",
      expect.objectContaining({ method: "POST" }),
    );
    const [, options] = fetchMock.mock.calls[0];
    const sentBody = options.body as URLSearchParams;
    expect(sentBody.get("printerName")).toBe("DYMO LabelWriter 450");
    expect(sentBody.get("labelXml")).toContain("<DieCutLabel");
    expect(res.status).toBe(200);
  });

  it("returns 500 with a clear message when DYMO_MODE=print and DYMO_PRINTER_NAME is unset", async () => {
    process.env.DYMO_MODE = "print";
    vi.mocked(db.product.findUnique).mockResolvedValue(PRODUCT as never);

    const res = await call("p1");

    expect(res.status).toBe(500);
    const body = await res.json();
    expect(body.error).toMatch(/DYMO_PRINTER_NAME/);
  });
});
```

- [ ] **Step 3: Run the test to verify it fails**

Run: `npx vitest run "app/api/admin/label/[productId]/route.test.ts"`
Expected: FAIL — the route module doesn't exist yet.

- [ ] **Step 4: Write the implementation**

```ts
// app/api/admin/label/[productId]/route.ts
import { NextResponse } from "next/server";

import { requireAdmin } from "@/lib/api-auth";
import { db } from "@/lib/db";
import { CATALOG_INCLUDE } from "@/lib/catalog";
import { generateLabelXml, missingLabelFields } from "@/lib/dymo-label";

type RouteContext = { params: Promise<{ productId: string }> };

const DYMO_PRINT_URL = "http://localhost:41951/DYMO/DLS/Printing/PrintLabel";

export async function GET(_req: Request, ctx: RouteContext) {
  const denied = await requireAdmin();
  if (denied) return denied;

  const { productId } = await ctx.params;
  const product = await db.product.findUnique({
    where: { id: productId },
    include: CATALOG_INCLUDE,
  });
  if (!product) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const missing = missingLabelFields(product);
  if (missing.length > 0) {
    return NextResponse.json(
      { error: "Missing required fields", fields: missing },
      { status: 422 },
    );
  }

  const xml = generateLabelXml(product);
  const mode = process.env.DYMO_MODE ?? "preview";

  if (mode === "print") {
    const printerName = process.env.DYMO_PRINTER_NAME;
    if (!printerName) {
      return NextResponse.json(
        { error: "DYMO_PRINTER_NAME is not set" },
        { status: 500 },
      );
    }
    const body = new URLSearchParams({ printerName, labelXml: xml });
    const res = await fetch(DYMO_PRINT_URL, {
      method: "POST",
      headers: { "content-type": "application/x-www-form-urlencoded" },
      body,
    });
    if (!res.ok) {
      const detail = await res.text().catch(() => "");
      return NextResponse.json(
        { error: "Dymo Connect print failed", detail },
        { status: 502 },
      );
    }
    return NextResponse.json({ ok: true });
  }

  return new Response(xml, {
    headers: {
      "content-type": "text/xml",
      "content-disposition": "inline",
    },
  });
}
```

- [ ] **Step 5: Run the test to verify it passes**

Run: `npx vitest run "app/api/admin/label/[productId]/route.test.ts"`
Expected: PASS, all tests green.

- [ ] **Step 6: Commit**

```bash
git add "app/api/admin/label/[productId]/route.ts" "app/api/admin/label/[productId]/route.test.ts" .env.example .env.local
git commit -m "feat: add GET /api/admin/label/[productId] route"
```

---

### Task 3: Edit page integration

**Files:**
- Modify: `app/admin/catalog/[id]/edit/page.tsx`
- Modify: `app/admin/catalog/[id]/edit/edit-page.test.tsx`

**Interfaces:**
- Consumes: `missingLabelFields` from `lib/dymo-label.ts` (Task 1). The page's existing `db.product.findUnique` call already uses the exact same `include` shape as `CATALOG_INCLUDE` (label/genre/productType/productArtists+artist+position) — structurally compatible with `CatalogProduct`, no query change needed.
- Produces: no new exports — this is a leaf page.

- [ ] **Step 1: Add the failing tests**

Add to `app/admin/catalog/[id]/edit/edit-page.test.tsx` (after the existing `PRODUCT` fixture, add a `productArtists` `position` field it's currently missing — required by `missingLabelFields`'s artist check, which only checks array length so the existing fixture already satisfies it; no fixture change needed):

```tsx
  it("shows a Print label link with the correct href for a complete product", async () => {
    vi.mocked(db.product.findUnique).mockResolvedValue(PRODUCT as never);
    vi.mocked(db.stockTransaction.findMany).mockResolvedValue([] as never);

    const ui = await EditProductPage({ params: Promise.resolve({ id: "p1" }) });
    render(ui);

    expect(
      screen.getByRole("link", { name: /print label/i }),
    ).toHaveAttribute("href", "/api/admin/label/p1");
  });

  it("shows a missing-fields note instead of the print link when required fields are absent", async () => {
    vi.mocked(db.product.findUnique).mockResolvedValue({
      ...PRODUCT,
      productArtists: [],
    } as never);
    vi.mocked(db.stockTransaction.findMany).mockResolvedValue([] as never);

    const ui = await EditProductPage({ params: Promise.resolve({ id: "p1" }) });
    render(ui);

    expect(screen.queryByRole("link", { name: /print label/i })).toBeNull();
    const note = screen.getByText(/print label unavailable/i);
    expect(note).toBeInTheDocument();
    expect(note).toHaveTextContent(/artist/i);
  });
```

**Note (corrected during Task 3 implementation):** the original assertion
`screen.getByText(/artist/i)` was ambiguous — `ProductForm`'s "Artists"
combobox label is still rendered alongside the missing-fields note (the
note doesn't replace the form), so a bare document-wide text query matches
both. Scoping the assertion to the note element itself (`toHaveTextContent`)
resolves it.

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx vitest run "app/admin/catalog/[id]/edit/edit-page.test.tsx"`
Expected: FAIL — no "Print label" link exists yet.

- [ ] **Step 3: Update the page**

Edit `app/admin/catalog/[id]/edit/page.tsx` — add the import and insert the print link/note between the `<h1>` and `<ProductForm>`:

```tsx
import { missingLabelFields } from "@/lib/dymo-label";
```

(Add this alongside the existing imports at the top of the file.)

Replace:

```tsx
  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold tracking-tight">Edit product</h1>
      <ProductForm
```

with:

```tsx
  const missingFields = missingLabelFields(product);

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold tracking-tight">Edit product</h1>
      {missingFields.length === 0 ? (
        <a
          href={`/api/admin/label/${product.id}`}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-block rounded border border-admin-hairline px-3 py-2 text-sm hover:bg-admin-raised"
        >
          Print label
        </a>
      ) : (
        <p className="text-sm text-admin-ink-muted">
          Print label unavailable — missing: {missingFields.join(", ")}.
        </p>
      )}
      <ProductForm
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `npx vitest run "app/admin/catalog/[id]/edit/edit-page.test.tsx"`
Expected: PASS, all tests green (including the pre-existing ones — unmodified).

- [ ] **Step 5: Commit**

```bash
git add "app/admin/catalog/[id]/edit/page.tsx" "app/admin/catalog/[id]/edit/edit-page.test.tsx"
git commit -m "feat: add Print label button to the product edit page"
```

---

### Task 4: Catalog list integration

**Files:**
- Modify: `app/admin/catalog/page.tsx`
- Modify: `app/admin/catalog/catalog.test.tsx`

**Interfaces:**
- Consumes: `missingLabelFields` from `lib/dymo-label.ts` (Task 1). `product` here is already typed `CatalogProduct` (from `getCatalogPage()`), so no cast needed.
- Produces: no new exports — leaf page.

- [ ] **Step 1: Add the failing tests**

Add to `app/admin/catalog/catalog.test.tsx` (the existing `PRODUCT` fixture already has a non-empty `productArtists`, so it qualifies as "complete" for these tests without changes):

```tsx
  it("shows a print icon link with the correct href for a complete product", async () => {
    const ui = await AdminCatalogPage({ searchParams: Promise.resolve({}) });
    render(ui);
    expect(
      screen.getByRole("link", { name: /print label/i }),
    ).toHaveAttribute("href", "/api/admin/label/p1");
  });

  it("hides the print icon for a product missing required fields", async () => {
    vi.mocked(getCatalogPage).mockResolvedValue({
      products: [{ ...PRODUCT, productArtists: [] }] as never,
      total: 1,
      page: 1,
      pageCount: 1,
    });
    const ui = await AdminCatalogPage({ searchParams: Promise.resolve({}) });
    render(ui);
    expect(screen.queryByRole("link", { name: /print label/i })).toBeNull();
  });
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx vitest run app/admin/catalog/catalog.test.tsx`
Expected: FAIL — no "Print label" link exists on the list rows yet.

- [ ] **Step 3: Update the page**

Edit `app/admin/catalog/page.tsx` — add the import:

```tsx
import { missingLabelFields } from "@/lib/dymo-label";
```

Inside the `.map((product) => ...)` row, add the print icon next to the existing action links (before or after `<SellOneButton>` — place it right before the `Edit` link):

```tsx
                <div className="flex items-center gap-3">
                  <SellOneButton id={product.id} quantity={product.quantity} />
                  {missingLabelFields(product).length === 0 && (
                    <a
                      href={`/api/admin/label/${product.id}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      aria-label="Print label"
                      title="Print label"
                      className="text-admin-ink hover:underline"
                    >
                      🖨️
                    </a>
                  )}
                  <Link
                    href={`/admin/catalog/${product.id}/edit`}
                    className="text-admin-ink hover:underline"
                  >
                    Edit
                  </Link>
                  <DeleteProductButton id={product.id} />
                </div>
```

(This replaces the existing `<div className="flex items-center gap-3">...</div>` block — only the new `{missingLabelFields...}` conditional is added between `SellOneButton` and the `Edit` link; `SellOneButton`, `Link`, and `DeleteProductButton` lines are unchanged.)

- [ ] **Step 4: Run the test to verify it passes**

Run: `npx vitest run app/admin/catalog/catalog.test.tsx`
Expected: PASS, all tests green (including the pre-existing ones — unmodified).

- [ ] **Step 5: Run the full suite and typecheck**

Run: `npm test` and `npx tsc --noEmit`
Expected: both clean — this is the last task in the plan.

- [ ] **Step 6: Commit**

```bash
git add app/admin/catalog/page.tsx app/admin/catalog/catalog.test.tsx
git commit -m "feat: add print icon to the admin catalog list rows"
```

---

## Self-Review Notes (for the plan author, already applied above)

- **Spec coverage:** rename/dimensions (Task 1), all TDD bullets from the request map to Task 1 (XML content) and Task 2 (401/content-type) and Tasks 3-4 (button/icon href) tests. Required-fields guard (Task 1 + gating in 2/3/4). Env vars (Task 2). `ProductForm.tsx` deliberately untouched.
- **Placeholder scan:** none — every step has real code.
- **Type consistency:** `missingLabelFields`/`generateLabelXml` both take `CatalogProduct` throughout; the edit page's manually-typed `db.product.findUnique` include is structurally identical to `CATALOG_INCLUDE`, verified against the current file.
