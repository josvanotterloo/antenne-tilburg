import { db } from "@/lib/db";
import { shopDateISO, weekRange } from "@/lib/catalog";
import { NewsletterComposer } from "@/components/admin/NewsletterComposer";

export const dynamic = "force-dynamic";

export default async function NewNewsletterPage() {
  // Header/footer come back pre-filled from the persisted template; the
  // arrivals range defaults to Monday of the current shop week → today.
  const template = await db.newsletterTemplate.findUnique({
    where: { id: "singleton" },
  });
  const now = new Date();

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">New newsletter</h1>
        <p className="text-sm text-admin-ink-muted">
          Header and footer are remembered between newsletters. Sends to all
          confirmed subscribers when you hit Send.
        </p>
      </div>
      <NewsletterComposer
        initialHeader={template?.headerText ?? ""}
        initialFooter={template?.footerText ?? ""}
        defaultFrom={shopDateISO(weekRange(0, now).start)}
        defaultTo={shopDateISO(now)}
      />
    </div>
  );
}
