# Antenne Tilburg — Website Rebuild Plan

## About the shop
Antenne Recordshop is a physical record shop in Tilburg specialised in electronic music, located inside Sam-Sam vintage clothing store. Vinyl and tapes only — mainly new vinyl, plus a second-hand section covering electronic and non-electronic genres (dance, funk, soul, jazz, rock, pop). Run by DJ DMDN.

Separately, Antenne sells records via Discogs. Discogs stock is completely independent from the physical shop's stock. Discogs orders are prepared for next-day pickup at Antenne, not shipped from the shop directly.

## Goals
- Rebuild the current PHP site on a modern, cheaply-hostable stack
- Add an admin section for managing products (vinyl stock) and blog posts
- Two admin users with equal access (shop owner + website builder)
- SEO-conscious from day one
- Architect the product model so online purchasing can be added later without rework
- Cross-post new blog posts to Facebook and Instagram

## Tech Stack
- **Framework:** Next.js (React + TypeScript) — frontend + API routes in one project, strong SEO support via SSR/static generation
- **Database:** PostgreSQL
- **Hosting:** Small VPS, NL/EU-based and low-cost — Hetzner (Falkenstein, DE) or TransIP (NL) are good fits. Avoids vendor lock-in, keeps monthly cost low and predictable.
- **Payments (future phase):** Mollie — supports iDEAL (priority) and PayPal (later) through a single integration, and is built for the Dutch market.

## Public-facing pages
- **Home** — intro, Just In section (last 30 days), upcoming events teaser, location teaser
- **About** — shop story, genre focus, second-hand section, who runs it
- **FAQ** — vinyl/tape only, second-hand explanation, Discogs vs in-store stock distinction, pickup process
- **Visit/Contact** — address, phone, opening hours (dynamic from admin), map
- **Stock** — browsable/filterable product listing (genre, label, product type, condition, Just In)
- **Blog** — index + individual post pages (new arrivals, events, restocks — also helps SEO via fresh content)
- **Events** — upcoming and past events
- **Newsletter signup** — simple email capture

## Admin section
**Auth:** Two equal admin accounts (shop owner + builder), session-based login, no role/permission tiers needed since access is identical for both.

**Reference data management**
Separately managed lists, each with their own CRUD (add, rename, delete — with a guard on delete if products are still linked):
- **Labels** — e.g. Tresor, Warp, Rush Hour, Clone
- **Product types** — e.g. vinyl, tape
- **Genres** — e.g. techno, house, dubstep, jungle, dub, industrial, noise, electro, etc.

**Product management (vinyl records)**
- Fields: title, artist, catalog number, label (→ managed list), genre (→ managed list, exactly one per product), product type (→ managed list), condition (new/second-hand), price, description, cover image, stock status, created_at, updated_at
- **Genre model:** each product has exactly one genre — a single foreign key, not many-to-many tags. Rationale: Antenne sells electronic music, and single-genre filing matches how the shop owner thinks about and files stock.
- "Just In" badge automatically shown on public stock page for products added within the last 30 days (based on created_at, no manual toggle needed)
- CRUD: add, edit, delete, mark sold/out of stock
- List view with search/filter by genre, label, product type, and condition
- Public stock page filtering powered by the same managed lists — consistent and reliable
- Dedicated "Just In" section on the home page powered by created_at

**Site notices / announcements**
- Fields: message (rich text or plain), active toggle, optional start date/time, optional end date/time
- Multiple notices can be active simultaneously
- If start/end dates are set, notice activates/deactivates automatically — otherwise toggled manually
- Public site shows all currently active notices (e.g. as a banner at the top of every page)
- CRUD: add, edit, delete, toggle on/off


- Fields: title, slug, body, cover image, published date, draft/published status
- CRUD: write, edit, publish/unpublish, delete

**Opening hours management**
- Manage opening hours per day of the week from the admin (no developer needed for changes)
- Support for adjusted hours (holiday schedule, special days)
- Public Visit/Contact page pulls hours dynamically from the database
- Ties into the notices system — e.g. pair a holiday closure notice with adjusted hours

**SEO metadata per page/product/post**
- Custom page title and meta description settable per: static page (Home, About, FAQ, Visit), product, blog post, event
- Falls back to sensible auto-generated defaults if not set
- Essential from day one, not bolted on later

**Events**
- Fields: title, date/time, description, image, location (default: Antenne/Sam-Sam), status (upcoming/past)
- CRUD: add, edit, delete
- Public events page showing upcoming and past events
- Cross-post to social alongside blog posts

**Newsletter signup**
- Simple email capture on the public site (name + email)
- Admin can view and export the subscriber list
- Optionally connect to Mailchimp or Brevo later

**Customer want list / request form**
- Public form: visitors submit what they're looking for (artist, title, format, notes)
- Submissions visible in the admin — useful for sourcing decisions and understanding audience demand

**Technical — SEO infrastructure**
- Auto-generated sitemap.xml and robots.txt from day one
- Next.js handles this with minimal effort; important for search indexing from launch

 (Facebook & Instagram)
When a blog post is published, automatically post it (or a summary + link + image) to the shop's Facebook Page and Instagram Business account.

**Important constraints to plan around:**
- Instagram posting via API requires the IG account to be a Business/Creator account linked to a Facebook Page
- Meta requires app review approval for the relevant permissions (`pages_manage_posts`, `instagram_content_publish`, etc.) before this works outside of test mode — this isn't instant, it's a submission/approval process
- Image posts to Instagram require a publicly accessible image URL at the time of posting (works naturally once the blog's cover images are hosted on the live site)

**Recommended approach:** Build this as its own phase after the core site and admin are working — implemented as a "publish hook" that fires after a blog post is marked published, calling the Meta Graph API for both Facebook Page posts and Instagram posts. Until app review is approved, can be tested in development/sandbox mode with a Meta test app.

## Purchasing — built for later, not now
Not included in the initial build: cart, checkout, customer accounts, payment processing.

Architected so it's a clean add-on later:
- Product table already includes `price`, so no schema rework needed there
- Later phase adds: `orders` table, `order_items` table, Mollie checkout integration (iDEAL first, PayPal second)

## Explicitly out of scope (for now)
- Multi-admin permission tiers (both admins have identical access)
- Online checkout/payments
- Customer accounts
