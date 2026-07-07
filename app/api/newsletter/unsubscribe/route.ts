import { db } from "@/lib/db";
import { newsletterPage } from "@/lib/newsletter-page";

// One-click unsubscribe. GET so it works straight from an email footer link.
// Reuses the subscriber's confirmToken as the unsubscribe token.
export async function GET(req: Request) {
  const token = new URL(req.url).searchParams.get("token");
  if (!token) {
    return newsletterPage(404, "Invalid link", "This unsubscribe link is not valid.");
  }

  const subscriber = await db.newsletterSubscriber.findUnique({
    where: { confirmToken: token },
  });
  if (!subscriber) {
    return newsletterPage(404, "Invalid link", "This unsubscribe link is not valid.");
  }

  await db.newsletterSubscriber.delete({ where: { id: subscriber.id } });

  return newsletterPage(
    200,
    "Unsubscribed",
    "You have been removed from the Antenne Tilburg newsletter. Sorry to see you go.",
  );
}
