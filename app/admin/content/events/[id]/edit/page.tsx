import { notFound } from "next/navigation";

import { db } from "@/lib/db";
import { EventForm } from "@/components/admin/EventForm";

export const dynamic = "force-dynamic";

// Format a stored date as a datetime-local value (YYYY-MM-DDTHH:mm).
function toLocalInput(date: Date): string {
  return new Date(date).toISOString().slice(0, 16);
}

export default async function EditEventPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const event = await db.event.findUnique({ where: { id } });
  if (!event) notFound();

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold tracking-tight">Edit event</h1>
      <EventForm
        event={{
          id: event.id,
          title: event.title,
          slug: event.slug,
          date: toLocalInput(event.date),
          description: event.description,
          image: event.image,
          location: event.location,
          seoTitle: event.seoTitle,
          seoDescription: event.seoDescription,
        }}
      />
    </div>
  );
}
