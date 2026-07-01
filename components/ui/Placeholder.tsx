export function Placeholder({
  title,
  description,
}: {
  title: string;
  description?: string;
}) {
  return (
    <section className="space-y-3">
      <h1 className="text-2xl font-bold tracking-tight">{title}</h1>
      <p className="max-w-prose text-neutral-500">
        {description ?? "Coming soon."}
      </p>
    </section>
  );
}
