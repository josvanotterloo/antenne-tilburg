import { EMAIL } from "@/lib/email/theme";
import { db } from "@/lib/db";
import { newsletterPage } from "@/lib/newsletter-page";

// Unsubscribe reuses the subscriber's confirmToken as the unsubscribe token.
// The actual deletion happens on POST, never GET: email clients and security
// scanners (Outlook SafeLinks, Gmail, antivirus proxies) prefetch link URLs
// with GET, which would otherwise silently remove subscribers. GET only renders
// a confirmation page whose button POSTs back here.

const tokenParam = (req: Request) =>
  new URL(req.url).searchParams.get("token");

// GET: show a confirmation page (no side effects — prefetch-safe).
export async function GET(req: Request) {
  const token = tokenParam(req);
  if (!token) {
    return newsletterPage(404, "Invalid link", "This unsubscribe link is not valid.");
  }

  const subscriber = await db.newsletterSubscriber.findUnique({
    where: { confirmToken: token },
  });
  if (!subscriber) {
    return newsletterPage(404, "Invalid link", "This unsubscribe link is not valid.");
  }

  // A POST form so only a deliberate human click deletes — token stays in the
  // action URL (it's already the same token the recipient was emailed).
  const form = `<form method="post" action="/api/newsletter/unsubscribe?token=${encodeURIComponent(token)}" style="margin:0 0 24px;">
<button type="submit" style="display:inline-block;background:${EMAIL.accent};color:#000;text-decoration:none;font-weight:700;padding:12px 20px;border:none;border-radius:4px;cursor:pointer;font-size:15px;">Confirm unsubscribe</button>
</form>`;
  return newsletterPage(
    200,
    "Unsubscribe?",
    "Click below to stop receiving the Antenne Tilburg newsletter.",
    form,
  );
}

// POST: perform the unsubscribe.
export async function POST(req: Request) {
  const token = tokenParam(req);
  if (!token) {
    return newsletterPage(404, "Invalid link", "This unsubscribe link is not valid.");
  }

  const subscriber = await db.newsletterSubscriber.findUnique({
    where: { confirmToken: token },
  });
  if (!subscriber) {
    return newsletterPage(404, "Invalid link", "This unsubscribe link is not valid.");
  }

  try {
    await db.newsletterSubscriber.delete({ where: { id: subscriber.id } });
  } catch (error) {
    // Double-submit / concurrent unsubscribe: the row is already gone. That is
    // the desired end state — treat it as success, not a 500.
    if ((error as { code?: string } | null)?.code !== "P2025") {
      throw error;
    }
  }

  return newsletterPage(
    200,
    "Unsubscribed",
    "You have been removed from the Antenne Tilburg newsletter. Sorry to see you go.",
  );
}
