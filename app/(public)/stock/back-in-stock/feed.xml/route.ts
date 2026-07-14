import { getBackInStockProducts } from "@/lib/catalog";
import { productFeed } from "@/lib/rss";

export const dynamic = "force-dynamic";

// RSS feed of restocked products, dated by when they came back (updatedAt).
export async function GET() {
  const products = await getBackInStockProducts();
  return productFeed({
    title: "Antenne Recordshop — Back In Stock",
    description:
      "Restocked vinyl & tapes at Antenne Recordshop, Tilburg — back on the shelf in the last 30 days.",
    products,
    pubDate: (p) => p.updatedAt,
  });
}
