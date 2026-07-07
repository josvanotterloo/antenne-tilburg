import { db } from "@/lib/db";
import { newsletterPage } from "@/lib/newsletter-page";

const EXPIRY_MS = 48 * 60 * 60 * 1000;

// Double opt-in confirmation link. GET so it works from an email client.
export async function GET(req: Request) {
  const token = new URL(req.url).searchParams.get("token");
  if (!token) {
    return newsletterPage(404, "Invalid link", "This confirmation link is not valid.");
  }

  const subscriber = await db.newsletterSubscriber.findUnique({
    where: { confirmToken: token },
  });
  if (!subscriber) {
    return newsletterPage(404, "Invalid link", "This confirmation link is not valid.");
  }

  if (Date.now() - new Date(subscriber.createdAt).getTime() > EXPIRY_MS) {
    return newsletterPage(
      400,
      "Link expired",
      "This confirmation link has expired. Please sign up again to receive a fresh one.",
    );
  }

  // Idempotent: confirming an already-confirmed subscriber is still a success.
  if (subscriber.status !== "CONFIRMED") {
    await db.newsletterSubscriber.update({
      where: { id: subscriber.id },
      data: { status: "CONFIRMED" },
    });
  }

  return newsletterPage(
    200,
    "Subscription confirmed",
    "You are now subscribed to the Antenne Tilburg newsletter.",
  );
}
