import { Placeholder } from "@/components/ui/Placeholder";

export default function BlogPostPage({
  params,
}: {
  params: { slug: string };
}) {
  return (
    <Placeholder
      title="Blog post"
      description={`Post "${params.slug}" will render here once posts are wired to the database.`}
    />
  );
}
