import type { MetadataRoute } from "next";

const baseUrl = process.env.NEXTAUTH_URL ?? "http://localhost:3000";

// Static public routes. Dynamic product / post URLs get added here once those
// entities are wired to the database. (Events are admin-internal, not public.)
const routes = [
  "",
  "/about",
  "/faq",
  "/visit",
  "/stock",
  "/blog",
  "/newsletter",
];

export default function sitemap(): MetadataRoute.Sitemap {
  return routes.map((route) => ({
    url: `${baseUrl}${route}`,
    lastModified: new Date(),
  }));
}
