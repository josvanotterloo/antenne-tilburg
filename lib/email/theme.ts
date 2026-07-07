// Shared palette + HTML shell for outgoing emails. Colours mirror DESIGN.md; all
// styling is inline because email clients strip <link> and most <style> blocks.
export const EMAIL = {
  bg: "#000000",
  panel: "#111111",
  hairline: "#222222",
  text: "#ffffff",
  muted: "#9BA1AC",
  accent: "#6B7DC9",
  // Font names are single-quoted so the stacks stay valid when interpolated raw
  // into a double-quoted style="" attribute (double quotes would break the attr).
  mono: "'JetBrains Mono', ui-monospace, SFMono-Regular, Menlo, monospace",
  sans: "ui-sans-serif, -apple-system, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif",
} as const;

// Escape a plain string for safe interpolation into HTML markup.
export function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

// Wrap inner HTML in a centered, dark, 600px-max email shell.
export function wrapEmail(inner: string): string {
  return `<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"></head>
<body style="margin:0;padding:0;background:${EMAIL.bg};">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:${EMAIL.bg};">
<tr><td align="center" style="padding:32px 16px;">
<table role="presentation" width="600" cellpadding="0" cellspacing="0" style="width:100%;max-width:600px;">
<tr><td style="font-family:${EMAIL.sans};color:${EMAIL.text};font-size:15px;line-height:1.6;">
${inner}
</td></tr>
</table>
</td></tr>
</table>
</body></html>`;
}
