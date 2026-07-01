# Claude Code Kickoff — Antenne Tilburg Website

## Before anything else

Read these files in full before taking any action:
- `CLAUDE.md`
- `docs/instructions/branching.md`
- `docs/instructions/generate-route.md`
- `docs/instructions/interrogate.md`
- `docs/antenne-tilburg-website-plan.md` (the full project spec)

---

## Step 1 — Update CLAUDE.md

Replace the template placeholders in `CLAUDE.md`:
- Replace the setup note and bracketed placeholders with project-specific content
- **Setup line:** `npm install` then `npm run dev` to start the dev server
- Keep all existing sections (Current Tasks, Permanent Lessons, Instructions, Testing, Autonomy, Prompting Tips) intact

---

## Step 2 — Scaffold the project

**Stack:**
- Next.js 14+ with TypeScript (App Router)
- PostgreSQL database
- Prisma as the ORM
- NextAuth.js for session-based authentication
- Tailwind CSS for styling

**Project structure to scaffold:**
```
app/                        # Next.js App Router
  (public)/                 # Public-facing pages
    page.tsx                # Home
    about/page.tsx
    faq/page.tsx
    visit/page.tsx
    stock/page.tsx
    blog/page.tsx
    blog/[slug]/page.tsx
    events/page.tsx
    events/[slug]/page.tsx
    newsletter/page.tsx
  admin/                    # Protected admin section
    login/page.tsx
    page.tsx                # Dashboard
    products/page.tsx
    labels/page.tsx
    genres/page.tsx
    product-types/page.tsx
    posts/page.tsx
    events/page.tsx
    notices/page.tsx
    opening-hours/page.tsx
    subscribers/page.tsx
    want-list/page.tsx
    users/page.tsx
  api/                      # API routes
    auth/[...nextauth]/route.ts
components/
  layout/                   # Header, Footer, AdminNav
  ui/                       # Shared UI components
lib/
  db.ts                     # Prisma singleton
  auth.ts                   # NextAuth config/helpers
prisma/
  schema.prisma
  seed.ts
```

---

## Step 3 — Prisma schema

Create the full schema in `prisma/schema.prisma`:

```
User            id, email, passwordHash, createdAt, updatedAt
Label           id, name, createdAt, updatedAt
Genre           id, name, createdAt, updatedAt
ProductType     id, name, createdAt, updatedAt
Product         id, title, artist, labelId, productTypeId,
                condition (enum: NEW | SECONDHAND), price (Decimal),
                description, coverImage, inStock (bool),
                createdAt, updatedAt
                → many-to-many with Genre
                → belongs to Label, ProductType
Post            id, title, slug (unique), body, coverImage,
                status (enum: DRAFT | PUBLISHED),
                publishedAt, seoTitle, seoDescription,
                createdAt, updatedAt
Event           id, title, slug (unique), date (DateTime),
                description, image, location,
                status (enum: UPCOMING | PAST),
                seoTitle, seoDescription, createdAt, updatedAt
Notice          id, message, active (bool),
                startsAt (DateTime?), endsAt (DateTime?),
                createdAt, updatedAt
OpeningHours    id, dayOfWeek (Int 0–6), opensAt (String),
                closesAt (String), closed (bool)
PageSeo         id, page (String unique), seoTitle, seoDescription
NewsletterSubscriber  id, name, email (unique), createdAt
WantListRequest id, artist, title, format, notes, createdAt
```

---

## Step 4 — Auth

Set up NextAuth.js with credentials provider (email + password, bcrypt hashing).

Seed two admin users in `prisma/seed.ts` with placeholder credentials:
- `admin@antenne-tilburg.nl` / `changeme123`
- `builder@antenne-tilburg.nl` / `changeme123`

Protect all `/admin/*` routes — redirect to `/admin/login` if not authenticated.

---

## Step 5 — Admin shell

Scaffold a minimal but functional admin layout:
- Login page at `/admin/login`
- Admin dashboard at `/admin` with nav links to all sections
- Placeholder pages for every admin section (listed above) — just heading + "coming soon" is fine for now

---

## Step 6 — Public shell

Scaffold all public pages with:
- Shared layout: header with nav (Home, Stock, Blog, Events, Visit), footer with address + hours
- Each page renders a heading and placeholder content for now
- Active notices banner component at the top of every public page (reads from DB, shows all currently active notices)

---

## Step 7 — Environment + docs

Create `.env.example`:
```
DATABASE_URL=postgresql://USER:PASSWORD@localhost:5432/antenne_tilburg
NEXTAUTH_SECRET=your-secret-here
NEXTAUTH_URL=http://localhost:3000
```

Add `docs/instructions/generate-route.md` entry for this project — update the existing template file to reference Next.js App Router patterns instead of any previous project's conventions.

---

## Step 8 — Tasks + commit

Write a plan to `tasks/todo.md` covering what was scaffolded and what comes next (admin CRUD for each entity, public pages pulling real data, social cross-posting, SEO metadata, etc.).

Then commit everything:
```
git add .
git commit -m "chore: scaffold Next.js project, Prisma schema, auth, admin and public shells"
```

---

## General rules
- TypeScript throughout — no plain JS
- Prisma Client via singleton in `lib/db.ts`
- Follow branching rules in `docs/instructions/branching.md`
- After scaffolding, give a brief summary of what was created and flag anything that needs my input before continuing
