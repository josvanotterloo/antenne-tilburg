import { AdminSubNav } from "@/components/layout/AdminSubNav";

const ITEMS = [
  { href: "/admin/settings/hours", label: "Opening hours" },
  { href: "/admin/settings/notices", label: "Notices" },
  { href: "/admin/settings/subscribers", label: "Subscribers" },
  { href: "/admin/settings/users", label: "Users" },
  { href: "/admin/settings/suppliers", label: "Suppliers" },
];

export default function SettingsLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div>
      <AdminSubNav items={ITEMS} />
      {children}
    </div>
  );
}
