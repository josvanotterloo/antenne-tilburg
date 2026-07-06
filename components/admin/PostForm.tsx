"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";

import { imageMarkdown, insertAt } from "@/lib/markdown";

export interface PostFormValues {
  id: string;
  title: string;
  slug: string;
  body: string;
  coverImage: string | null;
  status: "DRAFT" | "PUBLISHED";
  seoTitle: string | null;
  seoDescription: string | null;
}

export function PostForm({ post }: { post?: PostFormValues }) {
  const router = useRouter();
  const [title, setTitle] = useState(post?.title ?? "");
  const [slug, setSlug] = useState(post?.slug ?? "");
  const [body, setBody] = useState(post?.body ?? "");
  const [coverImage, setCoverImage] = useState(post?.coverImage ?? "");
  const [status, setStatus] = useState<"DRAFT" | "PUBLISHED">(
    post?.status ?? "DRAFT",
  );
  const [seoTitle, setSeoTitle] = useState(post?.seoTitle ?? "");
  const [seoDescription, setSeoDescription] = useState(
    post?.seoDescription ?? "",
  );
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const bodyRef = useRef<HTMLTextAreaElement>(null);

  async function handleImageUpload(
    event: React.ChangeEvent<HTMLInputElement>,
  ) {
    const file = event.target.files?.[0];
    event.target.value = ""; // allow re-picking the same file
    if (!file) return;
    setUploading(true);
    setError(null);
    const form = new FormData();
    form.set("file", file);
    const res = await fetch("/api/admin/uploads", { method: "POST", body: form });
    setUploading(false);
    if (!res.ok) {
      const b = (await res.json().catch(() => null)) as { error?: string } | null;
      setError(b?.error ?? "Could not upload image");
      return;
    }
    const { url } = (await res.json()) as { url: string };
    const textarea = bodyRef.current;
    const start = textarea?.selectionStart ?? body.length;
    const end = textarea?.selectionEnd ?? body.length;
    const snippet = imageMarkdown(url);
    setBody((current) => insertAt(current, start, end, snippet));
    // Restore focus and place the cursor after the inserted image.
    requestAnimationFrame(() => {
      if (!textarea) return;
      const pos = start + snippet.length;
      textarea.focus();
      textarea.setSelectionRange(pos, pos);
    });
  }

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    setError(null);
    setSaving(true);
    const res = await fetch(
      post ? `/api/admin/posts/${post.id}` : "/api/admin/posts",
      {
        method: post ? "PATCH" : "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          title,
          slug,
          body,
          coverImage,
          status,
          seoTitle,
          seoDescription,
        }),
      },
    );
    setSaving(false);
    if (!res.ok) {
      const b = (await res.json().catch(() => null)) as {
        error?: string;
      } | null;
      setError(b?.error ?? "Could not save post");
      return;
    }
    router.push("/admin/content/posts");
    router.refresh();
  }

  return (
    <form onSubmit={handleSubmit} className="max-w-2xl space-y-4">
      <Field label="Title">
        <input
          required
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          className="w-full rounded border border-neutral-300 px-2 py-1 text-sm"
        />
      </Field>
      <Field label="Slug (optional — derived from title)">
        <input
          value={slug}
          onChange={(e) => setSlug(e.target.value)}
          placeholder="auto"
          className="w-full rounded border border-neutral-300 px-2 py-1 text-sm"
        />
      </Field>
      <Field label="Body (markdown)">
        <textarea
          ref={bodyRef}
          required
          rows={10}
          value={body}
          onChange={(e) => setBody(e.target.value)}
          className="w-full rounded border border-neutral-300 px-2 py-1 font-mono text-sm"
        />
        <label className="mt-1 flex flex-wrap items-center gap-2 text-sm text-neutral-600">
          <span className="cursor-pointer rounded border border-neutral-300 px-2 py-1 hover:bg-neutral-50">
            {uploading ? "Uploading…" : "Insert image"}
          </span>
          <input
            type="file"
            accept="image/jpeg,image/png,image/webp,image/gif"
            onChange={handleImageUpload}
            disabled={uploading}
            className="sr-only"
          />
          <span className="text-xs text-neutral-400">
            JPG/PNG/WebP/GIF · max 5 MB · inserted at the cursor
          </span>
        </label>
      </Field>
      <Field label="Cover image URL">
        <input
          value={coverImage}
          onChange={(e) => setCoverImage(e.target.value)}
          className="w-full rounded border border-neutral-300 px-2 py-1 text-sm"
        />
      </Field>
      <Field label="Status">
        <div className="flex gap-2">
          {(["DRAFT", "PUBLISHED"] as const).map((s) => (
            <button
              key={s}
              type="button"
              onClick={() => setStatus(s)}
              className={`rounded border px-3 py-1 text-sm ${
                status === s
                  ? "border-neutral-900 bg-neutral-900 text-white"
                  : "border-neutral-300"
              }`}
            >
              {s}
            </button>
          ))}
        </div>
      </Field>
      <Field label="SEO title (optional)">
        <input
          value={seoTitle}
          onChange={(e) => setSeoTitle(e.target.value)}
          className="w-full rounded border border-neutral-300 px-2 py-1 text-sm"
        />
      </Field>
      <Field label="SEO description (optional)">
        <textarea
          rows={2}
          value={seoDescription}
          onChange={(e) => setSeoDescription(e.target.value)}
          className="w-full rounded border border-neutral-300 px-2 py-1 text-sm"
        />
      </Field>

      {error && <p className="text-sm text-red-600">{error}</p>}

      <div className="flex gap-2">
        <button
          type="submit"
          disabled={saving}
          className="rounded bg-neutral-900 px-4 py-2 text-sm font-medium text-white disabled:opacity-60"
        >
          {saving ? "Saving…" : post ? "Save changes" : "Create post"}
        </button>
        <button
          type="button"
          onClick={() => router.push("/admin/content/posts")}
          className="rounded border border-neutral-300 px-4 py-2 text-sm"
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
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-1">
      <span className="block text-sm font-medium">{label}</span>
      {children}
    </div>
  );
}
