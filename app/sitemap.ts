import type { MetadataRoute } from "next";

import { db } from "@/lib/db";
import { getPublishedPosts } from "@/lib/blog";

const baseUrl = process.env.NEXTAUTH_URL ?? "http://localhost:3000";

// Generated per request so it reflects current posts/stock. (Events are
// admin-internal, not public.)
export const dynamic = "force-dynamic";

const STATIC_ROUTES = [
  "",
  "/about",
  "/faq",
  "/visit",
  "/stock",
  "/blog",
  "/newsletter",
];

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const staticEntries = STATIC_ROUTES.map((route) => ({
    url: `${baseUrl}${route}`,
    lastModified: new Date(),
  }));

  try {
    const [posts, products] = await Promise.all([
      getPublishedPosts(),
      db.product.findMany({
        where: { inStock: true },
        select: { id: true, updatedAt: true },
        orderBy: { updatedAt: "desc" },
      }),
    ]);

    return [
      ...staticEntries,
      ...posts.map((post) => ({
        url: `${baseUrl}/blog/${post.slug}`,
        lastModified: post.updatedAt,
      })),
      ...products.map((product) => ({
        url: `${baseUrl}/stock/${product.id}`,
        lastModified: product.updatedAt,
      })),
    ];
  } catch (error) {
    // Degrade to the static routes rather than serving a 500 sitemap.
    console.error("sitemap: failed to load dynamic entries", error);
    return staticEntries;
  }
}
