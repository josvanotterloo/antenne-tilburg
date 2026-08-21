// One-time import of the legacy Antenne MySQL/MariaDB database (phpMyAdmin
// dump) into this app's PostgreSQL database via Prisma.
//
//   Run:  npx tsx scripts/migrate-legacy-data.ts /path/to/dump.sql [--dry-run]
//
// See docs/features/legacy-migration.md for expected row counts,
// verification steps, and every deviation from a literal 1:1 field mapping
// (multi-genre products, blank stock_txn.txn_type, the blog.picture ->
// blog_img join, etc.) — the legacy dump doesn't match the original task
// spec in several places; that doc explains each correction.
//
// Idempotent for reference data (Supplier/Genre/ProductType/Label/Artist,
// matched by name — a legacy row whose name already exists in the DB
// reuses that row's id instead of creating a duplicate) and best-effort
// for Product (matched by title+primaryArtistName+labelId+catalogNumber,
// an extension of the heuristic prisma/seed.ts already uses — see
// productDedupKey below — not a true unique key).
// ProductArtist re-runs are protected by `skipDuplicates`. StockTransaction
// has no natural dedup key at all — running this script twice against a DB
// that already has migrated data will duplicate stock history. This is a
// one-shot import, not a repeatable sync.
import { readFileSync } from "node:fs";

import { PrismaClient } from "@prisma/client";

import { extractInsertRows, type SqlValue } from "../lib/mysql-dump-parser";
import { resolveVariousArtists, VARIOUS_ARTISTS_NAME } from "../lib/resolve-artists";

const prisma = new PrismaClient();
const BATCH_SIZE = 500;
// Sentinel legacy "unknown"/"never changed" date (matches instockdate_old's
// declared DEFAULT '1900-01-01' and lastchange's DEFAULT 19001231) — not a
// real date, so it's treated as "no value" rather than parsed literally.
const LEGACY_UNSET_DATE = 19001231;

interface SkipEntry {
  table: string;
  legacyId: number | string;
  reason: string;
}

function str(v: SqlValue | undefined): string {
  if (v === null || v === undefined) return "";
  return String(v);
}

function num(v: SqlValue | undefined): number {
  if (v === null || v === undefined) return 0;
  const n = typeof v === "number" ? v : Number(v);
  return Number.isFinite(n) ? n : 0;
}

async function batched<T>(items: T[], size: number, fn: (chunk: T[]) => Promise<unknown>) {
  for (let i = 0; i < items.length; i += size) {
    await fn(items.slice(i, i + size));
  }
}

// Composite dedup key for Product idempotency (no legacy-id column exists
// to key off — see docs/features/legacy-migration.md). catalogNumber is
// included because title+artist+label alone collides heavily on generic
// titles like "untitled" across genuinely distinct catalog-numbered
// releases (verified against the dump: 377 false collisions without it,
// 53 with — the remainder look like genuine re-entries of the same
// catalog number).
function productDedupKey(p: {
  title: string;
  primaryArtistName: string;
  labelId: string;
  catalogNumber: string | null;
}): string {
  return [p.title, p.primaryArtistName, p.labelId, p.catalogNumber ?? ""].join("\u0000");
}

// YYYYMMDD integer -> Date, or null if unparseable/the "unset" sentinel.
function parseLegacyDate(n: number): Date | null {
  if (!n || n === LEGACY_UNSET_DATE) return null;
  const s = String(n);
  if (s.length !== 8) return null;
  const year = Number(s.slice(0, 4));
  const month = Number(s.slice(4, 6));
  const day = Number(s.slice(6, 8));
  if (month < 1 || month > 12 || day < 1 || day > 31) return null;
  const date = new Date(Date.UTC(year, month - 1, day));
  // Date.UTC silently rolls an invalid day (e.g. Feb 30) into the next
  // month instead of throwing — reject anything that didn't round-trip.
  if (date.getUTCFullYear() !== year || date.getUTCMonth() !== month - 1 || date.getUTCDate() !== day) {
    return null;
  }
  return date;
}

// stock_txn's separate date ('20180612') + time ('1205', HHMM) char fields.
function parseLegacyDateTime(dateStr: string, timeStr: string): Date | null {
  if (!/^\d{8}$/.test(dateStr)) return null;
  const year = Number(dateStr.slice(0, 4));
  const month = Number(dateStr.slice(4, 6));
  const day = Number(dateStr.slice(6, 8));
  const t = /^\d{1,4}$/.test(timeStr) ? timeStr.padStart(4, "0") : "0000";
  const hour = Number(t.slice(0, 2));
  const minute = Number(t.slice(2, 4));
  if (month < 1 || month > 12 || day < 1 || day > 31 || hour > 23 || minute > 59) return null;
  const date = new Date(Date.UTC(year, month - 1, day, hour, minute));
  if (date.getUTCFullYear() !== year || date.getUTCMonth() !== month - 1 || date.getUTCDate() !== day) {
    return null;
  }
  return date;
}

function slugify(title: string): string {
  const base = title
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "") // strip diacritics left by NFKD
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
  return base || "post";
}

// --- Reference tables (Supplier/Genre/ProductType/Label/Artist) ---------
// All five share the same shape: legacy `id` + a name column, unique by
// name in the new schema. A legacy row whose (normalized) name already
// exists — in the DB, or earlier in this same dump — is merged into that
// same new id rather than creating a duplicate.

interface ReferenceImportConfig {
  table: string;
  label: string;
  nameColumn: string;
  normalizeName?: (raw: string) => string;
  findExistingByName: () => Promise<{ id: string; name: string }[]>;
  createMany: (names: string[]) => Promise<unknown>;
}

interface ReferenceImportResult {
  idByLegacyId: Map<number, string>;
  nameByLegacyId: Map<number, string>;
  created: number;
  merged: number;
}

async function importReferenceTable(
  sql: string,
  cfg: ReferenceImportConfig,
  dryRun: boolean,
  skips: SkipEntry[],
): Promise<ReferenceImportResult> {
  const rows = extractInsertRows(sql, cfg.table);
  console.log(`Importing ${cfg.label}... ${rows.length} rows`);

  const existing = await cfg.findExistingByName();
  const idByName = new Map(existing.map((r) => [r.name, r.id]));

  const idByLegacyId = new Map<number, string>();
  const nameByLegacyId = new Map<number, string>();
  const pendingByName = new Map<string, number[]>(); // name -> legacy ids not yet in the DB
  let merged = 0;

  for (const row of rows) {
    const legacyId = num(row.id);
    const rawName = str(row[cfg.nameColumn]);
    const name = (cfg.normalizeName ? cfg.normalizeName(rawName) : rawName).trim();
    if (!name) {
      skips.push({ table: cfg.table, legacyId, reason: "blank name" });
      continue;
    }
    nameByLegacyId.set(legacyId, name);

    const existingId = idByName.get(name);
    if (existingId) {
      idByLegacyId.set(legacyId, existingId);
      continue;
    }
    const bucket = pendingByName.get(name);
    if (bucket) {
      merged++;
      bucket.push(legacyId);
    } else {
      pendingByName.set(name, [legacyId]);
    }
  }

  const namesToCreate = [...pendingByName.keys()];
  if (!dryRun && namesToCreate.length > 0) {
    await batched(namesToCreate, BATCH_SIZE, (chunk) => cfg.createMany(chunk));
  }

  if (!dryRun && namesToCreate.length > 0) {
    const created = await cfg.findExistingByName();
    const newIdByName = new Map(created.map((r) => [r.name, r.id]));
    for (const [name, legacyIds] of pendingByName) {
      const newId = newIdByName.get(name);
      if (!newId) {
        for (const id of legacyIds) {
          skips.push({ table: cfg.table, legacyId: id, reason: "insert did not return an id" });
        }
        continue;
      }
      for (const id of legacyIds) idByLegacyId.set(id, newId);
    }
  } else if (dryRun) {
    // No real id exists yet — a stable placeholder keeps downstream
    // dry-run counting (FK resolution) working without a live DB write.
    for (const [name, legacyIds] of pendingByName) {
      for (const id of legacyIds) idByLegacyId.set(id, `dry-run:${cfg.table}:${name}`);
    }
  }

  return { idByLegacyId, nameByLegacyId, created: namesToCreate.length, merged };
}

// --- contents (VA / supporting-artist join, no explicit order column) ---

interface ContentsEntry {
  id: number;
  artistId: number;
  prodId: number;
}

function groupContentsByProduct(sql: string): Map<number, ContentsEntry[]> {
  const rows = extractInsertRows(sql, "contents")
    .map((r) => ({ id: num(r.id), artistId: num(r.artist_id), prodId: num(r.prod_id) }))
    .sort((a, b) => a.id - b.id); // id is an auto-increment surrogate key -> insertion order

  const byProduct = new Map<number, ContentsEntry[]>();
  for (const row of rows) {
    const bucket = byProduct.get(row.prodId);
    if (bucket) bucket.push(row);
    else byProduct.set(row.prodId, [row]);
  }
  return byProduct;
}

// --- Product --------------------------------------------------------------

interface ReferenceMaps {
  supplier: Map<number, string>;
  genre: Map<number, string>;
  productType: Map<number, string>;
  label: Map<number, string>;
  artist: Map<number, string>;
  artistName: Map<number, string>;
}

interface ProductToCreate {
  legacyId: number;
  key: string;
  artistLinkIds: string[];
  data: {
    title: string;
    catalogNumber: string | null;
    price: string;
    quantity: number;
    inStock: boolean;
    condition: "NEW" | "SECONDHAND";
    description: string | null;
    coverImage: string | null;
    createdAt: Date;
    updatedAt: Date;
    labelId: string;
    genreId: string;
    productTypeId: string;
    supplierId: string | null;
    primaryArtistName: string;
    isVariousArtists: boolean;
    contents: string | null;
  };
}

interface ProductImportResult {
  productMap: Map<number, string>;
  linksByLegacyId: Map<number, string[]>;
  created: number;
  matchedExisting: number;
  multiGenreTruncated: number;
}

async function importProducts(
  sql: string,
  maps: ReferenceMaps,
  dryRun: boolean,
  skips: SkipEntry[],
): Promise<ProductImportResult> {
  const rows = extractInsertRows(sql, "product");
  console.log(`Importing products... ${rows.length} rows`);
  const contentsByProduct = groupContentsByProduct(sql);

  // VA products must link to the exact same shared "Various Artists" entity
  // the live admin UI uses (lib/resolve-artists.ts's resolveVariousArtists),
  // not individual per-track artists — ProductForm hides the artist picker
  // whenever isVariousArtists is true and parseProductInput unconditionally
  // discards client-supplied artistIds for VA saves (replacing them with
  // this same placeholder). Linking real per-track artists instead would
  // make the product look fine until an admin opens and saves it, silently
  // destroying those real links. The migrated legacy artist row literally
  // named "VARIOUS ARTISTS" (id 6, uppercased like every other artist name)
  // is a *different* row from this one — deliberately not reused.
  const vaArtist = dryRun
    ? { id: "dry-run:artist:various-artists", name: VARIOUS_ARTISTS_NAME }
    : await resolveVariousArtists(prisma.artist);

  const existing = await prisma.product.findMany({
    select: { id: true, title: true, primaryArtistName: true, labelId: true, catalogNumber: true },
  });
  const existingIdByKey = new Map(existing.map((p) => [productDedupKey(p), p.id]));

  const productMap = new Map<number, string>();
  const linksByLegacyId = new Map<number, string[]>();
  const toCreate: ProductToCreate[] = [];
  const seenKeysThisRun = new Set<string>();
  let matchedExisting = 0;
  let multiGenreTruncated = 0;

  for (const row of rows) {
    const legacyId = num(row.id);
    const title = str(row.title).trim();
    if (!title) {
      skips.push({ table: "product", legacyId, reason: "blank title" });
      continue;
    }

    const labelLegacyId = num(row.label_id);
    const labelId = maps.label.get(labelLegacyId);
    if (!labelId) {
      skips.push({ table: "product", legacyId, reason: `unresolved label ${labelLegacyId}` });
      continue;
    }

    const genreIds = str(row.genre_id)
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean);
    if (genreIds.length > 1) multiGenreTruncated++;
    const genreId = maps.genre.get(Number(genreIds[0]));
    if (!genreId) {
      skips.push({ table: "product", legacyId, reason: `unresolved genre ${genreIds[0]}` });
      continue;
    }

    const typeLegacyId = num(row.type_id);
    const productTypeId = maps.productType.get(typeLegacyId);
    if (!productTypeId) {
      skips.push({ table: "product", legacyId, reason: `unresolved product type ${typeLegacyId}` });
      continue;
    }

    const supplierLegacyId = num(row.supplier_id);
    const supplierId = supplierLegacyId ? (maps.supplier.get(supplierLegacyId) ?? null) : null;

    const contentsForProduct = contentsByProduct.get(legacyId) ?? [];
    const isVariousArtists = contentsForProduct.length >= 2;

    let resolvedLinks: { artistId: string; name: string }[];
    let primaryArtistName: string;
    let contentsText: string | null;

    if (isVariousArtists) {
      // Links to the single shared placeholder (see vaArtist above); the
      // real per-track names go into free-text `contents` instead, exactly
      // matching what the live admin UI produces for a VA save.
      resolvedLinks = [{ artistId: vaArtist.id, name: vaArtist.name }];
      primaryArtistName = vaArtist.name;
      const names = contentsForProduct
        .map((c) => maps.artistName.get(c.artistId))
        .filter((n): n is string => Boolean(n));
      contentsText = names.length > 0 ? names.join(", ") : null;
    } else {
      const candidateArtistLegacyIds =
        contentsForProduct.length > 0 ? contentsForProduct.map((c) => c.artistId) : [num(row.artist_id)];
      resolvedLinks = candidateArtistLegacyIds
        .map((aid) => ({ artistId: maps.artist.get(aid), name: maps.artistName.get(aid) }))
        .filter((l): l is { artistId: string; name: string } => Boolean(l.artistId && l.name));
      if (resolvedLinks.length === 0) {
        skips.push({ table: "product", legacyId, reason: "no resolvable artist" });
        continue;
      }
      primaryArtistName = resolvedLinks[0].name;
      contentsText = null;
    }

    const createdAt = parseLegacyDate(num(row.instockdate)) ?? parseLegacyDate(num(row.lastchange));
    if (!createdAt) {
      skips.push({ table: "product", legacyId, reason: "no resolvable date" });
      continue;
    }
    const changedAt = parseLegacyDate(num(row.lastchange));
    const updatedAt = changedAt && changedAt.getTime() >= createdAt.getTime() ? changedAt : createdAt;

    const quantity = num(row.stk_shop);
    const price = String(num(row.price));
    const condition = str(row.nsh) === "S" ? ("SECONDHAND" as const) : ("NEW" as const);
    const catalogNumber = str(row.labelcode).trim() || null;
    const coverImage = str(row.image).trim() || null;
    const description = str(row.description).trim() || null;

    const key = productDedupKey({ title, primaryArtistName, labelId, catalogNumber });
    const existingId = existingIdByKey.get(key);
    if (existingId) {
      productMap.set(legacyId, existingId);
      linksByLegacyId.set(legacyId, resolvedLinks.map((l) => l.artistId));
      matchedExisting++;
      continue;
    }
    if (seenKeysThisRun.has(key)) {
      skips.push({ table: "product", legacyId, reason: "duplicate of another row in this same dump" });
      continue;
    }
    seenKeysThisRun.add(key);

    toCreate.push({
      legacyId,
      key,
      artistLinkIds: resolvedLinks.map((l) => l.artistId),
      data: {
        title,
        catalogNumber,
        price,
        quantity,
        inStock: quantity > 0,
        condition,
        description,
        coverImage,
        createdAt,
        updatedAt,
        labelId,
        genreId,
        productTypeId,
        supplierId,
        primaryArtistName,
        isVariousArtists,
        contents: contentsText,
      },
    });
  }

  if (!dryRun && toCreate.length > 0) {
    await batched(toCreate, BATCH_SIZE, (chunk) =>
      prisma.product.createMany({ data: chunk.map((c) => c.data) }),
    );
    const inserted = await prisma.product.findMany({
      select: { id: true, title: true, primaryArtistName: true, labelId: true, catalogNumber: true },
    });
    const idByKey = new Map(inserted.map((p) => [productDedupKey(p), p.id]));
    for (const c of toCreate) {
      const id = idByKey.get(c.key);
      if (!id) {
        skips.push({ table: "product", legacyId: c.legacyId, reason: "insert did not return an id" });
        continue;
      }
      productMap.set(c.legacyId, id);
      linksByLegacyId.set(c.legacyId, c.artistLinkIds);
    }
  } else if (dryRun) {
    for (const c of toCreate) {
      productMap.set(c.legacyId, `dry-run:product:${c.legacyId}`);
      linksByLegacyId.set(c.legacyId, c.artistLinkIds);
    }
  }

  return { productMap, linksByLegacyId, created: toCreate.length, matchedExisting, multiGenreTruncated };
}

async function importProductArtists(
  linksByLegacyId: Map<number, string[]>,
  productMap: Map<number, string>,
  dryRun: boolean,
): Promise<number> {
  const data: { productId: string; artistId: string; position: number }[] = [];
  for (const [legacyId, artistIds] of linksByLegacyId) {
    const productId = productMap.get(legacyId);
    if (!productId) continue;
    artistIds.forEach((artistId, position) => data.push({ productId, artistId, position }));
  }
  console.log(`Importing product-artist links... ${data.length} rows`);
  if (!dryRun && data.length > 0) {
    await batched(data, BATCH_SIZE, (chunk) =>
      prisma.productArtist.createMany({ data: chunk, skipDuplicates: true }),
    );
  }
  return data.length;
}

// --- stock_txn --------------------------------------------------------------

async function importStockTransactions(
  sql: string,
  productMap: Map<number, string>,
  dryRun: boolean,
  skips: SkipEntry[],
): Promise<number> {
  const rows = extractInsertRows(sql, "stock_txn");
  console.log(`Importing stock transactions... ${rows.length} rows`);

  const data: { productId: string; type: "IN" | "OUT"; quantity: number; createdAt: Date }[] = [];
  for (const row of rows) {
    const legacyId = num(row.id);
    const productLegacyId = num(row.record_id);
    const productId = productMap.get(productLegacyId);
    if (!productId) {
      skips.push({ table: "stock_txn", legacyId, reason: `unresolved product ${productLegacyId}` });
      continue;
    }
    // '' has no dedicated ledger meaning in the legacy schema (an early
    // gap before the field was consistently populated) — same shape as
    // surrounding OUT rows (qty 1, realistic sale prices), so treated as
    // OUT rather than dropped or guessed as an ADJUSTMENT.
    const type = str(row.txn_type) === "IN" ? ("IN" as const) : ("OUT" as const);
    const qty = Math.abs(num(row.qty));
    // StockTransaction.quantity is the signed delta actually applied
    // (lib/stock.ts's invariant: summed chronologically, it equals
    // Product.quantity) — the legacy qty is always a positive count.
    const quantity = type === "OUT" ? -qty : qty;
    const createdAt =
      parseLegacyDateTime(str(row.date), str(row.time)) ??
      parseLegacyDate(Number(str(row.date))) ??
      null;
    if (!createdAt) {
      skips.push({ table: "stock_txn", legacyId, reason: "unparseable date" });
      continue;
    }
    data.push({ productId, type, quantity, createdAt });
  }

  if (!dryRun && data.length > 0) {
    await batched(data, BATCH_SIZE, (chunk) => prisma.stockTransaction.createMany({ data: chunk }));
  }
  return data.length;
}

// --- blog -> Post -----------------------------------------------------------

async function importPosts(sql: string, dryRun: boolean, skips: SkipEntry[]): Promise<number> {
  const blogImgRows = extractInsertRows(sql, "blog_img");
  const filenameByImgId = new Map(blogImgRows.map((r) => [num(r.id), str(r.file_name)]));

  const rows = extractInsertRows(sql, "blog");
  console.log(`Importing posts... ${rows.length} rows`);

  const existingSlugs = new Set((await prisma.post.findMany({ select: { slug: true } })).map((p) => p.slug));
  const seenThisRun = new Set<string>();

  const data: {
    title: string;
    slug: string;
    body: string;
    coverImage: string | null;
    status: "PUBLISHED" | "DRAFT";
    publishedAt: Date | null;
    createdAt: Date;
  }[] = [];

  for (const row of rows) {
    const legacyId = num(row.id);
    const title = str(row.title).trim();
    if (!title) {
      skips.push({ table: "blog", legacyId, reason: "blank title" });
      continue;
    }
    const body = str(row.content);
    const actInd = str(row.act_ind);
    const status: "PUBLISHED" | "DRAFT" = actInd === "Y" || actInd === "1" ? "PUBLISHED" : "DRAFT";
    const createdDateStr = str(row.created_date);
    const publishedAt = parseLegacyDate(Number(createdDateStr));
    if (!publishedAt) {
      // No silent "now()" fallback: that would stamp a historical post with
      // today's date and, combined with a PUBLISHED status, sort it above
      // every genuinely recent post (lib/blog.ts orders by publishedAt desc,
      // and Postgres puts NULLs first on DESC — a null here would be worse
      // still).
      skips.push({ table: "blog", legacyId, reason: "unparseable created_date" });
      continue;
    }
    const createdAt = publishedAt;

    const imgId = num(row.picture);
    const coverImage = imgId ? (filenameByImgId.get(imgId) ?? null) : null;

    // Nearly every legacy post is titled "New Arrivals" — the base slug
    // collides almost every time, so date and (if needed) legacy id are
    // appended deterministically to stay unique across runs.
    let slug = slugify(title);
    if (existingSlugs.has(slug) || seenThisRun.has(slug)) {
      slug = `${slugify(title)}-${createdDateStr || legacyId}`;
    }
    if (existingSlugs.has(slug) || seenThisRun.has(slug)) {
      slug = `${slug}-${legacyId}`;
    }
    if (existingSlugs.has(slug)) {
      skips.push({ table: "blog", legacyId, reason: "already imported (slug exists)" });
      continue;
    }
    seenThisRun.add(slug);

    data.push({
      title,
      slug,
      body,
      coverImage,
      status,
      publishedAt: status === "PUBLISHED" ? publishedAt : null,
      createdAt,
    });
  }

  if (!dryRun && data.length > 0) {
    await batched(data, BATCH_SIZE, (chunk) => prisma.post.createMany({ data: chunk }));
  }
  return data.length;
}

// --- orchestration ----------------------------------------------------------

function logSkips(skips: SkipEntry[]) {
  const byTable = new Map<string, SkipEntry[]>();
  for (const s of skips) {
    const bucket = byTable.get(s.table);
    if (bucket) bucket.push(s);
    else byTable.set(s.table, [s]);
  }
  if (byTable.size === 0) {
    console.log("Skipped: none");
    return;
  }
  console.log("Skipped rows (FK resolution failures, blank required fields, etc.):");
  for (const [table, entries] of byTable) {
    console.log(`  ${table}: ${entries.length}`);
    for (const e of entries.slice(0, 20)) {
      console.log(`    - legacy id ${e.legacyId}: ${e.reason}`);
    }
    if (entries.length > 20) console.log(`    ... and ${entries.length - 20} more`);
  }
}

async function main() {
  const start = Date.now();
  const dumpPath = process.argv[2];
  const dryRun = process.argv.includes("--dry-run");
  if (!dumpPath) {
    console.error("Usage: npx tsx scripts/migrate-legacy-data.ts /path/to/dump.sql [--dry-run]");
    process.exit(1);
  }
  if (dryRun) console.log("--- DRY RUN: no data will be written ---");

  console.log(`Reading dump: ${dumpPath}`);
  const sql = readFileSync(dumpPath, "utf8");

  const skips: SkipEntry[] = [];

  const supplier = await importReferenceTable(
    sql,
    {
      table: "supplier",
      label: "suppliers",
      nameColumn: "sup_name",
      findExistingByName: () => prisma.supplier.findMany({ select: { id: true, name: true } }),
      createMany: (names) => prisma.supplier.createMany({ data: names.map((name) => ({ name })) }),
    },
    dryRun,
    skips,
  );

  const genre = await importReferenceTable(
    sql,
    {
      table: "genre",
      label: "genres",
      nameColumn: "name",
      findExistingByName: () => prisma.genre.findMany({ select: { id: true, name: true } }),
      createMany: (names) => prisma.genre.createMany({ data: names.map((name) => ({ name })) }),
    },
    dryRun,
    skips,
  );

  const productType = await importReferenceTable(
    sql,
    {
      table: "producttype",
      label: "product types",
      nameColumn: "name",
      findExistingByName: () => prisma.productType.findMany({ select: { id: true, name: true } }),
      createMany: (names) => prisma.productType.createMany({ data: names.map((name) => ({ name })) }),
    },
    dryRun,
    skips,
  );

  const label = await importReferenceTable(
    sql,
    {
      table: "label",
      label: "labels",
      nameColumn: "name",
      findExistingByName: () => prisma.label.findMany({ select: { id: true, name: true } }),
      createMany: (names) => prisma.label.createMany({ data: names.map((name) => ({ name })) }),
    },
    dryRun,
    skips,
  );

  const artist = await importReferenceTable(
    sql,
    {
      table: "artist",
      label: "artists",
      nameColumn: "name",
      normalizeName: (raw) => raw.toUpperCase(),
      findExistingByName: () => prisma.artist.findMany({ select: { id: true, name: true } }),
      createMany: (names) => prisma.artist.createMany({ data: names.map((name) => ({ name })) }),
    },
    dryRun,
    skips,
  );

  const maps: ReferenceMaps = {
    supplier: supplier.idByLegacyId,
    genre: genre.idByLegacyId,
    productType: productType.idByLegacyId,
    label: label.idByLegacyId,
    artist: artist.idByLegacyId,
    artistName: artist.nameByLegacyId,
  };

  const products = await importProducts(sql, maps, dryRun, skips);
  const productArtistCount = await importProductArtists(products.linksByLegacyId, products.productMap, dryRun);
  const stockTxnCount = await importStockTransactions(sql, products.productMap, dryRun, skips);
  const postCount = await importPosts(sql, dryRun, skips);

  console.log("");
  console.log(
    `Imported: ${supplier.created} suppliers, ${genre.created} genres, ${productType.created} product types, ` +
      `${label.created} labels, ${artist.created} artists, ${products.created} products ` +
      `(${products.matchedExisting} matched existing), ${productArtistCount} product-artist links, ` +
      `${stockTxnCount} stock transactions, ${postCount} posts.`,
  );
  console.log(
    `Merged duplicate names: ${supplier.merged} suppliers, ${genre.merged} genres, ` +
      `${productType.merged} product types, ${label.merged} labels, ${artist.merged} artists.`,
  );
  if (products.multiGenreTruncated > 0) {
    console.log(
      `${products.multiGenreTruncated} products had more than one genre_id in the legacy dump — ` +
        `only the first was kept (see docs/features/legacy-migration.md).`,
    );
  }
  logSkips(skips);

  const seconds = ((Date.now() - start) / 1000).toFixed(1);
  console.log(`Done in ${seconds}s${dryRun ? " (dry run — nothing was written)" : ""}.`);
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
