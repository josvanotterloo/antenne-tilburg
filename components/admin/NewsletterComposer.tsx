"use client";

import { useState } from "react";

import { apiSend } from "@/lib/api-client";
import { useAsyncAction } from "@/lib/use-async-action";
import { arrivalsText, type ArrivalsGroup } from "@/lib/newsletter-arrivals";
import { SHOP, SOCIAL_LINKS } from "@/lib/shop-info";
import { PostBody } from "@/components/PostBody";
import { Field } from "@/components/admin/Field";

type Status = "idle" | "sending" | "sent" | "error";

// Structured newsletter builder: Header (persisted template) → New Arrivals
// (auto-loaded from the catalog for a date range) → Footer (persisted
// template). The server re-assembles the email from the same inputs on send.
export function NewsletterComposer({
  initialHeader,
  initialFooter,
  defaultFrom,
  defaultTo,
}: {
  initialHeader: string;
  initialFooter: string;
  defaultFrom: string;
  defaultTo: string;
}) {
  const [subject, setSubject] = useState("");
  const [header, setHeader] = useState(initialHeader);
  const [footer, setFooter] = useState(initialFooter);
  const [from, setFrom] = useState(defaultFrom);
  const [to, setTo] = useState(defaultTo);
  const [groups, setGroups] = useState<ArrivalsGroup[] | null>(null);
  const [showPreview, setShowPreview] = useState(false);

  const arrivals = useAsyncAction();
  const template = useAsyncAction();
  const [templateSaved, setTemplateSaved] = useState(false);

  const [status, setStatus] = useState<Status>("idle");
  const [result, setResult] = useState<{ sent: number; failed: number } | null>(
    null,
  );
  const [sendError, setSendError] = useState("");

  function loadArrivals() {
    setGroups(null);
    arrivals.run(async () => {
      const data = await apiSend<ArrivalsGroup[]>(
        `/api/admin/newsletter/arrivals?from=${encodeURIComponent(from)}&to=${encodeURIComponent(to)}`,
      );
      setGroups(data);
    });
  }

  function saveTemplate() {
    setTemplateSaved(false);
    template.run(async () => {
      await apiSend("/api/admin/newsletter/template", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ headerText: header, footerText: footer }),
      });
      setTemplateSaved(true);
    });
  }

  async function handleSend(event: React.FormEvent) {
    event.preventDefault();
    setStatus("sending");
    setSendError("");
    try {
      const res = await fetch("/api/admin/newsletter/send", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ subject, header, footer, from, to }),
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
      setSendError(data.error ?? "Could not send the newsletter.");
      setStatus("error");
    } catch {
      setSendError("Couldn't reach the server. Please try again.");
      setStatus("error");
    }
  }

  const arrivalsBlock = groups ? arrivalsText(groups) : "";
  const actionError = arrivals.error ?? template.error;

  return (
    <form onSubmit={handleSend} className="max-w-2xl space-y-6">
      <Field label="Subject" htmlFor="subject">
        <input
          id="subject"
          required
          value={subject}
          onChange={(e) => setSubject(e.target.value)}
          className="w-full rounded border border-admin-hairline px-2 py-1 text-sm"
        />
      </Field>

      {/* Part 1 — Header (persisted template) */}
      <Field label="Header (markdown)" htmlFor="header">
        <textarea
          id="header"
          rows={5}
          value={header}
          onChange={(e) => setHeader(e.target.value)}
          className="w-full rounded border border-admin-hairline px-2 py-1 font-mono text-sm"
        />
        <p className="text-xs text-admin-ink-muted">
          Remembered between newsletters. Social links (Facebook, Instagram,
          SoundCloud) are appended automatically.
        </p>
      </Field>

      {/* Part 2 — New arrivals, auto-populated from the catalog */}
      <div className="space-y-2 rounded border border-admin-hairline p-3">
        <span className="block text-sm font-medium">New arrivals</span>
        <div className="flex flex-wrap items-end gap-3">
          <Field label="From" htmlFor="from">
            <input
              id="from"
              type="date"
              value={from}
              onChange={(e) => setFrom(e.target.value)}
              className="rounded border border-admin-hairline px-2 py-1 text-sm"
            />
          </Field>
          <Field label="To" htmlFor="to">
            <input
              id="to"
              type="date"
              value={to}
              onChange={(e) => setTo(e.target.value)}
              className="rounded border border-admin-hairline px-2 py-1 text-sm"
            />
          </Field>
          <button
            type="button"
            onClick={loadArrivals}
            disabled={arrivals.pending}
            className="rounded border border-admin-hairline px-3 py-1.5 text-sm hover:bg-admin-raised disabled:opacity-60"
          >
            {arrivals.pending ? "Loading…" : "Load arrivals"}
          </button>
        </div>
        {groups &&
          (groups.length === 0 ? (
            <p className="text-sm text-admin-ink-muted">
              No arrivals in this range.
            </p>
          ) : (
            <pre className="overflow-x-auto rounded bg-admin-bg p-3 font-mono text-xs leading-5">
              {arrivalsBlock}
            </pre>
          ))}
      </div>

      {/* Part 3 — Footer (persisted template) */}
      <Field label="Footer (markdown)" htmlFor="footer">
        <textarea
          id="footer"
          rows={5}
          value={footer}
          onChange={(e) => setFooter(e.target.value)}
          className="w-full rounded border border-admin-hairline px-2 py-1 font-mono text-sm"
        />
        <p className="text-xs text-admin-ink-muted">
          Shop news + sign-off. The contact block (address, phone) is appended
          automatically.
        </p>
      </Field>

      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          onClick={saveTemplate}
          disabled={template.pending}
          className="rounded border border-admin-hairline px-4 py-2 text-sm hover:bg-admin-raised disabled:opacity-60"
        >
          {template.pending ? "Saving…" : "Save template"}
        </button>
        <button
          type="button"
          onClick={() => setShowPreview((p) => !p)}
          className="rounded border border-admin-hairline px-4 py-2 text-sm"
        >
          {showPreview ? "Hide preview" : "Preview"}
        </button>
        <button
          type="submit"
          // Disabled while sending AND after a successful send — the same
          // composition stays on screen, so a stray click would re-blast the
          // whole list. Composing a new one is a fresh page load.
          disabled={status === "sending" || status === "sent"}
          className="rounded bg-admin-ink transition-colors duration-150 ease-out hover:bg-signal px-4 py-2 text-sm font-medium text-admin-bg disabled:opacity-60"
        >
          {status === "sending"
            ? "Sending…"
            : status === "sent"
              ? "Sent"
              : "Send newsletter"}
        </button>
      </div>

      {templateSaved && (
        <p role="status" className="text-sm text-green-400">
          Template saved.
        </p>
      )}
      {status === "sent" && result && (
        <p role="status" className="text-sm text-green-400">
          Sent to {result.sent} subscriber{result.sent === 1 ? "" : "s"}.
          {result.failed > 0 ? ` ${result.failed} failed.` : ""}
        </p>
      )}
      {(status === "error" || actionError) && (
        <p role="alert" className="text-sm text-red-400">
          {status === "error" ? sendError : actionError}
        </p>
      )}

      {showPreview && (
        <div
          data-testid="newsletter-preview"
          className="space-y-4 rounded border border-admin-hairline bg-canvas p-4"
        >
          <p className="text-xs uppercase tracking-wide text-ink-muted">
            Email preview
          </p>
          <PostBody body={header} />
          <div className="space-y-0.5 text-sm">
            {SOCIAL_LINKS.map((s) => (
              <p key={s.label} className="text-signal">
                {s.href}
              </p>
            ))}
          </div>
          <h2 className="text-lg font-semibold text-ink">New arrivals</h2>
          {arrivalsBlock ? (
            <pre className="overflow-x-auto font-mono text-xs leading-5 text-ink">
              {arrivalsBlock}
            </pre>
          ) : (
            <p className="text-sm text-ink-muted">
              No arrivals loaded — use Load arrivals above.
            </p>
          )}
          <PostBody body={footer} />
          <p className="border-t border-hairline pt-3 text-xs text-ink-muted">
            {SHOP.name} · {SHOP.addressLine} · {SHOP.addressNote} · {SHOP.phone}
          </p>
        </div>
      )}
    </form>
  );
}
