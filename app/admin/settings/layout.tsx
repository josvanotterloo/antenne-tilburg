import { AdminSubNav } from "@/components/layout/AdminSubNav";

const ITEMS = [
  { href: "/admin/settings/hours", label: "Opening hours" },
  { href: "/admin/settings/notices", label: "Notices" },
  { href: "/admin/settings/subscribers", label: "Subscribers" },
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
