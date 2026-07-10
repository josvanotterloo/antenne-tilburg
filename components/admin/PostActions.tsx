"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

import { apiSend } from "@/lib/api-client";
import { useAsyncAction } from "@/lib/use-async-action";
import type { PostFormValues } from "./PostForm";

// Publish/unpublish toggle + delete for a post list row. The publish toggle
// re-sends the post via PATCH with the flipped status (reusing validation).
// Failures surface a visible alert instead of silently no-op'ing.
export function PostActions({ post }: { post: PostFormValues }) {
  const router = useRouter();
  const { pending, error, run } = useAsyncAction();
  const [confirming, setConfirming] = useState(false);

  function togglePublish() {
    run(async () => {
      await apiSend(`/api/admin/posts/${post.id}`, {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          title: post.title,
          slug: post.slug,
          body: post.body,
          coverImage: post.coverImage,
          seoTitle: post.seoTitle,
          seoDescription: post.seoDescription,
          status: post.status === "PUBLISHED" ? "DRAFT" : "PUBLISHED",
        }),
      });
      router.refresh();
    });
  }

  function remove() {
    run(async () => {
      await apiSend(`/api/admin/posts/${post.id}`, { method: "DELETE" });
      router.refresh();
    });
  }

  return (
    <div className="flex flex-col items-end gap-1">
      <div className="flex justify-end gap-3">
        <button
          type="button"
          onClick={togglePublish}
          disabled={pending}
          className="text-neutral-700 hover:underline disabled:opacity-50"
        >
          {post.status === "PUBLISHED" ? "Unpublish" : "Publish"}
        </button>
        {confirming ? (
          <>
            <button
              type="button"
              onClick={remove}
              disabled={pending}
              className="text-red-600 hover:underline disabled:opacity-50"
            >
              Confirm
            </button>
            <button
              type="button"
              onClick={() => setConfirming(false)}
              className="text-neutral-500 hover:underline"
            >
              Cancel
            </button>
          </>
        ) : (
          <button
            type="button"
            onClick={() => setConfirming(true)}
            className="text-red-600 hover:underline"
          >
            Delete
          </button>
        )}
      </div>
      {error && (
        <p role="alert" className="text-xs text-red-600">
          {error}
        </p>
      )}
    </div>
  );
}
