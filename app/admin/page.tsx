import Link from "next/link";

const CARDS = [
  { href: "/admin/products", label: "Products", hint: "Vinyl & tape stock" },
  { href: "/admin/labels", label: "Labels", hint: "Managed list" },
  { href: "/admin/genres", label: "Genres", hint: "Managed list" },
  { href: "/admin/product-types", label: "Product types", hint: "Managed list" },
  { href: "/admin/posts", label: "Blog posts", hint: "Write & publish" },
  { href: "/admin/events", label: "Events", hint: "Upcoming & past" },
  { href: "/admin/notices", label: "Notices", hint: "Site banners" },
  { href: "/admin/opening-hours", label: "Opening hours", hint: "Per weekday" },
  { href: "/admin/subscribers", label: "Subscribers", hint: "Newsletter list" },
  { href: "/admin/want-list", label: "Want list", hint: "Customer requests" },
  { href: "/admin/users", label: "Users", hint: "Admin accounts" },
];

export default function AdminDashboardPage() {
  return (
    <section className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Dashboard</h1>
        <p className="text-sm text-neutral-500">Manage the Antenne site.</p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {CARDS.map((card) => (
          <Link
            key={card.href}
            href={card.href}
            className="rounded border border-neutral-200 p-4 hover:border-neutral-400"
          >
            <div className="font-medium">{card.label}</div>
            <div className="text-sm text-neutral-500">{card.hint}</div>
          </Link>
        ))}
      </div>
    </section>
  );
}
