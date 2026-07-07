import { NewsletterComposer } from "@/components/admin/NewsletterComposer";

export default function NewNewsletterPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">New newsletter</h1>
        <p className="text-sm text-neutral-500">
          Sends to all confirmed subscribers when you hit Send.
        </p>
      </div>
      <NewsletterComposer />
    </div>
  );
}
