// @vitest-environment node
import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@/lib/db", () => ({
  db: { product: { findMany: vi.fn() } },
}));

import {
  getNewArrivals,
  groupArrivalsByGenre,
  arrivalsText,
} from "@/lib/newsletter-arrivals";
import { db } from "@/lib/db";

const OLD = new Date("2026-06-01T10:00:00Z");
const row = (over: Record<string, unknown>) => ({
  artist: "Vril",
  catalogNumber: "ZR-001",
  quantity: 1,
  createdAt: OLD,
  updatedAt: OLD,
  label: { name: "Zulema Records" },
  genre: { name: "Techno" },
  ...over,
});

describe("getNewArrivals", () => {
  beforeEach(() => vi.mocked(db.product.findMany).mockResolvedValue([] as never));

  it("queries in-stock products created in the range, grouped-ready ordering", async () => {
    const start = new Date("2026-07-12T22:00:00Z");
    const end = new Date("2026-07-15T22:00:00Z");
    await getNewArrivals({ start, end });
    expect(db.product.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { inStock: true, createdAt: { gte: start, lt: end } },
        orderBy: [{ genre: { name: "asc" } }, { artist: "asc" }],
        include: { label: true, genre: true },
      }),
    );
  });
});

describe("groupArrivalsByGenre", () => {
  it("groups by genre and sorts artists A-Z within each group", () => {
    const groups = groupArrivalsByGenre([
      row({ artist: "Vril", genre: { name: "Techno" } }),
      row({ artist: "Aleksi Perälä", genre: { name: "Techno" } }),
      row({ artist: "Mr. Fingers", genre: { name: "House" } }),
    ] as never);

    expect(groups.map((g) => g.genre)).toEqual(["House", "Techno"]);
    expect(groups[1].items.map((i) => i.artist)).toEqual([
      "Aleksi Perälä",
      "Vril",
    ]);
  });

  it("marks restocks (updated >60s after creation, stock remaining)", () => {
    const groups = groupArrivalsByGenre([
      row({ artist: "Restocked", updatedAt: new Date("2026-07-10T10:00:00Z") }),
      row({ artist: "Fresh" }),
      row({
        artist: "Sold Out",
        updatedAt: new Date("2026-07-10T10:00:00Z"),
        quantity: 0,
      }),
    ] as never);

    const byArtist = Object.fromEntries(
      groups[0].items.map((i) => [i.artist, i.restock]),
    );
    expect(byArtist).toEqual({
      Restocked: true,
      Fresh: false,
      "Sold Out": false,
    });
  });
});

describe("arrivalsText", () => {
  it("renders lowercase genre labels with indented ARTIST [label catNo] lines", () => {
    const text = arrivalsText([
      {
        genre: "House",
        items: [
          {
            artist: "Mr. Fingers",
            label: "Up Ya",
            catalogNumber: "UY-12",
            restock: false,
          },
        ],
      },
      {
        genre: "Techno",
        items: [
          {
            artist: "Jeff Mills",
            label: "SMEJ Associated Records",
            catalogNumber: "AICT 43",
            restock: false,
          },
          {
            artist: "Vril",
            label: "Zulema Records",
            catalogNumber: "ZR-001",
            restock: true,
          },
        ],
      },
    ]);

    expect(text).toBe(
      [
        "house",
        "  MR. FINGERS [Up Ya UY-12]",
        "",
        "techno",
        "  JEFF MILLS [SMEJ Associated Records AICT 43]",
        "  VRIL [Zulema Records ZR-001] *",
      ].join("\n"),
    );
  });

  it("omits a missing catalog number gracefully", () => {
    const text = arrivalsText([
      {
        genre: "Dub",
        items: [
          { artist: "King Tubby", label: "Pressure", catalogNumber: null, restock: false },
        ],
      },
    ]);
    expect(text).toContain("  KING TUBBY [Pressure]");
    expect(text).not.toContain("null");
  });

  it("returns an empty string for no arrivals", () => {
    expect(arrivalsText([])).toBe("");
  });
});
