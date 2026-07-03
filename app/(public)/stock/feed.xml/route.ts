import { db } from "@/lib/db";

export const dynamic = "force-dynamic";

const BASE = process.env.NEXTAUTH_URL ?? "http://localhost:3000";

function escapeXml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

// RSS feed of the last 50 new arrivals (in-stock, newest first).
export async function GET() {
  const products = await db.product.findMany({
    where: { inStock: true },
    orderBy: { createdAt: "desc" },
    take: 50,
    include: { label: true, genre: true, productType: true },
  });

  const items = products
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
      <pubDate>${new Date(p.createdAt).toUTCString()}</pubDate>
    </item>`;
    })
    .join("\n");

  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0">
  <channel>
    <title>Antenne Recordshop — New Arrivals</title>
    <link>${BASE}/stock</link>
    <description>Latest vinyl &amp; tapes at Antenne Recordshop, Tilburg.</description>
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
