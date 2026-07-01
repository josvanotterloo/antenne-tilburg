import { Placeholder } from "@/components/ui/Placeholder";

export default function EventPage({
  params,
}: {
  params: { slug: string };
}) {
  return (
    <Placeholder
      title="Event"
      description={`Event "${params.slug}" will render here once events are wired to the database.`}
    />
  );
}
