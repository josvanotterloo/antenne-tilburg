import { PrismaClient, Condition } from "@prisma/client";
import { hash } from "bcrypt";

const prisma = new PrismaClient();

const SALT_ROUNDS = 12;

// Placeholder credentials — ROTATE before deploy. Both admins have equal access.
const ADMIN_USERS = [
  { email: "shop@antenne-tilburg.nl", password: "changeme123" }, // shop owner
  { email: "dev@antenne-tilburg.nl", password: "changeme123" }, // website builder
];

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
const SAMPLE_PRODUCTS = [
  {
    title: "Torus",
    artist: "Vril",
    label: "Zulema Records",
    productType: "LP",
    genres: ["Techno"],
    condition: Condition.NEW,
    price: "24.99",
    inStock: true,
    description: "Hypnotic dub-techno LP — brand new, still sealed.",
  },
  {
    title: "Can You Feel It",
    artist: "Mr. Fingers",
    label: "Up Ya",
    productType: '12"',
    genres: ["House"],
    condition: Condition.SECONDHAND,
    price: "8.99",
    inStock: true,
    description: "Classic Chicago house 12\" — second-hand, plays clean (VG+).",
  },
  {
    title: "Substrata",
    artist: "Biosphere",
    label: "Dirty Carpets",
    productType: "Tape",
    genres: ["Ambient"],
    condition: Condition.NEW,
    price: "12.99",
    inStock: true,
    description: "Arctic ambient on cassette — new stock.",
  },
];

async function main() {
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
  // Product has no natural unique key, so guard on title + artist to stay
  // idempotent across re-seeds. Labels/types/genres are connected by unique name.
  for (const product of SAMPLE_PRODUCTS) {
    const existing = await prisma.product.findFirst({
      where: { title: product.title, artist: product.artist },
    });
    if (existing) continue;

    await prisma.product.create({
      data: {
        title: product.title,
        artist: product.artist,
        condition: product.condition,
        price: product.price,
        inStock: product.inStock,
        description: product.description,
        label: { connect: { name: product.label } },
        productType: { connect: { name: product.productType } },
        genres: { connect: product.genres.map((name) => ({ name })) },
      },
    });
  }

  console.log(
    `Seed complete: ${ADMIN_USERS.length} users, ${LABELS.length} labels, ` +
      `${GENRES.length} genres, ${PRODUCT_TYPES.length} product types, ` +
      `${OPENING_HOURS.length} opening-hours rows, ${SAMPLE_PRODUCTS.length} products.`,
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
