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
