"use client";

import { useState } from "react";

import { PostBody } from "@/components/PostBody";

type Status = "idle" | "sending" | "sent" | "error";

export function NewsletterComposer() {
  const [subject, setSubject] = useState("");
  const [body, setBody] = useState("");
  const [showPreview, setShowPreview] = useState(false);
  const [status, setStatus] = useState<Status>("idle");
  const [result, setResult] = useState<{ sent: number; failed: number } | null>(
    null,
  );
  const [error, setError] = useState("");

  async function handleSend(event: React.FormEvent) {
    event.preventDefault();
    setStatus("sending");
    setError("");
    try {
      const res = await fetch("/api/admin/newsletter/send", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ subject, body }),
      });
      const data = (await res.json().catch(() => ({}))) as {
        sent?: number;
        failed?: number;
        error?: string;
      };
      if (res.ok) {
        setResult({ sent: data.sent ?? 0, failed: data.failed ?? 0 });
        setStatus("sent");
        return;
      }
      setError(data.error ?? "Could not send the newsletter.");
      setStatus("error");
    } catch {
      setError("Couldn't reach the server. Please try again.");
      setStatus("error");
    }
  }

  return (
    <form onSubmit={handleSend} className="max-w-2xl space-y-4">
      <div className="space-y-1">
        <label htmlFor="subject" className="block text-sm font-medium">
          Subject
        </label>
        <input
          id="subject"
          required
          value={subject}
          onChange={(e) => setSubject(e.target.value)}
          className="w-full rounded border border-neutral-300 px-2 py-1 text-sm"
        />
      </div>

      <div className="space-y-1">
        <label htmlFor="body" className="block text-sm font-medium">
          Body (markdown)
        </label>
        <textarea
          id="body"
          required
          rows={12}
          value={body}
          onChange={(e) => setBody(e.target.value)}
          className="w-full rounded border border-neutral-300 px-2 py-1 font-mono text-sm"
        />
      </div>

      <div className="flex gap-2">
        <button
          type="button"
          onClick={() => setShowPreview((p) => !p)}
          className="rounded border border-neutral-300 px-4 py-2 text-sm"
        >
          {showPreview ? "Hide preview" : "Preview"}
        </button>
        <button
          type="submit"
          disabled={status === "sending"}
          className="rounded bg-neutral-900 px-4 py-2 text-sm font-medium text-white disabled:opacity-60"
        >
          {status === "sending" ? "Sending…" : "Send newsletter"}
        </button>
      </div>

      {status === "sent" && result && (
        <p role="status" className="text-sm text-green-700">
          Sent to {result.sent} subscriber{result.sent === 1 ? "" : "s"}.
          {result.failed > 0 ? ` ${result.failed} failed.` : ""}
        </p>
      )}
      {status === "error" && (
        <p role="alert" className="text-sm text-red-600">
          {error}
        </p>
      )}

      {showPreview && (
        <div className="rounded border border-neutral-200 bg-canvas p-4">
          <p className="mb-3 text-xs uppercase tracking-wide text-ink-muted">
            Email preview
          </p>
          <PostBody body={body} />
        </div>
      )}
    </form>
  );
}
