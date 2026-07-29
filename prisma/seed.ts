import { PrismaClient, Condition, PostStatus } from "@prisma/client";
import { hash } from "bcrypt";

import { resolveAdminSeedUsers } from "../lib/seed-users";

const prisma = new PrismaClient();

const SALT_ROUNDS = 12;

const LABELS = [
  "Vinyl Fanatiks",
  "Up Ya",
  "Dirty Carpets",
  "Zulema Records",
  "Warp Records",
];

const GENRES = [
  "Techno",
  "Electro",
  "House",
  "Ambient",
  "Electronics",
  "Jungle",
  "Drum & Bass",
  "Experimental",
];

const PRODUCT_TYPES = ["LP", "2LP", '10"', '12"', '2x12"', '7"', "Tape"];

// dayOfWeek: 0 = Sunday ... 6 = Saturday. Times are "HH:MM"; ignored when closed.
const OPENING_HOURS = [
  { dayOfWeek: 0, opensAt: "12:00", closesAt: "18:00", closed: true }, // Sunday
  { dayOfWeek: 1, opensAt: "12:00", closesAt: "18:00", closed: true }, // Monday
  { dayOfWeek: 2, opensAt: "12:00", closesAt: "18:00", closed: false }, // Tuesday
  { dayOfWeek: 3, opensAt: "12:00", closesAt: "18:00", closed: false }, // Wednesday
  { dayOfWeek: 4, opensAt: "12:00", closesAt: "18:00", closed: false }, // Thursday
  { dayOfWeek: 5, opensAt: "12:00", closesAt: "18:00", closed: false }, // Friday
  { dayOfWeek: 6, opensAt: "12:00", closesAt: "18:00", closed: false }, // Saturday
];

// Prices are strings to preserve exact Decimal precision (no float rounding).
// `artists` is ordered — index 0 is the primary artist (see primaryArtistName).
const SAMPLE_PRODUCTS = [
  {
    title: "Torus",
    artists: ["Vril"],
    label: "Zulema Records",
    productType: "LP",
    genre: "Techno",
    condition: Condition.NEW,
    price: "24.99",
    quantity: 3,
    description: "Hypnotic dub-techno LP — brand new, still sealed.",
  },
  {
    title: "Can You Feel It",
    artists: ["Mr. Fingers"],
    label: "Up Ya",
    productType: '12"',
    genre: "House",
    condition: Condition.SECONDHAND,
    price: "8.99",
    quantity: 2,
    description: "Classic Chicago house 12\" — second-hand, plays clean (VG+).",
  },
  {
    title: "Substrata",
    artists: ["Biosphere"],
    label: "Dirty Carpets",
    productType: "Tape",
    genre: "Ambient",
    condition: Condition.NEW,
    price: "12.99",
    quantity: 1,
    description: "Arctic ambient on cassette — new stock.",
  },
  {
    // Deliberate multi-artist ("split") fixture — exercises the "Artist1 /
    // Artist2" join everywhere it renders (dev/manual verification).
    title: "Frequencies Split",
    artists: ["Jeff Mills", "Surgeon"],
    label: "Warp Records",
    productType: '12"',
    genre: "Techno",
    condition: Condition.NEW,
    price: "16.99",
    quantity: 2,
    description: "Two-track split, one side each — mastered loud.",
  },
];

// Sample blog posts. One draft is included to verify it never appears publicly.
const SAMPLE_POSTS = [
  {
    title: "Fresh Tresor & Clone in the crate",
    slug: "fresh-tresor-and-clone",
    status: PostStatus.PUBLISHED,
    publishedAt: new Date("2026-06-28T10:00:00.000Z"),
    body:
      "A heavy box landed this week. New Tresor reissues, a stack of Clone " +
      "Basement Series 12\"s, and a couple of Rush Hour repress we've been " +
      "chasing for months.\n\n" +
      "Everything is out on the floor now. First come, first served — we don't " +
      "hold copies. Swing by, or catch us on Discogs for next-day pickup.",
  },
  {
    title: "Second-hand Saturday: dub, jazz & odd electronics",
    slug: "second-hand-saturday",
    status: PostStatus.PUBLISHED,
    publishedAt: new Date("2026-06-14T09:00:00.000Z"),
    body:
      "The second-hand section got a big refresh. Plenty outside the usual " +
      "electronic lane this time: spiritual jazz, roots dub, library oddities, " +
      "and a small run of private-press weirdness.\n\n" +
      "All graded honestly and priced to move. Bring your headphones — the " +
      "listening station is free all day.",
  },
  {
    title: "Draft: upcoming in-store (not published)",
    slug: "draft-in-store",
    status: PostStatus.DRAFT,
    publishedAt: null,
    body: "This is a draft and should never show on the public blog.",
  },
];

async function main() {
  // Admin credentials come from the environment — never hardcoded. Throws with a
  // clear message if strong passwords aren't set (see admin-credentials.md).
  const ADMIN_USERS = resolveAdminSeedUsers(process.env);

  // --- Admin users (idempotent on unique email) ---
  for (const { email, password } of ADMIN_USERS) {
    const passwordHash = await hash(password, SALT_ROUNDS);
    await prisma.user.upsert({
      where: { email },
      update: {},
      create: { email, passwordHash },
    });
  }

  // --- Managed reference lists (idempotent on unique name) ---
  for (const name of LABELS) {
    await prisma.label.upsert({ where: { name }, update: {}, create: { name } });
  }
  for (const name of GENRES) {
    await prisma.genre.upsert({ where: { name }, update: {}, create: { name } });
  }
  for (const name of PRODUCT_TYPES) {
    await prisma.productType.upsert({
      where: { name },
      update: {},
      create: { name },
    });
  }

  // --- Opening hours (idempotent on unique dayOfWeek) ---
  for (const hours of OPENING_HOURS) {
    await prisma.openingHours.upsert({
      where: { dayOfWeek: hours.dayOfWeek },
      update: hours,
      create: hours,
    });
  }

  // --- Sample products ---
  // Product has no natural unique key, so guard on title + primary artist to
  // stay idempotent across re-seeds. Labels/types/genres are connected by
  // unique name; artists are upserted by name the same way.
  for (const product of SAMPLE_PRODUCTS) {
    const existing = await prisma.product.findFirst({
      where: { title: product.title, primaryArtistName: product.artists[0] },
    });
    if (existing) continue;

    const artistLinks = await Promise.all(
      product.artists.map(async (name, position) => {
        const artist = await prisma.artist.upsert({
          where: { name },
          update: {},
          create: { name },
        });
        return { artistId: artist.id, position };
      }),
    );

    await prisma.product.create({
      data: {
        title: product.title,
        primaryArtistName: product.artists[0],
        condition: product.condition,
        price: product.price,
        quantity: product.quantity,
        inStock: product.quantity > 0, // derived, kept in sync
        description: product.description,
        label: { connect: { name: product.label } },
        productType: { connect: { name: product.productType } },
        genre: { connect: { name: product.genre } },
        productArtists: { create: artistLinks },
      },
    });
  }

  // --- Sample blog posts (idempotent on unique slug) ---
  for (const post of SAMPLE_POSTS) {
    await prisma.post.upsert({
      where: { slug: post.slug },
      update: {},
      create: post,
    });
  }

  console.log(
    `Seed complete: ${ADMIN_USERS.length} users, ${LABELS.length} labels, ` +
      `${GENRES.length} genres, ${PRODUCT_TYPES.length} product types, ` +
      `${OPENING_HOURS.length} opening-hours rows, ${SAMPLE_PRODUCTS.length} products, ` +
      `${SAMPLE_POSTS.length} posts.`,
  );
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
