import { SessionProvider } from "next-auth/react";

import { AdminTopNav } from "@/components/layout/AdminTopNav";

export default function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="admin-dark min-h-screen bg-admin-bg text-admin-ink">
      <SessionProvider>
        <AdminTopNav />
        <main className="mx-auto max-w-6xl p-6">{children}</main>
      </SessionProvider>
    </div>
  );
}
