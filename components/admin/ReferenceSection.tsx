"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import type { AdminLocale } from "@prisma/client";

import { apiSend } from "@/lib/api-client";
import { useAsyncAction } from "@/lib/use-async-action";
import { SEARCH_RESULT_CAP } from "@/lib/reference-items";
import { t } from "@/lib/i18n/t";
import { Combobox, type ComboboxOption } from "@/components/ui/Combobox";

export interface ReferenceItem {
  id: string;
  name: string;
  productCount: number;
  supplierId?: string | null;
  supplierName?: string | null;
}

const SEARCH_DEBOUNCE_MS = 200;

export function ReferenceSection({
  title,
  addPlaceholder,
  endpoint,
  initialItems,
  initialTotal,
  supplierEndpoint,
  productLinkParam,
  locale,
}: {
  title: string;
  // Already-localized "<Entity> toevoegen"/"Add <entity>" text — its exact
  // grammar (word order, noun gender) differs per entity and per locale,
  // same as `title` already did, so the caller composes it via t().
  addPlaceholder: string;
  endpoint: string;
  initialItems: ReferenceItem[];
  initialTotal: number;
  supplierEndpoint?: string;
  // Query param this entity's product count links to on /admin/catalog
  // (lib/catalog.ts's CatalogFilters already supports all four).
  productLinkParam?: "artistId" | "genreId" | "labelId" | "productTypeId";
  locale: AdminLocale;
}) {
  const { error, run } = useAsyncAction();
  const [items, setItems] = useState(initialItems);
  const [totalCount, setTotalCount] = useState(initialTotal);
  const [query, setQuery] = useState("");
  const [searchError, setSearchError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [newName, setNewName] = useState("");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState("");
  const [newSupplier, setNewSupplier] = useState<ComboboxOption | null>(null);
  const [editSupplier, setEditSupplier] = useState<ComboboxOption | null>(null);

  const isFirstRender = useRef(true);
  const searchSeq = useRef(0);

  // Server-side typeahead: any query change fetches matches after a
  // debounce. The very first render is skipped — initialItems already IS
  // an empty-query search, fetched server-side (see page.tsx), so refetching
  // it here on mount would just be a redundant duplicate request.
  useEffect(() => {
    if (isFirstRender.current) {
      isFirstRender.current = false;
      return;
    }
    const seq = ++searchSeq.current;
    const timer = setTimeout(async () => {
      try {
        const res = await fetch(
          `${endpoint}?q=${encodeURIComponent(query.trim())}`,
        );
        if (!res.ok) throw new Error();
        const matches = (await res.json()) as ReferenceItem[];
        if (seq === searchSeq.current) {
          setItems(matches);
          setSearchError(null);
        }
      } catch {
        if (seq === searchSeq.current) {
          setSearchError(t("reference.searchError", locale));
        }
      }
    }, SEARCH_DEBOUNCE_MS);
    return () => clearTimeout(timer);
  }, [query, endpoint, locale]);

  function createItem(name: string) {
    run(async () => {
      const created = await apiSend<{
        id: string;
        name: string;
        supplierId?: string | null;
        supplierName?: string | null;
        // Artists only (STEP 5c) — a non-blocking "did you mean" fuzzy
        // match; every other entity's create response simply omits this,
        // so this read is a harmless no-op for them.
        candidates?: { id: string; name: string; productCount: number }[];
      }>(endpoint, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(
          supplierEndpoint ? { name, supplierId: newSupplier?.id ?? null } : { name },
        ),
      });
      setTotalCount((n) => n + 1);
      // Only shown if it matches what's currently on screen — otherwise it
      // exists (the total above already reflects that) but stays hidden
      // until the admin searches for it, same as a fresh search would show.
      const trimmedQuery = query.trim();
      const matchesQuery =
        trimmedQuery === "" ||
        created.name.toLowerCase().includes(trimmedQuery.toLowerCase());
      // Invalidate any search response still in flight from before this
      // mutation — same seq-guard the search effect already uses to drop
      // out-of-order responses. Bump unconditionally: even when the add
      // doesn't change the visible list, a stale response could still land
      // and clobber `items` with pre-mutation results.
      searchSeq.current++;
      if (matchesQuery) {
        setItems((prev) =>
          [
            ...prev,
            {
              ...created,
              productCount: 0,
              supplierId: created.supplierId ?? null,
              supplierName: created.supplierName ?? null,
            },
          ].sort((a, b) => a.name.localeCompare(b.name)),
        );
      }
      setNewName("");
      setNewSupplier(null);
      const candidateList = created.candidates?.length
        ? created.candidates
            .map((c) => `${c.name} (${c.productCount} products)`)
            .join(", ")
        : null;
      const fuzzyHint = candidateList
        ? locale === "EN"
          ? ` Did you mean: ${candidateList}?`
          : ` Bedoelde je: ${candidateList}?`
        : "";
      setSuccessMessage(
        locale === "EN"
          ? `Added "${created.name}".${fuzzyHint}`
          : `"${created.name}" toegevoegd.${fuzzyHint}`,
      );
    });
  }

  function handleAdd(event: React.FormEvent) {
    event.preventDefault();
    const name = newName.trim();
    if (!name) return;
    createItem(name);
  }

  function handleSaveEdit(id: string) {
    const name = editName.trim();
    if (!name) return;
    run(async () => {
      await apiSend(`${endpoint}/${id}`, {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(
          supplierEndpoint ? { name, supplierId: editSupplier?.id ?? null } : { name },
        ),
      });
      // Stays visible even if the rename no longer matches the active
      // search query — an admin editing an item shouldn't see it vanish
      // out from under them mid-edit.
      // Invalidate any search response still in flight from before this
      // mutation — see the matching comment in handleAdd.
      searchSeq.current++;
      setItems((prev) =>
        prev
          .map((item) =>
            item.id === id
              ? {
                  ...item,
                  name,
                  supplierId: editSupplier?.id ?? null,
                  supplierName: editSupplier?.name ?? null,
                }
              : item,
          )
          .sort((a, b) => a.name.localeCompare(b.name)),
      );
      setEditingId(null);
      setSuccessMessage(t("common.saved", locale));
    });
  }

  function handleDelete(id: string) {
    run(async () => {
      await apiSend(`${endpoint}/${id}`, { method: "DELETE" });
      // Invalidate any search response still in flight from before this
      // mutation — see the matching comment in handleAdd.
      searchSeq.current++;
      setItems((prev) => prev.filter((item) => item.id !== id));
      setTotalCount((n) => n - 1);
    });
  }

  function startEdit(item: ReferenceItem) {
    setEditingId(item.id);
    setEditName(item.name);
    setEditSupplier(
      item.supplierId ? { id: item.supplierId, name: item.supplierName ?? "" } : null,
    );
  }

  const label = title.toLowerCase();

  return (
    <div className="space-y-6">
      <div className="flex items-baseline justify-between gap-2">
        <h1 className="text-2xl font-bold tracking-tight">{title}</h1>
        <span className="text-sm text-admin-ink-muted">
          {totalCount.toLocaleString()} {label}
        </span>
      </div>

      <div className="rounded border border-admin-hairline bg-admin-surface p-4 space-y-3">
        <input
          type="search"
          value={query}
          onChange={(e) => {
            // A stale success banner from a prior add/edit shouldn't linger
            // once the admin starts a new search.
            setQuery(e.target.value);
            setSuccessMessage(null);
          }}
          placeholder={`${t("reference.search", locale)} ${label}`}
          aria-label={`${t("reference.search", locale)} ${label}`}
          className="w-full rounded border border-admin-hairline bg-admin-bg px-2 py-1 text-sm"
        />

        <form onSubmit={handleAdd} className="flex gap-2">
          <input
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            placeholder={addPlaceholder}
            aria-label={addPlaceholder}
            className="flex-1 rounded border border-admin-hairline bg-admin-bg px-2 py-1 text-sm"
          />
          <button
            type="submit"
            className="rounded bg-admin-ink transition-colors duration-150 ease-out hover:bg-signal px-3 py-2 text-sm font-medium text-admin-bg"
          >
            {t("common.add", locale)}
          </button>
          {supplierEndpoint && (
            <Combobox
              label="Supplier"
              endpoint={supplierEndpoint}
              value={newSupplier}
              onChange={setNewSupplier}
              allowCreate={false}
            />
          )}
        </form>
      </div>

      {(error || searchError) && (
        <p role="alert" className="mt-2 text-sm text-red-400">
          {error ?? searchError}
        </p>
      )}

      {successMessage && !(error || searchError) && (
        <p role="status" className="mt-2 text-sm text-admin-ink-muted">
          {successMessage}
        </p>
      )}

      {items.length === 0 ? (
        query.trim() ? (
          <button
            type="button"
            onClick={() => createItem(query.trim())}
            className="mt-3 text-sm text-admin-ink underline"
          >
            {locale === "EN" ? (
              <>Add &quot;{query.trim()}&quot;</>
            ) : (
              <>&quot;{query.trim()}&quot; toevoegen</>
            )}
          </button>
        ) : (
          <p className="mt-3 text-sm text-admin-ink-muted">{t("reference.noMatches", locale)}</p>
        )
      ) : (
        <>
          <ul className="mt-3 divide-y divide-admin-hairline">
            {items.map((item) => (
              <li
                key={item.id}
                className="flex items-center justify-between gap-2 py-2 text-sm"
              >
                {editingId === item.id ? (
                  <>
                    <input
                      value={editName}
                      onChange={(e) => setEditName(e.target.value)}
                      aria-label={`${t("common.edit", locale)} ${item.name}`}
                      className="flex-1 rounded border border-admin-hairline px-2 py-1"
                    />
                    {supplierEndpoint && (
                      <Combobox
                        label="Supplier"
                        endpoint={supplierEndpoint}
                        value={editSupplier}
                        onChange={setEditSupplier}
                        allowCreate={false}
                      />
                    )}
                    <button
                      type="button"
                      onClick={() => handleSaveEdit(item.id)}
                      className="text-admin-ink hover:underline"
                    >
                      {t("common.save", locale)}
                    </button>
                    <button
                      type="button"
                      onClick={() => setEditingId(null)}
                      className="text-admin-ink-muted hover:underline"
                    >
                      {t("common.cancel", locale)}
                    </button>
                  </>
                ) : (
                  <>
                    <span className="flex-1">
                      {item.name}
                      {supplierEndpoint && (
                        <span className="ml-2 text-xs text-admin-ink-muted">
                          {item.supplierName ?? t("reference.noSupplier", locale)}
                        </span>
                      )}
                    </span>
                    {/* Fixed columns keep Edit aligned across every row,
                        and align whatever trails it (Delete, or the
                        "In use by N products" text) too — same approach
                        as the catalog list. */}
                    <div className="grid grid-cols-[48px_200px] items-center gap-2">
                      <div className="flex justify-center">
                        <button
                          type="button"
                          onClick={() => startEdit(item)}
                          className="text-admin-ink hover:underline"
                        >
                          {t("common.edit", locale)}
                        </button>
                      </div>
                      <div className="flex justify-start">
                        {item.productCount > 0 ? (
                          productLinkParam ? (
                            <Link
                              // instock=false: productCount below counts every
                              // linked product, but the catalog defaults to
                              // in-stock-only — without this the admin can
                              // land on a page showing fewer products than
                              // the count just said (or none at all).
                              href={`/admin/catalog?${productLinkParam}=${item.id}&instock=false`}
                              className="text-admin-ink-muted hover:underline"
                            >
                              {t("reference.inUsePrefix", locale)} {item.productCount}{" "}
                              {t("products.countPlural", locale)}
                            </Link>
                          ) : (
                            <span className="text-admin-ink-muted">
                              {t("reference.inUsePrefix", locale)} {item.productCount}{" "}
                              {t("products.countPlural", locale)}
                            </span>
                          )
                        ) : (
                          <button
                            type="button"
                            onClick={() => handleDelete(item.id)}
                            className="text-red-400 hover:underline"
                          >
                            {t("common.delete", locale)}
                          </button>
                        )}
                      </div>
                    </div>
                  </>
                )}
              </li>
            ))}
          </ul>
          {items.length === SEARCH_RESULT_CAP && (
            <p className="mt-2 text-sm text-admin-ink-muted">
              {t("reference.showingFirstPrefix", locale)} {SEARCH_RESULT_CAP}{" "}
              {t("reference.showingFirstSuffix", locale)}
            </p>
          )}
        </>
      )}
    </div>
  );
}
