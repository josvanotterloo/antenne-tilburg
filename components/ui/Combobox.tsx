"use client";

import { useEffect, useId, useRef, useState } from "react";

import { apiSend } from "@/lib/api-client";
import { useAsyncAction } from "@/lib/use-async-action";

export interface ComboboxOption {
  id: string;
  name: string;
}

export interface ComboboxProps {
  label: string;
  // Reference API base (e.g. /api/admin/labels): GET ?q= searches, POST creates.
  endpoint: string;
  value: ComboboxOption | null;
  onChange: (option: ComboboxOption) => void;
  // Set on the input so an external <label htmlFor> can associate with it.
  id?: string;
  required?: boolean;
}

const SEARCH_DEBOUNCE_MS = 200;

// Single-select combobox with server-side typeahead: matches are fetched from
// `endpoint` as the user types (debounced), quick-add creates a new entry via
// POST, keyboard navigable (Arrow keys / Enter / Escape).
export function Combobox({
  label,
  endpoint,
  value,
  onChange,
  id,
  required,
}: ComboboxProps) {
  const listboxId = useId();
  const rootRef = useRef<HTMLDivElement>(null);
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [items, setItems] = useState<ComboboxOption[]>([]);
  const [highlight, setHighlight] = useState(-1);
  const [searchError, setSearchError] = useState<string | null>(null);
  const { pending: busy, error: createError, run } = useAsyncAction();

  const filter = query.trim().toLowerCase();
  // Discards responses that arrive after a newer search started.
  const searchSeq = useRef(0);

  // Server-side typeahead: while open, any query change (including the initial
  // empty query on focus) fetches matches after a debounce.
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

  const hasExact = items.some((o) => o.name.toLowerCase() === filter);
  const showQuickAdd = filter.length > 0 && !hasExact;
  const itemCount = items.length + (showQuickAdd ? 1 : 0);

  function close() {
    setOpen(false);
    setQuery("");
    setHighlight(-1);
  }

  // Clicking anywhere outside the combobox closes it without selecting.
  useEffect(() => {
    if (!open) return;
    function onDocMouseDown(event: MouseEvent) {
      if (!rootRef.current?.contains(event.target as Node)) close();
    }
    document.addEventListener("mousedown", onDocMouseDown);
    return () => document.removeEventListener("mousedown", onDocMouseDown);
  }, [open]);

  function pick(option: ComboboxOption) {
    onChange(option);
    close();
  }

  function quickAdd() {
    const name = query.trim();
    if (!name || busy) return;
    // A failed create (duplicate name, network) shows a message instead of
    // silently doing nothing and leaving the field un-added.
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
        if (highlight < items.length) pick(items[highlight]);
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
      <input
        id={id}
        role="combobox"
        aria-label={label}
        aria-expanded={open}
        aria-controls={listboxId}
        aria-required={required}
        autoComplete="off"
        value={open ? query : (value?.name ?? "")}
        placeholder={`Select ${label.toLowerCase()}`}
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
          {items.map((option, index) => (
            <li
              key={option.id}
              role="option"
              aria-selected={option.id === value?.id}
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
                highlight === items.length ? "bg-admin-raised" : ""
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
