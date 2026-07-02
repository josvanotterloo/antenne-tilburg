import { Placeholder } from "@/components/ui/Placeholder";

export default async function EventPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  return (
    <Placeholder
      title="Event"
      description={`Event "${slug}" will render here once events are wired to the database.`}
    />
  );
}
