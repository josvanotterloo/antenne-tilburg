"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import type { AdminLocale } from "@prisma/client";

import { apiSend } from "@/lib/api-client";
import { useAsyncAction } from "@/lib/use-async-action";
import { imageMarkdown, insertAt } from "@/lib/markdown";
import { t } from "@/lib/i18n/t";
import { postStatusLabel } from "@/lib/i18n/enum-labels";
import { Field } from "@/components/admin/Field";

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

export function PostForm({
  post,
  locale,
}: {
  post?: PostFormValues;
  locale: AdminLocale;
}) {
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
  // Two independent actions so uploading an image and saving the post track
  // their own pending/error state (and neither disables the other's button).
  const upload = useAsyncAction();
  const save = useAsyncAction();
  const uploading = upload.pending;
  const saving = save.pending;
  const error = save.error ?? upload.error;
  const bodyRef = useRef<HTMLTextAreaElement>(null);

  function handleImageUpload(event: React.ChangeEvent<HTMLInputElement>) {
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
    });
  }

  function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    save.run(async () => {
      await apiSend(post ? `/api/admin/posts/${post.id}` : "/api/admin/posts", {
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
      });
      router.push("/admin/content/posts");
      router.refresh();
    });
  }

  return (
    <form onSubmit={handleSubmit} className="max-w-2xl space-y-4">
      <Field label={t("postForm.titleLabel", locale)} htmlFor="title">
        <input
          id="title"
          required
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          className="w-full rounded border border-admin-hairline px-2 py-1 text-sm"
        />
      </Field>
      <Field label={t("postForm.slugLabel", locale)} htmlFor="slug">
        <input
          id="slug"
          value={slug}
          onChange={(e) => setSlug(e.target.value)}
          placeholder="auto"
          className="w-full rounded border border-admin-hairline px-2 py-1 text-sm"
        />
      </Field>
      <Field label={t("postForm.bodyLabel", locale)} htmlFor="body">
        <textarea
          id="body"
          ref={bodyRef}
          required
          rows={10}
          value={body}
          onChange={(e) => setBody(e.target.value)}
          className="w-full rounded border border-admin-hairline px-2 py-1 font-mono text-sm"
        />
        <label className="mt-1 flex flex-wrap items-center gap-2 text-sm text-admin-ink-muted">
          <span className="cursor-pointer rounded border border-admin-hairline px-2 py-1 hover:bg-admin-raised">
            {uploading ? t("productForm.uploading", locale) : t("postForm.insertImage", locale)}
          </span>
          <input
            type="file"
            accept="image/jpeg,image/png,image/webp,image/gif"
            onChange={handleImageUpload}
            disabled={uploading}
            className="sr-only"
          />
          <span className="text-xs text-admin-ink-muted">
            {t("postForm.imageHint", locale)}
          </span>
        </label>
      </Field>
      <Field label={t("postForm.coverImageLabel", locale)} htmlFor="cover-image">
        <input
          id="cover-image"
          value={coverImage}
          onChange={(e) => setCoverImage(e.target.value)}
          className="w-full rounded border border-admin-hairline px-2 py-1 text-sm"
        />
      </Field>
      <Field label={t("postForm.statusLabel", locale)}>
        <div className="flex gap-2">
          {(["DRAFT", "PUBLISHED"] as const).map((s) => (
            <button
              key={s}
              type="button"
              onClick={() => setStatus(s)}
              className={`whitespace-nowrap rounded border px-3 py-1 text-sm ${
                status === s
                  ? "border-admin-ink bg-admin-ink text-admin-bg"
                  : "border-admin-hairline"
              }`}
            >
              {postStatusLabel(s, locale)}
            </button>
          ))}
        </div>
      </Field>
      <Field label={t("postForm.seoTitleLabel", locale)} htmlFor="seo-title">
        <input
          id="seo-title"
          value={seoTitle}
          onChange={(e) => setSeoTitle(e.target.value)}
          className="w-full rounded border border-admin-hairline px-2 py-1 text-sm"
        />
      </Field>
      <Field label={t("postForm.seoDescriptionLabel", locale)} htmlFor="seo-description">
        <textarea
          id="seo-description"
          rows={2}
          value={seoDescription}
          onChange={(e) => setSeoDescription(e.target.value)}
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
            : post
              ? t("common.saveChanges", locale)
              : t("postForm.createButton", locale)}
        </button>
        <button
          type="button"
          onClick={() => router.push("/admin/content/posts")}
          className="rounded border border-admin-hairline px-4 py-2 text-sm"
        >
          {t("common.cancel", locale)}
        </button>
      </div>
    </form>
  );
}
