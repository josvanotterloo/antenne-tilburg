import Link from "next/link";

import { db } from "@/lib/db";

export const dynamic = "force-dynamic";

export default async function AdminUsersPage() {
  const users = await db.user.findMany({
    select: { id: true, email: true, createdAt: true },
    orderBy: { createdAt: "asc" },
  });

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Users</h1>
        <p className="text-sm text-admin-ink-muted">
          The two admin accounts (equal access).
        </p>
      </div>

      <div className="overflow-x-auto rounded border border-admin-hairline bg-admin-surface">
        <table className="w-full text-left text-sm">
          <thead className="border-b border-admin-hairline bg-admin-bg text-admin-ink-muted">
            <tr>
              <th className="px-3 py-2 font-medium">Email</th>
              <th className="px-3 py-2 font-medium">Created</th>
              <th className="px-3 py-2 text-right font-medium">Manage</th>
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
                    Manage
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
