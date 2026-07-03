"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export interface EventFormValues {
  id: string;
  title: string;
  slug: string;
  date: string; // datetime-local value: YYYY-MM-DDTHH:mm
  description: string | null;
  image: string | null;
  location: string;
  seoTitle: string | null;
  seoDescription: string | null;
}

export function EventForm({ event }: { event?: EventFormValues }) {
  const router = useRouter();
  const [title, setTitle] = useState(event?.title ?? "");
  const [slug, setSlug] = useState(event?.slug ?? "");
  const [date, setDate] = useState(event?.date ?? "");
  const [description, setDescription] = useState(event?.description ?? "");
  const [image, setImage] = useState(event?.image ?? "");
  const [location, setLocation] = useState(event?.location ?? "");
  const [seoTitle, setSeoTitle] = useState(event?.seoTitle ?? "");
  const [seoDescription, setSeoDescription] = useState(
    event?.seoDescription ?? "",
  );
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSaving(true);
    const res = await fetch(
      event ? `/api/admin/events/${event.id}` : "/api/admin/events",
      {
        method: event ? "PATCH" : "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          title,
          slug,
          date,
          description,
          image,
          location,
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
      setError(b?.error ?? "Could not save event");
      return;
    }
    router.push("/admin/content/events");
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
      <Field label="Date & time">
        <input
          type="datetime-local"
          required
          value={date}
          onChange={(e) => setDate(e.target.value)}
          className="rounded border border-neutral-300 px-2 py-1 text-sm"
        />
        <span className="text-xs text-neutral-500">
          Upcoming/past is derived from this date.
        </span>
      </Field>
      <Field label="Location">
        <input
          value={location}
          onChange={(e) => setLocation(e.target.value)}
          placeholder="Antenne / Sam-Sam, Tilburg"
          className="w-full rounded border border-neutral-300 px-2 py-1 text-sm"
        />
      </Field>
      <Field label="Description">
        <textarea
          rows={5}
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          className="w-full rounded border border-neutral-300 px-2 py-1 text-sm"
        />
      </Field>
      <Field label="Image URL">
        <input
          value={image}
          onChange={(e) => setImage(e.target.value)}
          className="w-full rounded border border-neutral-300 px-2 py-1 text-sm"
        />
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
          {saving ? "Saving…" : event ? "Save changes" : "Create event"}
        </button>
        <button
          type="button"
          onClick={() => router.push("/admin/content/events")}
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
