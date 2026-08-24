import { AdminSubNav } from "@/components/layout/AdminSubNav";

const ITEMS = [
  { href: "/admin/catalog", label: "Products" },
  { href: "/admin/catalog/orders", label: "Orders" },
  { href: "/admin/catalog/labels", label: "Labels" },
  { href: "/admin/catalog/artists", label: "Artists" },
  { href: "/admin/catalog/genres", label: "Genres" },
  { href: "/admin/catalog/product-types", label: "Product Types" },
  { href: "/admin/catalog/suppliers", label: "Suppliers" },
];

export default function CatalogLayout({ children }: { children: React.ReactNode }) {
  return (
    <div>
      <AdminSubNav items={ITEMS} />
      {children}
    </div>
  );
}
