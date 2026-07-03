import { AdminSubNav } from "@/components/layout/AdminSubNav";

const ITEMS = [{ href: "/admin/content/posts", label: "Blog posts" }];

export default function ContentLayout({
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
