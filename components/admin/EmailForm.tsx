"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

import { apiSend } from "@/lib/api-client";
import { useAsyncAction } from "@/lib/use-async-action";

export function EmailForm({
  userId,
  email: initial,
}: {
  userId: string;
  email: string;
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
      <h2 className="font-semibold">Email</h2>
      <input
        type="email"
        required
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        aria-label="Account email"
        className="w-full rounded border border-neutral-300 px-2 py-1 text-sm"
      />
      {error && (
        <p role="alert" className="text-sm text-red-600">
          {error}
        </p>
      )}
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
