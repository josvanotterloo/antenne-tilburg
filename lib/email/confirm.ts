import { EMAIL, wrapEmail } from "./theme";

// Double opt-in confirmation email: a single button linking to the confirm route.
export function renderConfirmEmail({ confirmUrl }: { confirmUrl: string }): string {
  const inner = `<h1 style="color:${EMAIL.text};font-size:22px;margin:0 0 16px;">Confirm your subscription</h1>
<p style="color:${EMAIL.text};margin:0 0 24px;">Thanks for signing up to the Antenne Tilburg newsletter. Tap the button below to confirm your email address — the link is valid for 48 hours.</p>
<p style="margin:0 0 24px;"><a href="${confirmUrl}" style="display:inline-block;background:${EMAIL.accent};color:#000000;text-decoration:none;font-weight:700;padding:12px 20px;border-radius:4px;">Confirm subscription</a></p>
<p style="color:${EMAIL.muted};font-size:12px;line-height:1.5;margin:0;">If you did not sign up, you can safely ignore this email.</p>`;
  return wrapEmail(inner);
}
