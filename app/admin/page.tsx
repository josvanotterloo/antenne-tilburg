import { redirect } from "next/navigation";

// The admin landing point is the Catalog section.
export default function AdminIndexPage() {
  redirect("/admin/catalog");
}
