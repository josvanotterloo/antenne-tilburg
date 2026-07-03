import { EventForm } from "@/components/admin/EventForm";

export default function NewEventPage() {
  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold tracking-tight">New event</h1>
      <EventForm />
    </div>
  );
}
