import type { MetadataRoute } from "next";

const baseUrl = process.env.NEXTAUTH_URL ?? "http://localhost:3000";

// Static public routes. Dynamic product / post / event URLs get added here once
// those entities are wired to the database.
const routes = [
  "",
  "/about",
  "/faq",
  "/visit",
  "/stock",
  "/blog",
  "/events",
  "/newsletter",
];

export default function sitemap(): MetadataRoute.Sitemap {
  return routes.map((route) => ({
    url: `${baseUrl}${route}`,
    lastModified: new Date(),
  }));
}
