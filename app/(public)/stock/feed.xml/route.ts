import { db } from "@/lib/db";
import { joinArtistNames } from "@/lib/catalog";
import { productFeed } from "@/lib/rss";

export const dynamic = "force-dynamic";

// RSS feed of the last 50 new arrivals (in-stock, newest first).
export async function GET() {
  const products = await db.product.findMany({
    where: { inStock: true },
    orderBy: { createdAt: "desc" },
    take: 50,
    include: {
      label: true,
      genre: true,
      productType: true,
      productArtists: { include: { artist: true }, orderBy: { position: "asc" } },
    },
  });

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
