"use client";

import { useState } from "react";

export interface ReferenceItem {
  id: string;
  name: string;
  productCount: number;
}

export function ReferenceSection({
  title,
  endpoint,
  initialItems,
}: {
  title: string;
  endpoint: string;
  initialItems: ReferenceItem[];
}) {
  const [items, setItems] = useState(initialItems);
  const [newName, setNewName] = useState("");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState("");
  const [error, setError] = useState<string | null>(null);

  async function readError(res: Response, fallback: string) {
    const body = (await res.json().catch(() => null)) as {
      error?: string;
    } | null;
    return body?.error ?? fallback;
  }

  async function handleAdd(event: React.FormEvent) {
    event.preventDefault();
    const name = newName.trim();
    if (!name) return;
    setError(null);

    const res = await fetch(endpoint, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ name }),
    });
    if (!res.ok) {
      setError(await readError(res, "Could not add item"));
      return;
    }
    const created = (await res.json()) as { id: string; name: string };
    setItems((prev) =>
      [...prev, { ...created, productCount: 0 }].sort((a, b) =>
        a.name.localeCompare(b.name),
      ),
    );
    setNewName("");
  }

  async function handleSaveEdit(id: string) {
    const name = editName.trim();
    if (!name) return;
    setError(null);

    const res = await fetch(`${endpoint}/${id}`, {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ name }),
    });
    if (!res.ok) {
      setError(await readError(res, "Could not rename item"));
      return;
    }
    setItems((prev) =>
      prev
        .map((item) => (item.id === id ? { ...item, name } : item))
        .sort((a, b) => a.name.localeCompare(b.name)),
    );
    setEditingId(null);
  }

  async function handleDelete(id: string) {
    setError(null);
    const res = await fetch(`${endpoint}/${id}`, { method: "DELETE" });
    if (!res.ok) {
      setError(await readError(res, "Could not delete item"));
      return;
    }
    setItems((prev) => prev.filter((item) => item.id !== id));
  }

  return (
    <section className="rounded border border-neutral-200 bg-white p-4">
      <h2 className="font-semibold">{title}</h2>

      <form onSubmit={handleAdd} className="mt-3 flex gap-2">
        <input
          value={newName}
          onChange={(e) => setNewName(e.target.value)}
          placeholder={`Add ${title.toLowerCase().replace(/s$/, "")}`}
          aria-label={`New ${title} name`}
          className="flex-1 rounded border border-neutral-300 px-2 py-1 text-sm"
        />
        <button
          type="submit"
          className="rounded bg-neutral-900 px-3 py-1 text-sm text-white"
        >
          Add
        </button>
      </form>

      {error && <p className="mt-2 text-sm text-red-600">{error}</p>}

      <ul className="mt-3 divide-y divide-neutral-100">
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
                  className="flex-1 rounded border border-neutral-300 px-2 py-1"
                />
                <button
                  type="button"
                  onClick={() => handleSaveEdit(item.id)}
                  className="text-neutral-700 hover:underline"
                >
                  Save
                </button>
                <button
                  type="button"
                  onClick={() => setEditingId(null)}
                  className="text-neutral-500 hover:underline"
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
                  className="text-neutral-700 hover:underline"
                >
                  Edit
                </button>
                {item.productCount > 0 ? (
                  <span className="text-neutral-400">
                    In use by {item.productCount} products
                  </span>
                ) : (
                  <button
                    type="button"
                    onClick={() => handleDelete(item.id)}
                    className="text-red-600 hover:underline"
                  >
                    Delete
                  </button>
                )}
              </>
            )}
          </li>
        ))}
      </ul>
    </section>
  );
}
