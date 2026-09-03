"use client";

import { useId, useState } from "react";

type Status = "idle" | "submitting" | "success" | "error";

const labelClass =
  "font-mono text-xs font-medium uppercase tracking-[0.04em] text-ink-muted";
const inputClass =
  "w-full border border-hairline bg-canvas px-3 py-1.5 font-mono text-sm text-ink transition-colors duration-150 ease-out placeholder:text-ink-muted focus-visible:border-signal";

export default function NewsletterForm() {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [status, setStatus] = useState<Status>("idle");
  const [error, setError] = useState("");
  const [successMessage, setSuccessMessage] = useState("");
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
      const data = await res.json().catch(() => ({}));
      if (res.ok) {
        setSuccessMessage(
          data.message ??
            "Almost there — check your email to confirm your subscription. The link is valid for 48 hours.",
        );
        setStatus("success");
        return;
      }
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
        {successMessage}
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
        className="w-full border border-hairline bg-canvas px-5 py-1.5 font-mono text-xs font-medium uppercase tracking-[0.06em] text-ink transition-colors duration-150 ease-out hover:border-signal hover:text-signal disabled:opacity-60"
      >
        {status === "submitting" ? "Signing up…" : "Sign up"}
      </button>
    </form>
  );
}
