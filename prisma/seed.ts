import { PrismaClient } from "@prisma/client";
import { hash } from "bcryptjs";

const prisma = new PrismaClient();

// Placeholder admin credentials — CHANGE THESE before / right after first login.
const ADMIN_USERS = [
  { email: "admin@antenne-tilburg.nl", password: "changeme123" },
  { email: "builder@antenne-tilburg.nl", password: "changeme123" },
];

// Sensible starting reference data so the admin isn't empty on first run.
const LABELS = ["Tresor", "Warp", "Rush Hour", "Clone"];
const PRODUCT_TYPES = ["Vinyl", "Tape"];
const GENRES = [
  "Techno",
  "House",
  "Dubstep",
  "Jungle",
  "Dub",
  "Industrial",
  "Noise",
  "Electro",
];

// dayOfWeek: 0 = Sunday ... 6 = Saturday. Placeholder hours — edit in admin.
const OPENING_HOURS = [
  { dayOfWeek: 0, opensAt: "12:00", closesAt: "17:00", closed: true },
  { dayOfWeek: 1, opensAt: "12:00", closesAt: "18:00", closed: true },
  { dayOfWeek: 2, opensAt: "12:00", closesAt: "18:00", closed: false },
  { dayOfWeek: 3, opensAt: "12:00", closesAt: "18:00", closed: false },
  { dayOfWeek: 4, opensAt: "12:00", closesAt: "18:00", closed: false },
  { dayOfWeek: 5, opensAt: "12:00", closesAt: "18:00", closed: false },
  { dayOfWeek: 6, opensAt: "11:00", closesAt: "17:00", closed: false },
];

async function main() {
  for (const { email, password } of ADMIN_USERS) {
    const passwordHash = await hash(password, 12);
    await prisma.user.upsert({
      where: { email },
      update: {},
      create: { email, passwordHash },
    });
  }

  for (const name of LABELS) {
    await prisma.label.upsert({ where: { name }, update: {}, create: { name } });
  }
  for (const name of PRODUCT_TYPES) {
    await prisma.productType.upsert({ where: { name }, update: {}, create: { name } });
  }
  for (const name of GENRES) {
    await prisma.genre.upsert({ where: { name }, update: {}, create: { name } });
  }

  for (const hours of OPENING_HOURS) {
    await prisma.openingHours.upsert({
      where: { dayOfWeek: hours.dayOfWeek },
      update: hours,
      create: hours,
    });
  }

  console.log("Seed complete: 2 admin users, reference lists, opening hours.");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
