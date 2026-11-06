import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { shopDateISO, weekRange } from "@/lib/catalog";
import { t } from "@/lib/i18n/t";
import { NewsletterComposer } from "@/components/admin/NewsletterComposer";

export const dynamic = "force-dynamic";

export default async function NewNewsletterPage() {
  const session = await auth();
  const locale = session!.user.locale;
  // Header/footer come back pre-filled from the persisted template; the
  // arrivals range defaults to Monday of the current shop week → today.
  const template = await db.newsletterTemplate.findUnique({
    where: { id: "singleton" },
  });
  const now = new Date();

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">{t("newsletter.title", locale)}</h1>
        <p className="text-sm text-admin-ink-muted">{t("newsletter.subtitle", locale)}</p>
      </div>
      <NewsletterComposer
        initialHeader={template?.headerText ?? ""}
        initialFooter={template?.footerText ?? ""}
        defaultFrom={shopDateISO(weekRange(0, now).start)}
        defaultTo={shopDateISO(now)}
        locale={locale}
      />
    </div>
  );
}
