import { getLatestProducts, joinArtistNames, joinGenreNames } from "@/lib/catalog";
import { productFeed } from "@/lib/rss";

export const dynamic = "force-dynamic";

// RSS feed of the last 100 new arrivals (in-stock, newest first) — always
// in-stock only, independent of /stock's own instock filter param.
export async function GET() {
  const products = await getLatestProducts(100, true);

  return productFeed({
    title: "Antenne Recordshop — New Arrivals",
    description: "Latest vinyl & tapes at Antenne Recordshop, Tilburg.",
    products: products.map((p) => ({
      ...p,
      artistDisplay: joinArtistNames(p.productArtists),
      genreDisplay: joinGenreNames(p.productGenres),
    })),
    pubDate: (p) => p.createdAt,
  });
}
