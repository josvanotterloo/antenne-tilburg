import { AdminTopNav } from "@/components/layout/AdminTopNav";

export default function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-screen bg-neutral-50">
      <AdminTopNav />
      <main className="mx-auto max-w-6xl p-6">{children}</main>
    </div>
  );
}
