"use client";

import { useState } from "react";
import type { AdminLocale } from "@prisma/client";

import { apiSend } from "@/lib/api-client";
import { useAsyncAction } from "@/lib/use-async-action";
import { t } from "@/lib/i18n/t";
import { mapApiError } from "@/lib/i18n/map-api-error";

export function PasswordForm({
  userId,
  locale,
}: {
  userId: string;
  locale: AdminLocale;
}) {
  const { pending: saving, error, run } = useAsyncAction();
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [done, setDone] = useState(false);

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setDone(false);
    run(async () => {
      await apiSend(`/api/admin/users/${userId}/password`, {
        method: "PUT",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ currentPassword, newPassword }),
      });
      setCurrentPassword("");
      setNewPassword("");
      setDone(true);
    });
  }

  return (
    <form onSubmit={handleSubmit} className="max-w-sm space-y-2">
      <h2 className="font-semibold">{t("passwordForm.heading", locale)}</h2>
      <div className="space-y-1">
        <label htmlFor="current" className="text-sm">
          {t("passwordForm.currentLabel", locale)}
        </label>
        <input
          id="current"
          type="password"
          autoComplete="current-password"
          required
          value={currentPassword}
          onChange={(e) => setCurrentPassword(e.target.value)}
          className="w-full rounded border border-admin-hairline px-2 py-1 text-sm"
        />
      </div>
      <div className="space-y-1">
        <label htmlFor="new" className="text-sm">
          {t("passwordForm.newLabel", locale)}
        </label>
        <input
          id="new"
          type="password"
          autoComplete="new-password"
          required
          minLength={8}
          value={newPassword}
          onChange={(e) => setNewPassword(e.target.value)}
          className="w-full rounded border border-admin-hairline px-2 py-1 text-sm"
        />
      </div>
      {error && (
        <p role="alert" className="text-sm text-red-400">
          {mapApiError(error, locale)}
        </p>
      )}
      {done && (
        <p className="text-sm text-green-400">
          {t("passwordForm.savedMessage", locale)}
        </p>
      )}
      <button
        type="submit"
        disabled={saving}
        className="rounded bg-admin-ink transition-colors duration-150 ease-out hover:bg-signal px-3 py-1.5 text-sm text-admin-bg disabled:opacity-60"
      >
        {saving ? t("common.saving", locale) : t("passwordForm.submitButton", locale)}
      </button>
    </form>
  );
}
