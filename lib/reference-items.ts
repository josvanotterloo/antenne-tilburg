import type { ReferenceItem } from "@/components/admin/ReferenceSection";

// Must match whichever SEARCH_LIMIT the section's own `endpoint` prop points
// at (the shared factory's lib/reference-crud.ts for Genres/Product Types,
// or Labels'/Suppliers' own bespoke route) — when a result set is exactly
// this size, it may have been truncated server-side, so we hint at that
// rather than let it read as "that's everything." Exported so every
// standalone reference page's own server-side `take` stays in sync with
// this hint instead of each declaring its own copy of the number.
//
// Lives outside ReferenceSection.tsx (a "use client" module) because every
// reference page.tsx is a Server Component: importing a plain value or
// function from a client-boundary module resolves to an opaque client
// reference at runtime instead of the real value, not the actual number/
// function (e.g. `take: SEARCH_RESULT_CAP` became `take: [object Function]`).
export const SEARCH_RESULT_CAP = 20;

// Shared shape for the two entities (Genre, Product Type) whose product
// count is a direct FK relation — Label and Artist have their own bespoke
// mappers (extra supplier fields / a differently-named join relation).
export type WithProductCount = {
  id: string;
  name: string;
  _count: { products: number };
};

export const toSimpleReferenceItems = (
  rows: WithProductCount[],
): ReferenceItem[] =>
  rows.map((r) => ({ id: r.id, name: r.name, productCount: r._count.products }));
