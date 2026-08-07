import { AdminSubNav } from "@/components/layout/AdminSubNav";

const ITEMS = [
  { href: "/admin/catalog", label: "Catalog" },
  { href: "/admin/catalog/reference", label: "Reference data" },
  { href: "/admin/catalog/orders", label: "Orders" },
  { href: "/admin/catalog/transactions", label: "Transactions" },
];

export default function CatalogLayout({ children }: { children: React.ReactNode }) {
  return (
    <div>
      <AdminSubNav items={ITEMS} />
      {children}
    </div>
  );
}
