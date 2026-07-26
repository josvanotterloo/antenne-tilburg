// @vitest-environment node
import { describe, it, expect } from "vitest";

import { productFeed, type FeedProduct } from "@/lib/rss";

const base = process.env.NEXTAUTH_URL ?? "http://localhost:3000";

const PRODUCT: FeedProduct = {
  id: "p1",
  artist: "Vril",
  title: "Torus",
  price: "24.99",
  label: { name: "Zulema Records" },
  genre: { name: "Techno" },
  productType: { name: "LP" },
};

async function xmlOf(products: FeedProduct[] = [PRODUCT]) {
  const res = productFeed({
    title: "New arrivals",
    description: "Latest stock",
    products,
    pubDate: () => new Date("2026-07-01T10:00:00Z"),
  });
  return { res, xml: await res.text() };
}

describe("productFeed", () => {
  it("returns RSS 2.0 with the correct content type and cache headers", async () => {
    const { res } = await xmlOf();
    expect(res.headers.get("content-type")).toBe(
      "application/rss+xml; charset=utf-8",
    );
    expect(res.headers.get("cache-control")).toBe("public, max-age=600");
  });

  it("includes the channel title and description", async () => {
    const { xml } = await xmlOf();
    expect(xml).toContain("<title>New arrivals</title>");
    expect(xml).toContain("<description>Latest stock</description>");
  });

  it("renders one <item> per product with title, link, guid, description, pubDate", async () => {
    const { xml } = await xmlOf();
    expect(xml).toContain("<title>Vril — Torus</title>");
    expect(xml).toContain(`<link>${base}/stock/p1</link>`);
    expect(xml).toContain(`<guid>${base}/stock/p1</guid>`);
    expect(xml).toContain(
      "<description>Zulema Records · Techno · LP · €24.99</description>",
    );
    expect(xml).toContain(
      `<pubDate>${new Date("2026-07-01T10:00:00Z").toUTCString()}</pubDate>`,
    );
  });

  it("renders no items for an empty product list, but keeps a valid channel", async () => {
    const { xml } = await xmlOf([]);
    expect(xml).not.toContain("<item>");
    expect(xml).toContain("<title>New arrivals</title>");
  });

  it("renders multiple items in the given order", async () => {
    const second: FeedProduct = {
      ...PRODUCT,
      id: "p2",
      artist: "Surgeon",
      title: "Basictonalvocabulary",
    };
    const { xml } = await xmlOf([PRODUCT, second]);
    const firstIdx = xml.indexOf("Vril");
    const secondIdx = xml.indexOf("Surgeon");
    expect(firstIdx).toBeGreaterThan(-1);
    expect(secondIdx).toBeGreaterThan(firstIdx);
  });

  it("escapes XML special characters in title and description text", async () => {
    const hostile: FeedProduct = {
      ...PRODUCT,
      artist: `A&B <C> "D" 'E'`,
      label: { name: `L&B <tag>` },
    };
    const { xml } = await xmlOf([hostile]);
    expect(xml).not.toContain("<C>");
    expect(xml).not.toContain(`"D"`);
    expect(xml).toContain("A&amp;B &lt;C&gt; &quot;D&quot; &apos;E&apos;");
    expect(xml).toContain("L&amp;B &lt;tag&gt;");
  });

  it("formats the price to two decimals regardless of input precision", async () => {
    const { xml } = await xmlOf([{ ...PRODUCT, price: "24.9" }]);
    expect(xml).toContain("€24.90");
  });
});
