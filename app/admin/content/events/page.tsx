import Link from "next/link";

import { db } from "@/lib/db";
import { eventStatus } from "@/lib/event-input";
import { DeleteButton } from "@/components/admin/DeleteButton";

export const dynamic = "force-dynamic";

export default async function AdminEventsPage() {
  const events = await db.event.findMany({ orderBy: { date: "desc" } });

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Events</h1>
          <p className="text-sm text-neutral-500">
            {events.length} event{events.length === 1 ? "" : "s"}
          </p>
        </div>
        <Link
          href="/admin/content/events/new"
          className="rounded bg-neutral-900 px-3 py-2 text-sm font-medium text-white"
        >
          New event
        </Link>
      </div>

      {events.length === 0 ? (
        <p className="rounded border border-dashed border-neutral-300 p-8 text-center text-neutral-500">
          No events yet.
        </p>
      ) : (
        <div className="overflow-x-auto rounded border border-neutral-200 bg-white">
          <table className="w-full text-left text-sm">
            <thead className="border-b border-neutral-200 bg-neutral-50 text-neutral-500">
              <tr>
                <th className="px-3 py-2 font-medium">Title</th>
                <th className="px-3 py-2 font-medium">Date</th>
                <th className="px-3 py-2 font-medium">Status</th>
                <th className="px-3 py-2 font-medium">Location</th>
                <th className="px-3 py-2 text-right font-medium">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-neutral-100">
              {events.map((event) => {
                const status = eventStatus(event.date);
                return (
                  <tr key={event.id}>
                    <td className="px-3 py-2">
                      <Link
                        href={`/admin/content/events/${event.id}/edit`}
                        className="font-medium hover:underline"
                      >
                        {event.title}
                      </Link>
                    </td>
                    <td className="px-3 py-2 text-neutral-500">
                      {new Date(event.date).toLocaleString()}
                    </td>
                    <td className="px-3 py-2">
                      <span
                        className={`rounded px-1.5 py-0.5 text-xs ${
                          status === "UPCOMING"
                            ? "bg-green-100 text-green-800"
                            : "bg-neutral-200 text-neutral-700"
                        }`}
                      >
                        {status}
                      </span>
                    </td>
                    <td className="px-3 py-2 text-neutral-500">
                      {event.location}
                    </td>
                    <td className="px-3 py-2 text-right">
                      <DeleteButton endpoint={`/api/admin/events/${event.id}`} />
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
