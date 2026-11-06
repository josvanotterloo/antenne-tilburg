import Link from "next/link";

import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { t } from "@/lib/i18n/t";

export const dynamic = "force-dynamic";

export default async function AdminUsersPage() {
  const session = await auth();
  const locale = session!.user.locale;
  const users = await db.user.findMany({
    select: { id: true, email: true, createdAt: true },
    orderBy: { createdAt: "asc" },
  });

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">{t("users.title", locale)}</h1>
        <p className="text-sm text-admin-ink-muted">{t("users.subtitle", locale)}</p>
      </div>

      <div className="overflow-x-auto rounded border border-admin-hairline bg-admin-surface">
        <table className="w-full text-left text-sm">
          <thead className="border-b border-admin-hairline bg-admin-bg text-admin-ink-muted">
            <tr>
              <th className="px-3 py-2 font-medium">{t("users.colEmail", locale)}</th>
              <th className="px-3 py-2 font-medium">{t("users.colCreated", locale)}</th>
              <th className="px-3 py-2 text-right font-medium">{t("users.manage", locale)}</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-admin-hairline">
            {users.map((user) => (
              <tr key={user.id}>
                <td className="px-3 py-2">{user.email}</td>
                <td className="px-3 py-2 text-admin-ink-muted">
                  {new Date(user.createdAt).toLocaleDateString()}
                </td>
                <td className="px-3 py-2 text-right">
                  <Link
                    href={`/admin/settings/users/${user.id}`}
                    className="text-admin-ink hover:underline"
                  >
                    {t("users.manage", locale)}
                  </Link>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
