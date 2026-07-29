import { db } from "@/lib/db";
import { isRestock, joinArtistNames } from "@/lib/catalog";

// New-arrivals data for the structured newsletter: products added in a date
// range, grouped by genre, artist A-Z, restocks flagged. The text format
// mirrors the shop's classic plain-text newsletters:
//
//   techno
//     JEFF MILLS [SMEJ Associated Records AICT 43]
//     VRIL [Zulema Records ZR-001] *

export interface ArrivalItem {
  artist: string;
  label: string;
  catalogNumber: string | null;
  restock: boolean;
}

export interface ArrivalsGroup {
  genre: string;
  items: ArrivalItem[];
}

interface ArrivalRow {
  // Sort key (position-0 artist's name) — a stable single value, unlike the
  // full joined display string, which can have multiple artists per row.
  primaryArtistName: string;
  productArtists: { position: number; artist: { name: string } }[];
  catalogNumber: string | null;
  quantity: number;
  createdAt: Date | string;
  updatedAt: Date | string;
  label: { name: string };
  genre: { name: string };
}

export async function getNewArrivals(range: {
  start: Date;
  end: Date;
}): Promise<ArrivalsGroup[]> {
  const rows = await db.product.findMany({
    where: { inStock: true, createdAt: { gte: range.start, lt: range.end } },
    orderBy: [{ genre: { name: "asc" } }, { primaryArtistName: "asc" }],
    include: {
      label: true,
      genre: true,
      productArtists: { include: { artist: true }, orderBy: { position: "asc" } },
    },
  });
  return groupArrivalsByGenre(rows);
}

// Pure: rows → genre groups (genre asc, artist A-Z within), restocks flagged.
// Sorts itself rather than trusting caller ordering — by primaryArtistName
// (a stable single key), not by the joined multi-artist display string.
export function groupArrivalsByGenre(rows: ArrivalRow[]): ArrivalsGroup[] {
  const sortedRows = [...rows].sort((a, b) =>
    a.primaryArtistName.localeCompare(b.primaryArtistName),
  );
  const byGenre = new Map<string, ArrivalItem[]>();
  for (const row of sortedRows) {
    const items = byGenre.get(row.genre.name) ?? [];
    items.push({
      artist: joinArtistNames(row.productArtists),
      label: row.label.name,
      catalogNumber: row.catalogNumber,
      restock: isRestock(row),
    });
    byGenre.set(row.genre.name, items);
  }
  return [...byGenre.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([genre, items]) => ({ genre, items }));
}

// Pure: groups → the plain-text arrivals block. Lowercase genre labels,
// two-space-indented "ARTIST [label catalogNumber]" lines, " *" on restocks,
// a blank line between groups. Missing catalog numbers are simply omitted.
export function arrivalsText(groups: ArrivalsGroup[]): string {
  return groups
    .map((group) => {
      const lines = group.items.map((item) => {
        const bracket = item.catalogNumber
          ? `${item.label} ${item.catalogNumber}`
          : item.label;
        return `  ${item.artist.toUpperCase()} [${bracket}]${item.restock ? " *" : ""}`;
      });
      return [group.genre.toLowerCase(), ...lines].join("\n");
    })
    .join("\n\n");
}
