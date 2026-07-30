import { NextResponse } from "next/server";

import { requireAdmin } from "@/lib/api-auth";
import { db } from "@/lib/db";

const SEARCH_LIMIT = 20;

// Typeahead for product pickers (e.g. supply order lines). Product has no
// `name` column, so results are mapped to { id, name } with a synthesized
// display name — same { id, name } contract the reference lists use, so
// Combobox works against this route unmodified (aside from allowCreate).
export async function GET(req: Request) {
  const denied = await requireAdmin();
  if (denied) return denied;
  const q = new URL(req.url).searchParams.get("q")?.trim() ?? "";
  const products = await db.product.findMany({
    where: q
      ? {
          OR: [
            { title: { contains: q, mode: "insensitive" } },
            { primaryArtistName: { contains: q, mode: "insensitive" } },
          ],
        }
      : undefined,
    orderBy: { title: "asc" },
    take: SEARCH_LIMIT,
    select: { id: true, title: true, primaryArtistName: true },
  });
  return NextResponse.json(
    products.map((p) => ({ id: p.id, name: `${p.primaryArtistName} — ${p.title}` })),
  );
}
