"use client";

import { useEffect, useRef, useState } from "react";

import { apiSend } from "@/lib/api-client";
import { useAsyncAction } from "@/lib/use-async-action";

export interface ReferenceItem {
  id: string;
  name: string;
  productCount: number;
}

const SEARCH_DEBOUNCE_MS = 200;

// Matches the reference API's SEARCH_LIMIT (lib/reference-crud.ts) — when a
// result set is exactly this size, it may have been truncated server-side,
// so we hint at that rather than let it read as "that's everything."
const SEARCH_RESULT_CAP = 20;

export function ReferenceSection({
  title,
  endpoint,
  initialItems,
  initialTotal,
}: {
  title: string;
  endpoint: string;
  initialItems: ReferenceItem[];
  initialTotal: number;
}) {
  const { error, run } = useAsyncAction();
  const [items, setItems] = useState(initialItems);
  const [totalCount, setTotalCount] = useState(initialTotal);
  const [query, setQuery] = useState("");
  const [searchError, setSearchError] = useState<string | null>(null);
  const [newName, setNewName] = useState("");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState("");

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
          setSearchError("Couldn't load results. Keep typing to retry.");
        }
      }
    }, SEARCH_DEBOUNCE_MS);
    return () => clearTimeout(timer);
  }, [query, endpoint]);

  function handleAdd(event: React.FormEvent) {
    event.preventDefault();
    const name = newName.trim();
    if (!name) return;
    run(async () => {
      const created = await apiSend<{ id: string; name: string }>(endpoint, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ name }),
      });
      setTotalCount((n) => n + 1);
      // Only shown if it matches what's currently on screen — otherwise it
      // exists (the total above already reflects that) but stays hidden
      // until the admin searches for it, same as a fresh search would show.
      const trimmedQuery = query.trim();
      const matchesQuery =
        trimmedQuery === "" ||
        created.name.toLowerCase().includes(trimmedQuery.toLowerCase());
      if (matchesQuery) {
        setItems((prev) =>
          [...prev, { ...created, productCount: 0 }].sort((a, b) =>
            a.name.localeCompare(b.name),
          ),
        );
      }
      setNewName("");
    });
  }

  function handleSaveEdit(id: string) {
    const name = editName.trim();
    if (!name) return;
    run(async () => {
      await apiSend(`${endpoint}/${id}`, {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ name }),
      });
      // Stays visible even if the rename no longer matches the active
      // search query — an admin editing an item shouldn't see it vanish
      // out from under them mid-edit.
      setItems((prev) =>
        prev
          .map((item) => (item.id === id ? { ...item, name } : item))
          .sort((a, b) => a.name.localeCompare(b.name)),
      );
      setEditingId(null);
    });
  }

  function handleDelete(id: string) {
    run(async () => {
      await apiSend(`${endpoint}/${id}`, { method: "DELETE" });
      setItems((prev) => prev.filter((item) => item.id !== id));
      setTotalCount((n) => n - 1);
    });
  }

  const label = title.toLowerCase();

  return (
    <section className="rounded border border-admin-hairline bg-admin-surface p-4">
      <div className="flex items-baseline justify-between gap-2">
        <h2 className="font-semibold">{title}</h2>
        <span className="text-xs text-admin-ink-muted">
          {totalCount.toLocaleString()} {label}
        </span>
      </div>

      <input
        type="search"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        placeholder={`Search ${label}`}
        aria-label={`Search ${label}`}
        className="mt-3 w-full rounded border border-admin-hairline px-2 py-1 text-sm"
      />

      <form onSubmit={handleAdd} className="mt-3 flex gap-2">
        <input
          value={newName}
          onChange={(e) => setNewName(e.target.value)}
          placeholder={`Add ${title.toLowerCase().replace(/s$/, "")}`}
          aria-label={`New ${title} name`}
          className="flex-1 rounded border border-admin-hairline px-2 py-1 text-sm"
        />
        <button
          type="submit"
          className="rounded bg-admin-ink transition-colors duration-150 ease-out hover:bg-signal px-3 py-1 text-sm text-admin-bg"
        >
          Add
        </button>
      </form>

      {(error || searchError) && (
        <p role="alert" className="mt-2 text-sm text-red-400">
          {error ?? searchError}
        </p>
      )}

      {items.length === 0 ? (
        <p className="mt-3 text-sm text-admin-ink-muted">No matches.</p>
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
                      aria-label={`Edit ${item.name}`}
                      className="flex-1 rounded border border-admin-hairline px-2 py-1"
                    />
                    <button
                      type="button"
                      onClick={() => handleSaveEdit(item.id)}
                      className="text-admin-ink hover:underline"
                    >
                      Save
                    </button>
                    <button
                      type="button"
                      onClick={() => setEditingId(null)}
                      className="text-admin-ink-muted hover:underline"
                    >
                      Cancel
                    </button>
                  </>
                ) : (
                  <>
                    <span className="flex-1">{item.name}</span>
                    <button
                      type="button"
                      onClick={() => {
                        setEditingId(item.id);
                        setEditName(item.name);
                      }}
                      className="text-admin-ink hover:underline"
                    >
                      Edit
                    </button>
                    {item.productCount > 0 ? (
                      <span className="text-admin-ink-muted">
                        In use by {item.productCount} products
                      </span>
                    ) : (
                      <button
                        type="button"
                        onClick={() => handleDelete(item.id)}
                        className="text-red-400 hover:underline"
                      >
                        Delete
                      </button>
                    )}
                  </>
                )}
              </li>
            ))}
          </ul>
          {items.length === SEARCH_RESULT_CAP && (
            <p className="mt-2 text-sm text-admin-ink-muted">
              Showing the first {SEARCH_RESULT_CAP} — refine your search to
              narrow further.
            </p>
          )}
        </>
      )}
    </section>
  );
}
