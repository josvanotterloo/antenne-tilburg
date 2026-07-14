// Shared RSS 2.0 rendering for the product feeds (/stock/feed.xml and
// /stock/back-in-stock/feed.xml). Pure string building — the routes supply
// the products and which timestamp dates each item.

const BASE = process.env.NEXTAUTH_URL ?? "http://localhost:3000";

export interface FeedProduct {
  id: string;
  artist: string;
  title: string;
  price: unknown;
  label: { name: string };
  genre: { name: string };
  productType: { name: string };
}

function escapeXml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

export function productFeed<T extends FeedProduct>(options: {
  title: string;
  description: string;
  products: T[];
  pubDate: (product: T) => Date | string;
}): Response {
  const items = options.products
    .map((p) => {
      const link = `${BASE}/stock/${p.id}`;
      const title = escapeXml(`${p.artist} — ${p.title}`);
      const desc = escapeXml(
        `${p.label.name} · ${p.genre.name} · ${p.productType.name} · €${Number(p.price).toFixed(2)}`,
      );
      return `    <item>
      <title>${title}</title>
      <link>${link}</link>
      <guid>${link}</guid>
      <description>${desc}</description>
      <pubDate>${new Date(options.pubDate(p)).toUTCString()}</pubDate>
    </item>`;
    })
    .join("\n");

  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0">
  <channel>
    <title>${escapeXml(options.title)}</title>
    <link>${BASE}/stock</link>
    <description>${escapeXml(options.description)}</description>
${items}
  </channel>
</rss>`;

  return new Response(xml, {
    headers: {
      "content-type": "application/rss+xml; charset=utf-8",
      "cache-control": "public, max-age=600",
    },
  });
}
