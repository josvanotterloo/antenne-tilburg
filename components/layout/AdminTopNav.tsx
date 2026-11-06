"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { signOut, useSession } from "next-auth/react";
import type { AdminLocale } from "@prisma/client";

import { apiSend } from "@/lib/api-client";
import { useAsyncAction } from "@/lib/use-async-action";
import { t, type TranslationKey } from "@/lib/i18n/t";
import { ADMIN_LOCALES } from "@/lib/user-input";

function LanguageSwitch({ current }: { current: AdminLocale }) {
  const { update } = useSession();
  const { run } = useAsyncAction();
  const router = useRouter();

  function switchTo(locale: AdminLocale) {
    if (locale === current) return;
    run(async () => {
      await apiSend("/api/admin/me/locale", {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ locale }),
      });
      await update({ user: { locale } });
      router.refresh();
    });
  }

  return (
    <div className="flex items-center gap-1 text-sm">
      {ADMIN_LOCALES.map((locale) => (
        <button
          key={locale}
          type="button"
          aria-current={locale === current ? "true" : undefined}
          onClick={() => switchTo(locale)}
          className={`rounded px-2 py-1 transition-colors duration-150 ease-out ${
            locale === current
              ? "bg-admin-raised text-admin-ink"
              : "text-admin-ink-muted hover:bg-admin-raised hover:text-admin-ink"
          }`}
        >
          {locale}
        </button>
      ))}
    </div>
  );
}

// Top-level admin sections. `match` decides the active state by path prefix so
// deeper routes (e.g. /admin/catalog/new) still highlight their section.
const SECTIONS: { labelKey: TranslationKey; href: string; match: string }[] = [
  { labelKey: "nav.catalog", href: "/admin/catalog", match: "/admin/catalog" },
  { labelKey: "nav.content", href: "/admin/content/posts", match: "/admin/content" },
  {
    labelKey: "customerOrders.title",
    href: "/admin/orders/customers",
    match: "/admin/orders",
  },
  { labelKey: "nav.settings", href: "/admin/settings/hours", match: "/admin/settings" },
];

export function AdminTopNav() {
  const pathname = usePathname();
  const { data: session } = useSession();
  const locale: AdminLocale = session?.user?.locale ?? "NL";

  // The login page shares the /admin layout but has no chrome (and no session
  // to sign out of).
  if (pathname === "/admin/login") return null;

  return (
    <header className="border-b border-admin-hairline bg-admin-surface text-admin-ink">
      <div className="mx-auto flex h-14 max-w-6xl items-center gap-6 px-4">
        <Link
          href="/admin/catalog"
          className="font-bold tracking-tight transition-colors duration-150 ease-out hover:text-signal"
        >
          Antenne Tilburg
        </Link>

        <nav className="flex items-center gap-1">
          {SECTIONS.map((section) => {
            const active = pathname.startsWith(section.match);
            return (
              <Link
                key={section.href}
                href={section.href}
                aria-current={active ? "page" : undefined}
                className={`rounded px-3 py-1.5 text-sm transition-colors duration-150 ease-out ${
                  active
                    ? "bg-admin-raised text-admin-ink"
                    : "text-admin-ink-muted hover:bg-admin-raised hover:text-admin-ink"
                }`}
              >
                {t(section.labelKey, locale)}
              </Link>
            );
          })}
        </nav>

        <div className="ml-auto flex items-center gap-3">
          <LanguageSwitch current={locale} />
          <button
            type="button"
            onClick={() => signOut({ redirectTo: "/admin/login" })}
            className="rounded px-3 py-1.5 text-sm text-admin-ink-muted transition-colors duration-150 ease-out hover:bg-admin-raised hover:text-admin-ink"
          >
            {t("common.signOut", locale)}
          </button>
        </div>
      </div>
    </header>
  );
}
