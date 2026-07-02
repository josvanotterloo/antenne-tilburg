import { Placeholder } from "@/components/ui/Placeholder";

export default async function BlogPostPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  return (
    <Placeholder
      title="Blog post"
      description={`Post "${slug}" will render here once posts are wired to the database.`}
    />
  );
}
