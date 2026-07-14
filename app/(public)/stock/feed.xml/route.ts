import { db } from "@/lib/db";
import { productFeed } from "@/lib/rss";

export const dynamic = "force-dynamic";

// RSS feed of the last 50 new arrivals (in-stock, newest first).
export async function GET() {
  const products = await db.product.findMany({
    where: { inStock: true },
    orderBy: { createdAt: "desc" },
    take: 50,
    include: { label: true, genre: true, productType: true },
  });

  return productFeed({
    title: "Antenne Recordshop — New Arrivals",
    description: "Latest vinyl & tapes at Antenne Recordshop, Tilburg.",
    products,
    pubDate: (p) => p.createdAt,
  });
}
