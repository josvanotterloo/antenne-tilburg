"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

import { apiSend } from "@/lib/api-client";
import { useAsyncAction } from "@/lib/use-async-action";
import { Combobox, type ComboboxOption } from "@/components/ui/Combobox";
import { MultiCombobox } from "@/components/ui/MultiCombobox";
import { Field } from "@/components/admin/Field";
import { AdjustStockForm } from "@/components/admin/AdjustStockForm";

export interface ProductFormValues {
  id: string;
  // Ordered — position in this array is the display/sort order (see
  // lib/catalog.ts's joinArtistNames and Product.primaryArtistName).
  artists: ComboboxOption[];
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
  coverImage: string | null;
  quantity: number;
}

interface ProductFormProps {
  product?: ProductFormValues;
}

export function ProductForm({ product }: ProductFormProps) {
  const router = useRouter();

  const [artists, setArtists] = useState<ComboboxOption[]>(
    product?.artists ?? [],
  );
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
  const [coverImage, setCoverImage] = useState(product?.coverImage ?? "");
  const [quantity, setQuantity] = useState(product?.quantity ?? 0);

  // Independent actions: saving the product and the quick "sell one" each track
  // their own pending/error so neither disables the other's button.
  const submit = useAsyncAction();
  const sell = useAsyncAction();
  const upload = useAsyncAction();
  const submitting = submit.pending;
  const selling = sell.pending;
  const uploading = upload.pending;
  const error = submit.error ?? sell.error ?? upload.error;

  // Same upload contract as blog post images: POST the file, store the URL.
  function handleCoverUpload(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = ""; // allow re-picking the same file
    if (!file) return;
    upload.run(async () => {
      const form = new FormData();
      form.set("file", file);
      const { url } = await apiSend<{ url: string }>("/api/admin/uploads", {
        method: "POST",
        body: form,
      });
      setCoverImage(url);
    });
  }

  // Quick "sold one" on the edit page. Syncs the quantity input from the route's
  // authoritative result so a later Save can't overwrite the decrement.
  function handleSellOne() {
    if (!product) return;
    sell.run(async () => {
      const updated = await apiSend<{ quantity: number }>(
        `/api/admin/products/${product.id}/sell-one`,
        { method: "POST" },
      );
      setQuantity(updated.quantity);
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
            artistIds: artists.map((a) => a.id),
            title,
            catalogNumber,
            labelId: label?.id ?? null,
            genreId: genre?.id ?? null,
            productTypeId: productType?.id ?? null,
            condition,
            price,
            description,
            coverImage,
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
      <Field label="Artists" htmlFor="artists">
        <MultiCombobox
          id="artists"
          label="Artists"
          endpoint="/api/admin/artists"
          selected={artists}
          onChange={setArtists}
          required
        />
      </Field>

      <Field label="Title" htmlFor="product-title">
        <input
          id="product-title"
          required
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          className="w-full rounded border border-admin-hairline px-2 py-1 text-sm"
        />
      </Field>

      <Field label="Label" htmlFor="label">
        <Combobox
          id="label"
          label="Label"
          endpoint="/api/admin/labels"
          value={label}
          onChange={setLabel}
          required
        />
      </Field>

      <Field label="Genre" htmlFor="genre">
        <Combobox
          id="genre"
          label="Genre"
          endpoint="/api/admin/genres"
          value={genre}
          onChange={setGenre}
          required
        />
      </Field>

      <Field label="Product type" htmlFor="product-type">
        <Combobox
          id="product-type"
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

      <Field label="Price (€)" htmlFor="price">
        <input
          id="price"
          type="number"
          min="0"
          step="0.01"
          required
          value={price}
          onChange={(e) => setPrice(e.target.value)}
          className="w-32 rounded border border-admin-hairline px-2 py-1 text-sm"
        />
      </Field>

      {product && (
        <Field label="Quantity in stock">
          <p className="text-lg font-semibold tabular-nums">{quantity}</p>
          <p className="text-xs text-admin-ink-muted">
            Derived from stock transactions — 0 hides the product from the shop.
          </p>
          <div className="mt-1 flex items-center gap-2">
            <button
              type="button"
              onClick={handleSellOne}
              disabled={selling || quantity <= 0}
              className="rounded border border-admin-hairline px-2 py-1 text-xs hover:bg-admin-raised disabled:opacity-40"
            >
              {selling ? "…" : "Sell one"}
            </button>
            <AdjustStockForm productId={product.id} onAdjusted={setQuantity} />
          </div>
        </Field>
      )}

      <Field label="Catalog number" htmlFor="catalog-number">
        <input
          id="catalog-number"
          value={catalogNumber}
          onChange={(e) => setCatalogNumber(e.target.value)}
          className="w-full rounded border border-admin-hairline px-2 py-1 text-sm"
        />
      </Field>

      <Field label="Description" htmlFor="description" className="md:col-span-2">
        <textarea
          id="description"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          rows={3}
          className="w-full rounded border border-admin-hairline px-2 py-1 text-sm"
        />
      </Field>

      <Field label="Cover image" htmlFor="cover-image" className="md:col-span-2">
        {coverImage && (
          // Plain <img>: local admin preview of an /uploads file with arbitrary
          // dimensions; next/image optimization buys nothing here.
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={coverImage}
            alt="Cover image preview"
            className="max-h-40 rounded border border-admin-hairline"
          />
        )}
        <div className="flex flex-wrap items-center gap-2 text-sm">
          <input
            id="cover-image"
            type="file"
            accept="image/jpeg,image/png,image/webp,image/gif"
            onChange={handleCoverUpload}
            disabled={uploading}
            className="text-sm text-admin-ink-muted"
          />
          {uploading && <span className="text-admin-ink-muted">Uploading…</span>}
          {coverImage && !uploading && (
            <button
              type="button"
              onClick={() => setCoverImage("")}
              className="rounded border border-admin-hairline px-2 py-1 text-xs hover:bg-admin-raised"
            >
              Remove
            </button>
          )}
        </div>
        <p className="text-xs text-admin-ink-muted">
          JPG/PNG/WebP/GIF · max 5 MB · not shown on the public site yet
        </p>
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
