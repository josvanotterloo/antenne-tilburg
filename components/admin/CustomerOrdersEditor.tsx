"use client";

import { useState } from "react";

import { apiSend } from "@/lib/api-client";
import { useAsyncAction } from "@/lib/use-async-action";
import { PostBody } from "@/components/PostBody";

export function CustomerOrdersEditor({
  initialContent,
}: {
  initialContent: string;
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
            {save.pending ? "Saving…" : "Save"}
          </button>
          {saved && !save.pending && (
            <span className="text-sm text-admin-ink-muted">✓ Saved</span>
          )}
        </div>
        {save.error && (
          <p role="alert" className="text-sm text-red-400">
            {save.error}
          </p>
        )}
      </div>

      <div className="space-y-2">
        <h2 className="text-sm font-medium text-admin-ink-muted">Preview</h2>
        <div className="rounded border border-admin-hairline p-4">
          <PostBody body={content} />
        </div>
      </div>
    </div>
  );
}
