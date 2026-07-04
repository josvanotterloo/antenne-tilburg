import Link from "next/link";
import { notFound } from "next/navigation";

import { db } from "@/lib/db";
import { EmailForm } from "@/components/admin/EmailForm";
import { PasswordForm } from "@/components/admin/PasswordForm";

export const dynamic = "force-dynamic";

export default async function ManageUserPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const user = await db.user.findUnique({
    where: { id },
    select: { id: true, email: true },
  });
  if (!user) notFound();

  return (
    <div className="space-y-8">
      <div>
        <Link
          href="/admin/settings/users"
          className="text-sm text-neutral-500 hover:underline"
        >
          ← Users
        </Link>
        <h1 className="mt-2 text-2xl font-bold tracking-tight">
          Manage {user.email}
        </h1>
      </div>

      <EmailForm userId={user.id} email={user.email} />
      <PasswordForm userId={user.id} />
    </div>
  );
}
