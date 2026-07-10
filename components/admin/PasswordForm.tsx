"use client";

import { useState } from "react";

import { apiSend } from "@/lib/api-client";
import { useAsyncAction } from "@/lib/use-async-action";

export function PasswordForm({ userId }: { userId: string }) {
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
      <h2 className="font-semibold">Password</h2>
      <div className="space-y-1">
        <label htmlFor="current" className="text-sm">
          Current password
        </label>
        <input
          id="current"
          type="password"
          autoComplete="current-password"
          required
          value={currentPassword}
          onChange={(e) => setCurrentPassword(e.target.value)}
          className="w-full rounded border border-neutral-300 px-2 py-1 text-sm"
        />
      </div>
      <div className="space-y-1">
        <label htmlFor="new" className="text-sm">
          New password (min 8)
        </label>
        <input
          id="new"
          type="password"
          autoComplete="new-password"
          required
          minLength={8}
          value={newPassword}
          onChange={(e) => setNewPassword(e.target.value)}
          className="w-full rounded border border-neutral-300 px-2 py-1 text-sm"
        />
      </div>
      {error && (
        <p role="alert" className="text-sm text-red-600">
          {error}
        </p>
      )}
      {done && <p className="text-sm text-green-700">Password changed.</p>}
      <button
        type="submit"
        disabled={saving}
        className="rounded bg-neutral-900 px-3 py-1.5 text-sm text-white disabled:opacity-60"
      >
        {saving ? "Saving…" : "Change password"}
      </button>
    </form>
  );
}
