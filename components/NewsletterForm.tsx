"use client";

import { useId, useState } from "react";

type Status = "idle" | "submitting" | "success" | "error";

const labelClass =
  "font-mono text-xs font-medium uppercase tracking-[0.04em] text-ink-muted";
const inputClass =
  "w-full border border-hairline bg-canvas px-3 py-2 font-mono text-sm text-ink placeholder:text-ink-muted focus-visible:border-signal";

export default function NewsletterForm() {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [status, setStatus] = useState<Status>("idle");
  const [error, setError] = useState("");
  // Unique per instance so the form is safe to render more than once per page
  // (e.g. the newsletter page and the site footer).
  const uid = useId();

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setStatus("submitting");
    setError("");
    try {
      const res = await fetch("/api/newsletter", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, email }),
      });
      if (res.ok) {
        setStatus("success");
        return;
      }
      const data = await res.json().catch(() => ({}));
      setError(data.error ?? "Something went wrong. Please try again.");
      setStatus("error");
    } catch {
      setError("Couldn't reach the server. Please try again.");
      setStatus("error");
    }
  }

  if (status === "success") {
    return (
      <p
        role="status"
        className="border border-hairline bg-surface px-4 py-6 font-mono text-sm text-ink"
      >
        Thanks — you&rsquo;re on the list. We&rsquo;ll be in touch when something
        good lands.
      </p>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="max-w-md space-y-4" noValidate>
      <div className="space-y-1">
        <label htmlFor={`${uid}-name`} className={labelClass}>
          Name
        </label>
        <input
          id={`${uid}-name`}
          name="name"
          value={name}
          onChange={(e) => setName(e.target.value)}
          required
          autoComplete="name"
          className={inputClass}
        />
      </div>

      <div className="space-y-1">
        <label htmlFor={`${uid}-email`} className={labelClass}>
          Email
        </label>
        <input
          id={`${uid}-email`}
          name="email"
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          required
          autoComplete="email"
          className={inputClass}
        />
      </div>

      {status === "error" && (
        <p role="alert" className="font-mono text-sm text-signal">
          {error}
        </p>
      )}

      <button
        type="submit"
        disabled={status === "submitting"}
        className="border border-ink bg-ink px-5 py-2 font-mono text-xs font-medium uppercase tracking-[0.04em] text-canvas transition-colors hover:border-signal hover:bg-signal disabled:opacity-60"
      >
        {status === "submitting" ? "Signing up…" : "Sign up"}
      </button>
    </form>
  );
}
