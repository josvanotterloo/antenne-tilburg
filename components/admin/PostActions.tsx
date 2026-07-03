"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

import type { PostFormValues } from "./PostForm";

// Publish/unpublish toggle + delete for a post list row. The publish toggle
// re-sends the post via PATCH with the flipped status (reusing validation).
export function PostActions({ post }: { post: PostFormValues }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [confirming, setConfirming] = useState(false);

  async function togglePublish() {
    setBusy(true);
    const res = await fetch(`/api/admin/posts/${post.id}`, {
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
    setBusy(false);
    if (res.ok) router.refresh();
  }

  async function remove() {
    setBusy(true);
    const res = await fetch(`/api/admin/posts/${post.id}`, {
      method: "DELETE",
    });
    setBusy(false);
    if (res.ok) router.refresh();
  }

  return (
    <div className="flex justify-end gap-3">
      <button
        type="button"
        onClick={togglePublish}
        disabled={busy}
        className="text-neutral-700 hover:underline disabled:opacity-50"
      >
        {post.status === "PUBLISHED" ? "Unpublish" : "Publish"}
      </button>
      {confirming ? (
        <>
          <button
            type="button"
            onClick={remove}
            disabled={busy}
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
  );
}
