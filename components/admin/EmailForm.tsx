"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import type { AdminLocale } from "@prisma/client";

import { apiSend } from "@/lib/api-client";
import { useAsyncAction } from "@/lib/use-async-action";
import { t } from "@/lib/i18n/t";
import { mapApiError } from "@/lib/i18n/map-api-error";

export function EmailForm({
  userId,
  email: initial,
  locale,
}: {
  userId: string;
  email: string;
  locale: AdminLocale;
}) {
  const router = useRouter();
  const { pending: saving, error, run } = useAsyncAction();
  const [email, setEmail] = useState(initial);
  const [saved, setSaved] = useState(false);

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSaved(false);
    run(async () => {
      await apiSend(`/api/admin/users/${userId}`, {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ email }),
      });
      setSaved(true);
      router.refresh();
    });
  }

  return (
    <form onSubmit={handleSubmit} className="max-w-sm space-y-2">
      <h2 className="font-semibold">{t("emailForm.heading", locale)}</h2>
      <input
        type="email"
        required
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        aria-label={t("emailForm.accountEmailLabel", locale)}
        className="w-full rounded border border-admin-hairline px-2 py-1 text-sm"
      />
      {error && (
        <p role="alert" className="text-sm text-red-400">
          {mapApiError(error, locale)}
        </p>
      )}
      {saved && (
        <p className="text-sm text-green-400">
          {t("emailForm.savedMessage", locale)}
        </p>
      )}
      <button
        type="submit"
        disabled={saving}
        className="rounded bg-admin-ink transition-colors duration-150 ease-out hover:bg-signal px-3 py-1.5 text-sm text-admin-bg disabled:opacity-60"
      >
        {saving ? t("common.saving", locale) : t("emailForm.submitButton", locale)}
      </button>
    </form>
  );
}
