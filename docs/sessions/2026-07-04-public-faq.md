# Session Log — 2026-07-04 (public FAQ)

## What was built
- `/faq`: six Q&As (vinyl/tape only, second-hand, Discogs vs in-store, next-day
  pickup, holds, location) + `FAQPage` JSON-LD structured data.

## What worked
- One `FAQ_ITEMS` array drives both the visible list and the structured data — no
  duplication, answers stay in sync.

## What drifted from intent
- None.

## Signal (what should change in a shared artifact)
- [ ] None

## Updates made
- `/faq` (+test), feature doc, this log.
