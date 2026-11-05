"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import type { AdminLocale } from "@prisma/client";

import { apiSend } from "@/lib/api-client";
import { useAsyncAction } from "@/lib/use-async-action";
import { Field } from "@/components/admin/Field";
import { t } from "@/lib/i18n/t";

export interface SupplierFormValues {
  id: string;
  name: string;
  contact: string | null;
}

export function SupplierForm({
  locale,
  supplier,
}: {
  locale: AdminLocale;
  supplier?: SupplierFormValues;
}) {
  const router = useRouter();
  const { pending: saving, error, run } = useAsyncAction();
  const [name, setName] = useState(supplier?.name ?? "");
  const [contact, setContact] = useState(supplier?.contact ?? "");

  function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    run(async () => {
      await apiSend(supplier ? `/api/admin/suppliers/${supplier.id}` : "/api/admin/suppliers", {
        method: supplier ? "PATCH" : "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ name, contact }),
      });
      router.push("/admin/catalog/suppliers");
      router.refresh();
    });
  }

  return (
    <form onSubmit={handleSubmit} className="max-w-xl space-y-4">
      <Field label={t("suppliers.name", locale)} htmlFor="supplier-name">
        <input
          id="supplier-name"
          required
          value={name}
          onChange={(e) => setName(e.target.value)}
          className="w-full rounded border border-admin-hairline px-2 py-1 text-sm"
        />
      </Field>

      <Field label={t("suppliers.contactOptional", locale)} htmlFor="supplier-contact">
        <textarea
          id="supplier-contact"
          rows={2}
          value={contact}
          onChange={(e) => setContact(e.target.value)}
          className="w-full rounded border border-admin-hairline px-2 py-1 text-sm"
        />
      </Field>

      {error && (
        <p role="alert" className="text-sm text-red-400">
          {error}
        </p>
      )}

      <div className="flex gap-2">
        <button
          type="submit"
          disabled={saving}
          className="rounded bg-admin-ink transition-colors duration-150 ease-out hover:bg-signal px-4 py-2 text-sm font-medium text-admin-bg disabled:opacity-60"
        >
          {saving
            ? t("common.saving", locale)
            : supplier
              ? t("suppliers.saveChanges", locale)
              : t("suppliers.createButton", locale)}
        </button>
        <button
          type="button"
          onClick={() => router.push("/admin/catalog/suppliers")}
          className="rounded border border-admin-hairline px-4 py-2 text-sm"
        >
          {t("common.cancel", locale)}
        </button>
      </div>
    </form>
  );
}
