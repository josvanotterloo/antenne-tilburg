"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

import { Combobox, type ComboboxOption } from "@/components/ui/Combobox";

export interface ProductFormValues {
  id: string;
  artist: string;
  title: string;
  catalogNumber: string | null;
  labelId: string;
  genreId: string;
  productTypeId: string;
  condition: "NEW" | "SECONDHAND";
  price: string;
  description: string | null;
  quantity: number;
}

interface ProductFormProps {
  labels: ComboboxOption[];
  genres: ComboboxOption[];
  productTypes: ComboboxOption[];
  product?: ProductFormValues;
}

export function ProductForm({
  labels,
  genres,
  productTypes,
  product,
}: ProductFormProps) {
  const router = useRouter();

  // Local option lists so combobox quick-add can append new entries.
  const [labelOptions, setLabelOptions] = useState(labels);
  const [genreOptions, setGenreOptions] = useState(genres);
  const [typeOptions, setTypeOptions] = useState(productTypes);

  const [artist, setArtist] = useState(product?.artist ?? "");
  const [title, setTitle] = useState(product?.title ?? "");
  const [catalogNumber, setCatalogNumber] = useState(
    product?.catalogNumber ?? "",
  );
  const [labelId, setLabelId] = useState<string | null>(
    product?.labelId ?? null,
  );
  const [genreId, setGenreId] = useState<string | null>(
    product?.genreId ?? null,
  );
  const [productTypeId, setProductTypeId] = useState<string | null>(
    product?.productTypeId ?? null,
  );
  const [condition, setCondition] = useState<"NEW" | "SECONDHAND">(
    product?.condition ?? "NEW",
  );
  const [price, setPrice] = useState(product?.price ?? "");
  const [description, setDescription] = useState(product?.description ?? "");
  // New products default to 1 (in stock); existing keep their quantity.
  const [quantity, setQuantity] = useState(
    product?.quantity != null ? String(product.quantity) : "1",
  );

  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [selling, setSelling] = useState(false);

  // Quick "sold one" on the edit page. Syncs the quantity input from the route's
  // authoritative result so a later Save can't overwrite the decrement.
  async function handleSellOne() {
    if (!product) return;
    setSelling(true);
    setError(null);
    const res = await fetch(`/api/admin/products/${product.id}/sell-one`, {
      method: "POST",
    });
    setSelling(false);
    if (!res.ok) {
      setError("Could not update stock");
      return;
    }
    const updated = (await res.json()) as { quantity: number };
    setQuantity(String(updated.quantity));
  }

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    setError(null);
    setSubmitting(true);

    const res = await fetch(
      product ? `/api/admin/products/${product.id}` : "/api/admin/products",
      {
        method: product ? "PATCH" : "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          artist,
          title,
          catalogNumber,
          labelId,
          genreId,
          productTypeId,
          condition,
          price,
          description,
          quantity,
        }),
      },
    );
    setSubmitting(false);

    if (!res.ok) {
      const body = (await res.json().catch(() => null)) as {
        error?: string;
      } | null;
      setError(body?.error ?? "Could not save product");
      return;
    }

    router.push("/admin/catalog");
    router.refresh();
  }

  return (
    <form onSubmit={handleSubmit} className="max-w-xl space-y-4">
      <Field label="Artist">
        <input
          required
          value={artist}
          onChange={(e) => setArtist(e.target.value)}
          className="w-full rounded border border-neutral-300 px-2 py-1 text-sm"
        />
      </Field>

      <Field label="Title">
        <input
          required
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          className="w-full rounded border border-neutral-300 px-2 py-1 text-sm"
        />
      </Field>

      <Field label="Catalog number">
        <input
          value={catalogNumber}
          onChange={(e) => setCatalogNumber(e.target.value)}
          className="w-full rounded border border-neutral-300 px-2 py-1 text-sm"
        />
      </Field>

      <Field label="Label">
        <Combobox
          label="Label"
          options={labelOptions}
          value={labelId}
          onChange={setLabelId}
          createEndpoint="/api/admin/labels"
          onCreated={(o) => setLabelOptions((prev) => [...prev, o])}
          required
        />
      </Field>

      <Field label="Genre">
        <Combobox
          label="Genre"
          options={genreOptions}
          value={genreId}
          onChange={setGenreId}
          createEndpoint="/api/admin/genres"
          onCreated={(o) => setGenreOptions((prev) => [...prev, o])}
          required
        />
      </Field>

      <Field label="Product type">
        <Combobox
          label="Product type"
          options={typeOptions}
          value={productTypeId}
          onChange={setProductTypeId}
          createEndpoint="/api/admin/product-types"
          onCreated={(o) => setTypeOptions((prev) => [...prev, o])}
          required
        />
      </Field>

      <Field label="Condition">
        <div className="flex gap-2">
          {(["NEW", "SECONDHAND"] as const).map((c) => (
            <button
              key={c}
              type="button"
              onClick={() => setCondition(c)}
              className={`rounded border px-3 py-1 text-sm ${
                condition === c
                  ? "border-neutral-900 bg-neutral-900 text-white"
                  : "border-neutral-300"
              }`}
            >
              {c}
            </button>
          ))}
        </div>
      </Field>

      <Field label="Price (€)">
        <input
          type="number"
          min="0"
          step="0.01"
          required
          value={price}
          onChange={(e) => setPrice(e.target.value)}
          className="w-32 rounded border border-neutral-300 px-2 py-1 text-sm"
        />
      </Field>

      <Field label="Description">
        <textarea
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          rows={3}
          className="w-full rounded border border-neutral-300 px-2 py-1 text-sm"
        />
      </Field>

      <Field label="Quantity in stock">
        <input
          type="number"
          min="0"
          step="1"
          required
          value={quantity}
          onChange={(e) => setQuantity(e.target.value)}
          className="w-32 rounded border border-neutral-300 px-2 py-1 text-sm"
        />
        <p className="text-xs text-neutral-500">
          Sets availability automatically — 0 hides the product from the shop.
        </p>
        {product && (
          <button
            type="button"
            onClick={handleSellOne}
            disabled={selling || Number(quantity) <= 0}
            className="mt-1 rounded border border-neutral-300 px-2 py-1 text-xs hover:bg-neutral-100 disabled:opacity-40"
          >
            {selling ? "…" : "Sell one"}
          </button>
        )}
      </Field>

      {error && <p className="text-sm text-red-600">{error}</p>}

      <div className="flex gap-2">
        <button
          type="submit"
          disabled={submitting}
          className="rounded bg-neutral-900 px-4 py-2 text-sm font-medium text-white disabled:opacity-60"
        >
          {submitting ? "Saving…" : product ? "Save changes" : "Add product"}
        </button>
        <button
          type="button"
          onClick={() => router.push("/admin/catalog")}
          className="rounded border border-neutral-300 px-4 py-2 text-sm"
        >
          Cancel
        </button>
      </div>
    </form>
  );
}

function Field({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-1">
      <span className="block text-sm font-medium">{label}</span>
      {children}
    </div>
  );
}
