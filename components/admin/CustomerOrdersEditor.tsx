"use client";

import { useState } from "react";
import type { AdminLocale } from "@prisma/client";

import { apiSend } from "@/lib/api-client";
import { useAsyncAction } from "@/lib/use-async-action";
import { t } from "@/lib/i18n/t";
import { PostBody } from "@/components/PostBody";

// PostBody is shared with the public blog post page — add no text or props
// to it. Any new admin-only chrome (like the Preview label below) stays
// in this file. `content` itself is admin-authored markdown that becomes
// the actual customer-orders page text, so it is never translated.
export function CustomerOrdersEditor({
  initialContent,
  locale,
}: {
  initialContent: string;
  locale: AdminLocale;
}) {
  const [content, setContent] = useState(initialContent);
  const [saved, setSaved] = useState(false);
  const save = useAsyncAction();

  function handleSave() {
    save.run(async () => {
      await apiSend("/api/admin/customer-orders", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ content }),
      });
      setSaved(true);
    });
  }

  return (
    <div className="space-y-6">
      <div className="space-y-2">
        <textarea
          value={content}
          onChange={(e) => {
            setContent(e.target.value);
            setSaved(false);
          }}
          rows={20}
          className="w-full rounded border border-admin-hairline p-3 font-mono text-sm"
        />
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={handleSave}
            disabled={save.pending}
            className="rounded bg-admin-ink transition-colors duration-150 ease-out hover:bg-signal px-4 py-2 text-sm font-medium text-admin-bg disabled:opacity-60"
          >
            {save.pending ? t("common.saving", locale) : t("common.save", locale)}
          </button>
          {saved && !save.pending && (
            <span className="text-sm text-admin-ink-muted">
              {t("customerOrders.savedIndicator", locale)}
            </span>
          )}
        </div>
        {save.error && (
          <p role="alert" className="text-sm text-red-400">
            {save.error}
          </p>
        )}
      </div>

      <div className="space-y-2">
        <h2 className="text-sm font-medium text-admin-ink-muted">
          {t("customerOrders.preview", locale)}
        </h2>
        <div className="rounded border border-admin-hairline p-4">
          <PostBody body={content} />
        </div>
      </div>
    </div>
  );
}
