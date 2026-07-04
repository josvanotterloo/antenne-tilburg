"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export function EmailForm({
  userId,
  email: initial,
}: {
  userId: string;
  email: string;
}) {
  const router = useRouter();
  const [email, setEmail] = useState(initial);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError(null);
    setSaved(false);
    const res = await fetch(`/api/admin/users/${userId}`, {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ email }),
    });
    setSaving(false);
    if (!res.ok) {
      const b = (await res.json().catch(() => null)) as { error?: string } | null;
      setError(b?.error ?? "Could not change email");
      return;
    }
    setSaved(true);
    router.refresh();
  }

  return (
    <form onSubmit={handleSubmit} className="max-w-sm space-y-2">
      <h2 className="font-semibold">Email</h2>
      <input
        type="email"
        required
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        aria-label="Account email"
        className="w-full rounded border border-neutral-300 px-2 py-1 text-sm"
      />
      {error && <p className="text-sm text-red-600">{error}</p>}
      {saved && <p className="text-sm text-green-700">Email updated.</p>}
      <button
        type="submit"
        disabled={saving}
        className="rounded bg-neutral-900 px-3 py-1.5 text-sm text-white disabled:opacity-60"
      >
        {saving ? "Saving…" : "Change email"}
      </button>
    </form>
  );
}
