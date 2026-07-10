import { EMAIL } from "@/lib/email/theme";

// Minimal self-contained HTML response for newsletter confirm / unsubscribe links,
// which open directly in the browser. Styled to match the dark site chrome.
export function newsletterPage(
  status: number,
  title: string,
  message: string,
  // Optional call-to-action HTML (e.g. a POST form) inserted above the back
  // link. Caller-built, trusted markup — never interpolate user input into it.
  actionHtml = "",
): Response {
  const html = `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>${title} — Antenne Tilburg</title></head>
<body style="margin:0;background:${EMAIL.bg};color:${EMAIL.text};font-family:${EMAIL.sans};">
<main style="max-width:480px;margin:0 auto;padding:80px 24px;text-align:center;">
<h1 style="font-size:22px;margin:0 0 12px;">${title}</h1>
<p style="color:${EMAIL.muted};line-height:1.6;margin:0 0 24px;">${message}</p>
${actionHtml}
<a href="/" style="color:${EMAIL.accent};text-decoration:underline;">Back to antenne-tilburg.nl</a>
</main>
</body></html>`;
  return new Response(html, {
    status,
    headers: { "content-type": "text/html; charset=utf-8" },
  });
}
