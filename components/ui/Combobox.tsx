"use client";

import { useId, useMemo, useState } from "react";

import { apiSend } from "@/lib/api-client";
import { useAsyncAction } from "@/lib/use-async-action";

export interface ComboboxOption {
  id: string;
  name: string;
}

export interface ComboboxProps {
  label: string;
  options: ComboboxOption[];
  value: string | null;
  onChange: (id: string) => void;
  createEndpoint: string;
  onCreated?: (option: ComboboxOption) => void;
  required?: boolean;
}

// Single-select combobox: filter existing options, quick-add a new one via POST
// to `createEndpoint`, keyboard navigable (Arrow keys / Enter / Escape).
export function Combobox({
  label,
  options,
  value,
  onChange,
  createEndpoint,
  onCreated,
  required,
}: ComboboxProps) {
  const listboxId = useId();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [highlight, setHighlight] = useState(-1);
  const { pending: busy, error, run } = useAsyncAction();

  const selected = options.find((o) => o.id === value) ?? null;
  const filter = query.trim().toLowerCase();

  const filtered = useMemo(
    () => options.filter((o) => o.name.toLowerCase().includes(filter)),
    [options, filter],
  );
  const hasExact = options.some((o) => o.name.toLowerCase() === filter);
  const showQuickAdd = filter.length > 0 && !hasExact;
  const itemCount = filtered.length + (showQuickAdd ? 1 : 0);

  function close() {
    setOpen(false);
    setQuery("");
    setHighlight(-1);
  }

  function pick(option: ComboboxOption) {
    onChange(option.id);
    close();
  }

  function quickAdd() {
    const name = query.trim();
    if (!name || busy) return;
    // A failed create (duplicate name, network) now shows a message instead of
    // silently doing nothing and leaving the field un-added.
    run(async () => {
      const created = await apiSend<ComboboxOption>(createEndpoint, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ name }),
      });
      onCreated?.(created);
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
        if (highlight < filtered.length) pick(filtered[highlight]);
        else if (showQuickAdd) void quickAdd();
        break;
      case "Escape":
        event.preventDefault();
        close();
        break;
    }
  }

  return (
    <div className="relative">
      <input
        role="combobox"
        aria-label={label}
        aria-expanded={open}
        aria-controls={listboxId}
        aria-required={required}
        autoComplete="off"
        value={open ? query : (selected?.name ?? "")}
        placeholder={`Select ${label.toLowerCase()}`}
        onFocus={() => setOpen(true)}
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
          {filtered.map((option, index) => (
            <li
              key={option.id}
              role="option"
              aria-selected={option.id === value}
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
                highlight === filtered.length ? "bg-admin-raised" : ""
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
