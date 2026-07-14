"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

import { apiSend } from "@/lib/api-client";
import { useAsyncAction } from "@/lib/use-async-action";
import { Combobox, type ComboboxOption } from "@/components/ui/Combobox";

export interface ProductFormValues {
  id: string;
  artist: string;
  title: string;
  catalogNumber: string | null;
  // Selected reference options carry the name so the combobox can display it —
  // options are searched server-side, there is no preloaded list to look it up in.
  label: ComboboxOption;
  genre: ComboboxOption;
  productType: ComboboxOption;
  condition: "NEW" | "SECONDHAND";
  price: string;
  description: string | null;
  quantity: number;
}

interface ProductFormProps {
  product?: ProductFormValues;
}

export function ProductForm({ product }: ProductFormProps) {
  const router = useRouter();

  const [artist, setArtist] = useState(product?.artist ?? "");
  const [title, setTitle] = useState(product?.title ?? "");
  const [catalogNumber, setCatalogNumber] = useState(
    product?.catalogNumber ?? "",
  );
  const [label, setLabel] = useState<ComboboxOption | null>(
    product?.label ?? null,
  );
  const [genre, setGenre] = useState<ComboboxOption | null>(
    product?.genre ?? null,
  );
  const [productType, setProductType] = useState<ComboboxOption | null>(
    product?.productType ?? null,
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

  // Independent actions: saving the product and the quick "sell one" each track
  // their own pending/error so neither disables the other's button.
  const submit = useAsyncAction();
  const sell = useAsyncAction();
  const submitting = submit.pending;
  const selling = sell.pending;
  const error = submit.error ?? sell.error;

  // Quick "sold one" on the edit page. Syncs the quantity input from the route's
  // authoritative result so a later Save can't overwrite the decrement.
  function handleSellOne() {
    if (!product) return;
    sell.run(async () => {
      const updated = await apiSend<{ quantity: number }>(
        `/api/admin/products/${product.id}/sell-one`,
        { method: "POST" },
      );
      setQuantity(String(updated.quantity));
    });
  }

  function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    submit.run(async () => {
      await apiSend(
        product ? `/api/admin/products/${product.id}` : "/api/admin/products",
        {
          method: product ? "PATCH" : "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({
            artist,
            title,
            catalogNumber,
            labelId: label?.id ?? null,
            genreId: genre?.id ?? null,
            productTypeId: productType?.id ?? null,
            condition,
            price,
            description,
            quantity,
          }),
        },
      );
      router.push("/admin/catalog");
      router.refresh();
    });
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="grid max-w-3xl grid-cols-1 gap-4 md:grid-cols-2"
    >
      <Field label="Artist">
        <input
          aria-label="Artist"
          required
          value={artist}
          onChange={(e) => setArtist(e.target.value)}
          className="w-full rounded border border-admin-hairline px-2 py-1 text-sm"
        />
      </Field>

      <Field label="Title">
        <input
          aria-label="Title"
          required
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          className="w-full rounded border border-admin-hairline px-2 py-1 text-sm"
        />
      </Field>

      <Field label="Label">
        <Combobox
          label="Label"
          endpoint="/api/admin/labels"
          value={label}
          onChange={setLabel}
          required
        />
      </Field>

      <Field label="Genre">
        <Combobox
          label="Genre"
          endpoint="/api/admin/genres"
          value={genre}
          onChange={setGenre}
          required
        />
      </Field>

      <Field label="Product type">
        <Combobox
          label="Product type"
          endpoint="/api/admin/product-types"
          value={productType}
          onChange={setProductType}
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
                  ? "border-admin-ink bg-admin-ink text-admin-bg"
                  : "border-admin-hairline"
              }`}
            >
              {c}
            </button>
          ))}
        </div>
      </Field>

      <Field label="Price (€)">
        <input
          aria-label="Price (€)"
          type="number"
          min="0"
          step="0.01"
          required
          value={price}
          onChange={(e) => setPrice(e.target.value)}
          className="w-32 rounded border border-admin-hairline px-2 py-1 text-sm"
        />
      </Field>

      <Field label="Quantity in stock">
        <input
          aria-label="Quantity in stock"
          type="number"
          min="0"
          step="1"
          required
          value={quantity}
          onChange={(e) => setQuantity(e.target.value)}
          className="w-32 rounded border border-admin-hairline px-2 py-1 text-sm"
        />
        <p className="text-xs text-admin-ink-muted">
          Sets availability automatically — 0 hides the product from the shop.
        </p>
        {product && (
          <button
            type="button"
            onClick={handleSellOne}
            disabled={selling || Number(quantity) <= 0}
            className="mt-1 rounded border border-admin-hairline px-2 py-1 text-xs hover:bg-admin-raised disabled:opacity-40"
          >
            {selling ? "…" : "Sell one"}
          </button>
        )}
      </Field>

      <Field label="Catalog number">
        <input
          aria-label="Catalog number"
          value={catalogNumber}
          onChange={(e) => setCatalogNumber(e.target.value)}
          className="w-full rounded border border-admin-hairline px-2 py-1 text-sm"
        />
      </Field>

      <Field label="Description" className="md:col-span-2">
        <textarea
          aria-label="Description"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          rows={3}
          className="w-full rounded border border-admin-hairline px-2 py-1 text-sm"
        />
      </Field>

      {error && (
        <p role="alert" className="text-sm text-red-400 md:col-span-2">
          {error}
        </p>
      )}

      <div className="flex gap-2 md:col-span-2">
        <button
          type="submit"
          disabled={submitting}
          className="rounded bg-admin-ink transition-colors duration-150 ease-out hover:bg-signal px-4 py-2 text-sm font-medium text-admin-bg disabled:opacity-60"
        >
          {submitting ? "Saving…" : product ? "Save changes" : "Add product"}
        </button>
        <button
          type="button"
          onClick={() => router.push("/admin/catalog")}
          className="rounded border border-admin-hairline px-4 py-2 text-sm"
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
  className,
}: {
  label: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={className ? `space-y-1 ${className}` : "space-y-1"}>
      <span className="block text-sm font-medium">{label}</span>
      {children}
    </div>
  );
}
