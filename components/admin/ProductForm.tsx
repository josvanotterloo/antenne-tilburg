"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import type { AdminLocale } from "@prisma/client";

import { apiSend } from "@/lib/api-client";
import { useAsyncAction } from "@/lib/use-async-action";
import { t } from "@/lib/i18n/t";
import { conditionLabel } from "@/lib/i18n/enum-labels";
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
  // Ordered — position in this array is the sort order (see
  // lib/catalog.ts's joinGenreNames and dymo-label.ts's primary-genre pick).
  genres: ComboboxOption[];
  productType: ComboboxOption;
  supplier: ComboboxOption | null;
  condition: "NEW" | "SECONDHAND";
  price: string;
  description: string | null;
  coverImage: string | null;
  quantity: number;
  isVariousArtists: boolean;
  contents: string | null;
}

interface ProductFormProps {
  product?: ProductFormValues;
  locale: AdminLocale;
}

export function ProductForm({ product, locale }: ProductFormProps) {
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
  const [genres, setGenres] = useState<ComboboxOption[]>(
    product?.genres ?? [],
  );
  const [productType, setProductType] = useState<ComboboxOption | null>(
    product?.productType ?? null,
  );
  const [supplier, setSupplier] = useState<ComboboxOption | null>(
    product?.supplier ?? null,
  );
  const [condition, setCondition] = useState<"NEW" | "SECONDHAND">(
    product?.condition ?? "NEW",
  );
  const [price, setPrice] = useState(product?.price ?? "");
  const [description, setDescription] = useState(product?.description ?? "");
  const [coverImage, setCoverImage] = useState(product?.coverImage ?? "");
  // Default 1 on create (spec-admin-stock-artist.md A1) — a brand-new product
  // should be visible by default; 0 is an explicit, adjustable choice for
  // "coming soon".
  const [quantity, setQuantity] = useState(product?.quantity ?? 1);
  const [isVariousArtists, setIsVariousArtists] = useState(
    product?.isVariousArtists ?? false,
  );
  const [contents, setContents] = useState(product?.contents ?? "");

  // Independent actions: saving the product and each quick stock op track
  // their own pending/error so none disables another's button.
  const submit = useAsyncAction();
  const sell = useAsyncAction();
  const plusOne = useAsyncAction();
  const upload = useAsyncAction();
  const submitting = submit.pending;
  const selling = sell.pending;
  const addingOne = plusOne.pending;
  const uploading = upload.pending;
  const error = submit.error ?? sell.error ?? plusOne.error ?? upload.error;

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

  // Mirrors handleSellOne — same single-unit, no-reason stock op, just +1
  // instead of -1 (spec-admin-stock-artist.md A3).
  function handlePlusOne() {
    if (!product) return;
    plusOne.run(async () => {
      const updated = await apiSend<{ quantity: number }>(
        `/api/admin/products/${product.id}/plus-one`,
        { method: "POST" },
      );
      setQuantity(updated.quantity);
    });
  }

  // Unchecking clears contents and empties the artist selection — the admin
  // must re-pick real artist(s) before saving (MultiCombobox's own
  // `required` hidden input already blocks submit until they do).
  function handleVariousArtistsToggle(checked: boolean) {
    setIsVariousArtists(checked);
    if (!checked) {
      setContents("");
      setArtists([]);
    }
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
            genreIds: genres.map((g) => g.id),
            productTypeId: productType?.id ?? null,
            supplierId: supplier?.id ?? null,
            condition,
            price,
            description,
            coverImage,
            isVariousArtists,
            contents,
            ...(product ? {} : { quantity }),
          }),
        },
      );
      router.push("/admin/catalog");
      router.refresh();
    });
  }

  // Localized field labels, reused both for each <Field>'s visible text and
  // for the Combobox/MultiCombobox's own label (drives its aria-label).
  const artistsLabel = t("productForm.artists", locale);
  const labelFieldLabel = t("productForm.label", locale);
  const genresLabel = t("productForm.genres", locale);
  const productTypeLabel = t("productForm.productType", locale);
  const supplierFieldLabel = t("suppliers.supplierLabel", locale);

  // Shared across every Combobox/MultiCombobox on this form — same wording
  // pattern regardless of entity.
  const comboboxSearchError = t("combobox.searchError", locale);
  const comboboxQuickAdd = (query: string) =>
    locale === "EN" ? `+ Add "${query}"` : `+ "${query}" toevoegen`;
  const comboboxSelectPlaceholder = (fieldLabel: string) =>
    `${t("combobox.select", locale)} ${fieldLabel.toLowerCase()}`;
  const multiComboboxLabels = {
    searchError: comboboxSearchError,
    quickAdd: comboboxQuickAdd,
    moveUp: (name: string) =>
      `${t("combobox.moveUp", locale)} ${name} ${t("combobox.directionUp", locale)}`,
    moveDown: (name: string) =>
      `${t("combobox.moveUp", locale)} ${name} ${t("combobox.directionDown", locale)}`,
    remove: (name: string) => `${t("common.remove", locale)} ${name}`,
  };

  return (
    <form
      onSubmit={handleSubmit}
      className="grid max-w-3xl grid-cols-1 gap-4 md:grid-cols-2"
    >
      {!isVariousArtists && (
        <Field label={artistsLabel} htmlFor="artists">
          <MultiCombobox
            id="artists"
            label={artistsLabel}
            endpoint="/api/admin/artists"
            selected={artists}
            onChange={setArtists}
            required
            labels={{
              ...multiComboboxLabels,
              placeholder: t("productForm.artistsPlaceholder", locale),
            }}
          />
        </Field>
      )}

      <Field label={t("productForm.variousArtists", locale)} htmlFor="various-artists">
        <input
          id="various-artists"
          type="checkbox"
          checked={isVariousArtists}
          onChange={(e) => handleVariousArtistsToggle(e.target.checked)}
        />
      </Field>

      {isVariousArtists && (
        <Field
          label={t("productForm.artistsOnRelease", locale)}
          htmlFor="contents"
          className="md:col-span-2"
        >
          <textarea
            id="contents"
            value={contents}
            onChange={(e) => setContents(e.target.value)}
            placeholder="Surgeon, Regis, Author, The Envoy"
            rows={2}
            className="w-full rounded border border-admin-hairline px-2 py-1 text-sm"
          />
        </Field>
      )}

      <Field label={t("productForm.title", locale)} htmlFor="product-title">
        <input
          id="product-title"
          required
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          className="w-full rounded border border-admin-hairline px-2 py-1 text-sm"
        />
      </Field>

      <Field label={labelFieldLabel} htmlFor="label">
        <Combobox
          id="label"
          label={labelFieldLabel}
          endpoint="/api/admin/labels"
          value={label}
          labels={{
            searchError: comboboxSearchError,
            quickAdd: comboboxQuickAdd,
            placeholder: comboboxSelectPlaceholder(labelFieldLabel),
          }}
          onChange={(option) => {
            setLabel(option);
            // Opportunistic prefill: only on create, and only if the admin
            // hasn't already picked a supplier — never overwrite a manual pick.
            if (!product && !supplier) {
              const withSupplier = option as ComboboxOption & {
                supplierId?: string | null;
                supplierName?: string | null;
              };
              if (withSupplier.supplierId) {
                setSupplier({
                  id: withSupplier.supplierId,
                  name: withSupplier.supplierName ?? "",
                });
              }
            }
          }}
          required
        />
      </Field>

      <Field label={genresLabel} htmlFor="genres">
        <MultiCombobox
          id="genres"
          label={genresLabel}
          endpoint="/api/admin/genres"
          selected={genres}
          onChange={setGenres}
          required
          labels={{
            ...multiComboboxLabels,
            placeholder: t("productForm.genresPlaceholder", locale),
          }}
        />
      </Field>

      <Field label={productTypeLabel} htmlFor="product-type">
        <Combobox
          id="product-type"
          label={productTypeLabel}
          endpoint="/api/admin/product-types"
          value={productType}
          onChange={setProductType}
          required
          labels={{
            searchError: comboboxSearchError,
            quickAdd: comboboxQuickAdd,
            placeholder: comboboxSelectPlaceholder(productTypeLabel),
          }}
        />
      </Field>

      <Field label={supplierFieldLabel} htmlFor="supplier">
        <Combobox
          id="supplier"
          label={supplierFieldLabel}
          endpoint="/api/admin/suppliers"
          value={supplier}
          onChange={setSupplier}
          allowCreate={false}
          labels={{
            searchError: comboboxSearchError,
            quickAdd: comboboxQuickAdd,
            placeholder: comboboxSelectPlaceholder(supplierFieldLabel),
          }}
        />
      </Field>

      <Field label={t("productForm.condition", locale)}>
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
              {conditionLabel(c, locale)}
            </button>
          ))}
        </div>
      </Field>

      <Field label={t("productForm.price", locale)} htmlFor="price">
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

      {product ? (
        <Field label={t("productForm.quantityInStock", locale)}>
          <p className="text-lg font-semibold tabular-nums">{quantity}</p>
          <p className="text-xs text-admin-ink-muted">
            {t("productForm.quantityHintEdit", locale)}
          </p>
          <div className="mt-1 flex items-center gap-2">
            <button
              type="button"
              onClick={handleSellOne}
              disabled={selling || quantity <= 0}
              className="rounded border border-admin-hairline px-2 py-1 text-xs hover:bg-admin-raised disabled:opacity-40"
            >
              {selling ? "…" : t("products.sellOne", locale)}
            </button>
            <button
              type="button"
              onClick={handlePlusOne}
              disabled={addingOne}
              className="rounded border border-admin-hairline px-2 py-1 text-xs hover:bg-admin-raised disabled:opacity-40"
            >
              {addingOne ? "…" : "+1"}
            </button>
            <AdjustStockForm productId={product.id} onAdjusted={setQuantity} locale={locale} />
          </div>
        </Field>
      ) : (
        <Field label={t("productForm.quantity", locale)} htmlFor="quantity">
          <input
            id="quantity"
            type="number"
            min="0"
            step="1"
            value={quantity}
            onChange={(e) => setQuantity(Math.max(0, Number(e.target.value) || 0))}
            className="w-24 rounded border border-admin-hairline px-2 py-1 text-sm"
          />
          <p className="text-xs text-admin-ink-muted">
            {t("productForm.quantityHintCreate", locale)}
          </p>
        </Field>
      )}

      <Field label={t("productForm.catalogNumber", locale)} htmlFor="catalog-number">
        <input
          id="catalog-number"
          value={catalogNumber}
          onChange={(e) => setCatalogNumber(e.target.value)}
          className="w-full rounded border border-admin-hairline px-2 py-1 text-sm"
        />
      </Field>

      <Field label={t("productForm.description", locale)} htmlFor="description" className="md:col-span-2">
        <textarea
          id="description"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          rows={3}
          className="w-full rounded border border-admin-hairline px-2 py-1 text-sm"
        />
      </Field>

      <Field label={t("productForm.coverImage", locale)} htmlFor="cover-image" className="md:col-span-2">
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
          {uploading && (
            <span className="text-admin-ink-muted">{t("productForm.uploading", locale)}</span>
          )}
          {coverImage && !uploading && (
            <button
              type="button"
              onClick={() => setCoverImage("")}
              className="rounded border border-admin-hairline px-2 py-1 text-xs hover:bg-admin-raised"
            >
              {t("common.remove", locale)}
            </button>
          )}
        </div>
        <p className="text-xs text-admin-ink-muted">{t("productForm.coverHint", locale)}</p>
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
          {submitting
            ? t("common.saving", locale)
            : product
              ? t("common.saveChanges", locale)
              : t("products.addButton", locale)}
        </button>
        <button
          type="button"
          onClick={() => router.push("/admin/catalog")}
          className="rounded border border-admin-hairline px-4 py-2 text-sm"
        >
          {t("common.cancel", locale)}
        </button>
      </div>
    </form>
  );
}
