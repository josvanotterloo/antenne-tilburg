"use client";

import { useEffect, useId, useRef, useState } from "react";

import { apiSend } from "@/lib/api-client";
import { useAsyncAction } from "@/lib/use-async-action";
import type { ComboboxOption } from "@/components/ui/Combobox";

export interface MultiComboboxProps {
  label: string;
  // Reference API base (e.g. /api/admin/artists): GET ?q= searches, POST creates.
  endpoint: string;
  selected: ComboboxOption[];
  onChange: (options: ComboboxOption[]) => void;
  id?: string;
  required?: boolean;
}

const SEARCH_DEBOUNCE_MS = 200;

// Multi-select combobox with server-side typeahead: same search/quick-add
// behaviour as Combobox, but each pick appends to `selected` (shown as
// removable chips, in selection order) instead of replacing a single value.
// Kept as its own component rather than overloading Combobox, whose
// single-select contract (value/onChange) is relied on by its three existing
// usages and their tests.
export function MultiCombobox({
  label,
  endpoint,
  selected,
  onChange,
  id,
  required,
}: MultiComboboxProps) {
  const listboxId = useId();
  const rootRef = useRef<HTMLDivElement>(null);
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [items, setItems] = useState<ComboboxOption[]>([]);
  const [highlight, setHighlight] = useState(-1);
  const [searchError, setSearchError] = useState<string | null>(null);
  const { pending: busy, error: createError, run } = useAsyncAction();

  const filter = query.trim().toLowerCase();
  const searchSeq = useRef(0);
  const selectedIds = new Set(selected.map((o) => o.id));

  useEffect(() => {
    if (!open) return;
    const seq = ++searchSeq.current;
    const timer = setTimeout(async () => {
      try {
        const res = await fetch(
          `${endpoint}?q=${encodeURIComponent(query.trim())}`,
        );
        if (!res.ok) throw new Error();
        const matches = (await res.json()) as ComboboxOption[];
        if (seq === searchSeq.current) {
          setItems(matches);
          setSearchError(null);
        }
      } catch {
        if (seq === searchSeq.current) {
          setSearchError("Couldn't load suggestions. Keep typing to retry.");
        }
      }
    }, SEARCH_DEBOUNCE_MS);
    return () => clearTimeout(timer);
  }, [open, query, endpoint]);

  // Already-selected artists don't show up again in the dropdown.
  const selectable = items.filter((o) => !selectedIds.has(o.id));
  const hasExact = items.some((o) => o.name.toLowerCase() === filter);
  const showQuickAdd = filter.length > 0 && !hasExact;
  const itemCount = selectable.length + (showQuickAdd ? 1 : 0);

  function close() {
    setOpen(false);
    setQuery("");
    setHighlight(-1);
  }

  useEffect(() => {
    if (!open) return;
    function onDocMouseDown(event: MouseEvent) {
      if (!rootRef.current?.contains(event.target as Node)) close();
    }
    document.addEventListener("mousedown", onDocMouseDown);
    return () => document.removeEventListener("mousedown", onDocMouseDown);
  }, [open]);

  function pick(option: ComboboxOption) {
    onChange([...selected, option]);
    close();
  }

  function remove(id: string) {
    onChange(selected.filter((o) => o.id !== id));
  }

  function quickAdd() {
    const name = query.trim();
    if (!name || busy) return;
    run(async () => {
      const created = await apiSend<ComboboxOption>(endpoint, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ name }),
      });
      pick(created);
    });
  }

  function onKeyDown(event: React.KeyboardEvent) {
    switch (event.key) {
      case "ArrowDown":
        event.preventDefault();
        setOpen(true);
        setHighlight((h) => Math.min(h + 1, itemCount - 1));
        break;
      case "ArrowUp":
        event.preventDefault();
        setHighlight((h) => Math.max(h - 1, 0));
        break;
      case "Enter":
        event.preventDefault();
        if (highlight < 0) return;
        if (highlight < selectable.length) pick(selectable[highlight]);
        else if (showQuickAdd) void quickAdd();
        break;
      case "Escape":
        event.preventDefault();
        close();
        break;
    }
  }

  const error = createError ?? searchError;

  return (
    <div ref={rootRef} className="relative">
      {selected.length > 0 && (
        <ul className="mb-2 flex flex-wrap gap-1.5">
          {selected.map((option) => (
            <li
              key={option.id}
              className="flex items-center gap-1 rounded border border-admin-hairline bg-admin-raised px-2 py-0.5 text-sm"
            >
              {option.name}
              <button
                type="button"
                aria-label={`Remove ${option.name}`}
                onClick={() => remove(option.id)}
                className="text-admin-ink-muted hover:text-red-400"
              >
                ×
              </button>
            </li>
          ))}
        </ul>
      )}

      <input
        id={id}
        role="combobox"
        aria-label={label}
        aria-expanded={open}
        aria-controls={listboxId}
        aria-required={required && selected.length === 0}
        autoComplete="off"
        value={query}
        placeholder={`Add ${label.toLowerCase()}`}
        onFocus={() => setOpen(true)}
        onClick={() => setOpen(true)}
        onChange={(e) => {
          setQuery(e.target.value);
          setOpen(true);
          setHighlight(-1);
        }}
        onKeyDown={onKeyDown}
        className="w-full rounded border border-admin-hairline px-2 py-1 text-sm"
      />

      {open && itemCount > 0 && (
        <ul
          id={listboxId}
          role="listbox"
          aria-label={label}
          className="absolute z-10 mt-1 max-h-56 w-full overflow-auto rounded border border-admin-hairline bg-admin-surface shadow"
        >
          {selectable.map((option, index) => (
            <li
              key={option.id}
              role="option"
              aria-selected={false}
              onMouseDown={(e) => {
                e.preventDefault();
                pick(option);
              }}
              className={`cursor-pointer px-2 py-1 text-sm ${
                index === highlight ? "bg-admin-raised" : ""
              }`}
            >
              {option.name}
            </li>
          ))}
          {showQuickAdd && (
            <li
              role="option"
              aria-selected={false}
              onMouseDown={(e) => {
                e.preventDefault();
                void quickAdd();
              }}
              className={`cursor-pointer px-2 py-1 text-sm text-admin-ink-muted ${
                highlight === selectable.length ? "bg-admin-raised" : ""
              }`}
            >
              + Add &quot;{query.trim()}&quot;
            </li>
          )}
        </ul>
      )}

      {error && (
        <p role="alert" className="mt-1 text-xs text-red-400">
          {error}
        </p>
      )}
    </div>
  );
}
