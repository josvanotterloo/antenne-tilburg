import { NextResponse } from "next/server";

import { requireAdmin } from "@/lib/api-auth";
import {
  normalizeReferenceName,
  findDuplicateByNormalizedName,
} from "@/lib/reference-dedupe";

// Labels, Genres and Product Types are managed lists with identical shape and
// behaviour ({ id, name } + a relation guarding deletes — Labels/Product
// Types still count a direct `products` relation, Genres count `productGenres`
// via the ProductGenre join). These factories build the route handlers so
// the three resources stay consistent instead of triplicating CRUD logic.

export interface ReferenceRecord {
  id: string;
  name: string;
}

type RouteContext = { params: Promise<{ id: string }> };

// The subset of a Prisma model delegate these handlers use.
export interface ReferenceDelegate {
  findMany(args: {
    where?: { name: { contains: string; mode: "insensitive" } };
    orderBy: { name: "asc" };
    take: number;
    include: { _count: { select: Record<string, true> } };
  }): Promise<(ReferenceRecord & { _count: Record<string, number> })[]>;
  findFirst(args: {
    where: { normalizedName: string; id?: { not: string } };
    select: { id: true };
  }): Promise<{ id: string } | null>;
  create(args: {
    data: { name: string; normalizedName: string };
  }): Promise<ReferenceRecord>;
  findUnique(args: {
    where: { id: string };
    include: { _count: { select: Record<string, true> } };
  }): Promise<(ReferenceRecord & { _count: Record<string, number> }) | null>;
  findUnique(args: {
    where: { id: string };
    select: { normalizedName: true };
  }): Promise<{ normalizedName: string } | null>;
  update(args: {
    where: { id: string };
    data: { name: string; normalizedName: string };
  }): Promise<ReferenceRecord>;
  delete(args: { where: { id: string } }): Promise<ReferenceRecord>;
}

function duplicateNameResponse(name: string) {
  return NextResponse.json(
    { error: `"${name}" already exists` },
    { status: 409 },
  );
}

function readName(body: unknown): string {
  const value = (body as { name?: unknown } | null)?.name;
  return typeof value === "string" ? value.trim() : "";
}

// Prisma unique-constraint violation (duplicate name).
function isUniqueViolation(error: unknown): boolean {
  return (error as { code?: string } | null)?.code === "P2002";
}

// Typeahead page size: enough to pick from, small enough to stay fast at
// thousands of rows.
const SEARCH_LIMIT = 20;

export type CountField = "products" | "productArtists" | "productGenres";

export function collectionHandlers(
  delegate: ReferenceDelegate,
  options: { countField?: CountField } = {},
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
    if (await findDuplicateByNormalizedName(delegate, name)) {
      return duplicateNameResponse(name);
    }
    try {
      const created = await delegate.create({
        data: { name, normalizedName: normalizeReferenceName(name) },
      });
      return NextResponse.json(created, { status: 201 });
    } catch (error) {
      if (isUniqueViolation(error)) {
        return duplicateNameResponse(name);
      }
      throw error;
    }
  }

  return { GET, POST };
}

export function itemHandlers(
  delegate: ReferenceDelegate,
  options: { countField?: CountField } = {},
) {
  const countField = options.countField ?? "products";
  async function PATCH(req: Request, ctx: RouteContext) {
    const denied = await requireAdmin();
    if (denied) return denied;
    const { id } = await ctx.params;
    const name = readName(await req.json().catch(() => null));
    if (!name) {
      return NextResponse.json({ error: "Name is required" }, { status: 400 });
    }
    const normalizedName = normalizeReferenceName(name);
    // A rename that doesn't actually change the normalized name (e.g. only
    // casing/whitespace changed, or the admin re-submitted the same name)
    // must never be blocked by another row's legacy near-duplicate — that
    // row's existence has nothing to do with this save.
    const current = await delegate.findUnique({
      where: { id },
      select: { normalizedName: true },
    });
    const nameUnchanged = current?.normalizedName === normalizedName;
    if (!nameUnchanged && (await findDuplicateByNormalizedName(delegate, name, id))) {
      return duplicateNameResponse(name);
    }
    try {
      const updated = await delegate.update({
        where: { id },
        data: { name, normalizedName },
      });
      return NextResponse.json(updated);
    } catch (error) {
      if (isUniqueViolation(error)) {
        return duplicateNameResponse(name);
      }
      throw error;
    }
  }

  async function DELETE(_req: Request, ctx: RouteContext) {
    const denied = await requireAdmin();
    if (denied) return denied;
    const { id } = await ctx.params;
    const item = await delegate.findUnique({
      where: { id },
      include: { _count: { select: { [countField]: true } } },
    });
    if (!item) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }
    const count = item._count[countField];
    if (count > 0) {
      // Server-enforced delete guard — never trust the UI to hide the button.
      return NextResponse.json(
        { error: `In use by ${count} products`, count },
        { status: 409 },
      );
    }
    await delegate.delete({ where: { id } });
    return NextResponse.json({ ok: true });
  }

  return { PATCH, DELETE };
}
