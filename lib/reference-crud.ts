import { NextResponse } from "next/server";

import { requireAdmin } from "@/lib/api-auth";

// Labels, Genres and Product Types are managed lists with identical shape and
// behaviour ({ id, name } + a products relation guarding deletes). These
// factories build the route handlers so the three resources stay consistent
// instead of triplicating CRUD logic.

export interface ReferenceRecord {
  id: string;
  name: string;
}

type RouteContext = { params: Promise<{ id: string }> };

// The subset of a Prisma model delegate these handlers use.
export interface ReferenceDelegate {
  findMany(args: { orderBy: { name: "asc" } }): Promise<ReferenceRecord[]>;
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

function readName(body: unknown): string {
  const value = (body as { name?: unknown } | null)?.name;
  return typeof value === "string" ? value.trim() : "";
}

// Prisma unique-constraint violation (duplicate name).
function isUniqueViolation(error: unknown): boolean {
  return (error as { code?: string } | null)?.code === "P2002";
}

export function collectionHandlers(delegate: ReferenceDelegate) {
  async function GET() {
    const denied = await requireAdmin();
    if (denied) return denied;
    const items = await delegate.findMany({ orderBy: { name: "asc" } });
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

export function itemHandlers(delegate: ReferenceDelegate) {
  async function PATCH(req: Request, ctx: RouteContext) {
    const denied = await requireAdmin();
    if (denied) return denied;
    const { id } = await ctx.params;
    const name = readName(await req.json().catch(() => null));
    if (!name) {
      return NextResponse.json({ error: "Name is required" }, { status: 400 });
    }
    try {
      const updated = await delegate.update({ where: { id }, data: { name } });
      return NextResponse.json(updated);
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

  async function DELETE(_req: Request, ctx: RouteContext) {
    const denied = await requireAdmin();
    if (denied) return denied;
    const { id } = await ctx.params;
    const item = await delegate.findUnique({
      where: { id },
      include: { _count: { select: { products: true } } },
    });
    if (!item) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }
    if (item._count.products > 0) {
      // Server-enforced delete guard — never trust the UI to hide the button.
      return NextResponse.json(
        {
          error: `In use by ${item._count.products} products`,
          count: item._count.products,
        },
        { status: 409 },
      );
    }
    await delegate.delete({ where: { id } });
    return NextResponse.json({ ok: true });
  }

  return { PATCH, DELETE };
}
